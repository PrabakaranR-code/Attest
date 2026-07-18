import { rmSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AttestEngine } from '../src/engine/engine.js';
import { NavTimeoutError, NavigateTargetError } from '../src/engine/errors.js';
import { sha256Hex } from '../src/receipt/build.js';
import { UTC_MICROS_REGEX } from '../src/receipt/time.js';
import { verifyReceipt } from '../src/receipt/verify.js';
import { startFixtureSite } from './fixtures/site.js';
import type { FixtureSite } from './fixtures/site.js';
import { testConfig } from './helpers.js';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe('AttestEngine', () => {
  let site: FixtureSite;
  let engine: AttestEngine;
  let config: ReturnType<typeof testConfig>;

  beforeAll(async () => {
    site = await startFixtureSite();
    config = testConfig({ navTimeoutMs: 15_000 });
    engine = await AttestEngine.create(config);
  });

  afterAll(async () => {
    await engine.close();
    await site.close();
    rmSync(config.keyDir, { recursive: true, force: true });
  });

  it('captures screenshot + markdown with a verifying receipt', async () => {
    const res = await engine.capture({ url: `${site.baseUrl}/article.html` });

    expect(res.screenshot.subarray(0, 4)).toEqual(PNG_MAGIC);
    expect(res.markdown).toContain('The Verified Web Article');
    expect(res.markdown).toContain('stateless capture engine');

    const { receipt } = res;
    expect(receipt.url).toBe(`${site.baseUrl}/article.html`);
    expect(receipt.requested_url).toBe(`${site.baseUrl}/article.html`);
    expect(receipt.retrieved_at).toMatch(UTC_MICROS_REGEX);
    expect(receipt.requester_key).toBeNull();

    // Receipt hashes match the returned bytes exactly.
    expect(receipt.artifacts[0]).toMatchObject({
      mode: 'screenshot',
      media_type: 'image/png',
      sha256: sha256Hex(res.screenshot),
      bytes: res.screenshot.byteLength,
    });
    expect(receipt.artifacts[1]).toMatchObject({
      mode: 'reader',
      media_type: 'text/markdown',
      sha256: sha256Hex(Buffer.from(res.markdown, 'utf8')),
      bytes: Buffer.byteLength(res.markdown, 'utf8'),
    });

    expect(verifyReceipt(receipt, engine.pubkey().public_key_pem)).toEqual({ valid: true });
  });

  it('blocks ad/tracker requests at the network layer', async () => {
    const res = await engine.capture({ url: `${site.baseUrl}/article.html` });
    expect(res.blockedRequests).toBeGreaterThanOrEqual(1);
    // The ad iframe/script hosts never appear in the reader output either.
    expect(res.markdown).not.toContain('adsbygoogle');
  });

  it('records redirects: url is final, requested_url is the caller input', async () => {
    const res = await engine.capture({ url: `${site.baseUrl}/redirect` });
    expect(res.receipt.requested_url).toBe(`${site.baseUrl}/redirect`);
    expect(res.receipt.url).toBe(`${site.baseUrl}/article.html`);
  });

  it('passes requester_key through to the receipt (differentiates callers)', async () => {
    const a = await engine.capture({
      url: `${site.baseUrl}/article.html`,
      requesterKey: 'alice',
    });
    const b = await engine.capture({ url: `${site.baseUrl}/article.html`, requesterKey: 'bob' });
    expect(a.receipt.requester_key).toBe('alice');
    expect(b.receipt.requester_key).toBe('bob');
    expect(a.receipt.signature).not.toBe(b.receipt.signature);
  });

  it('navigate clicks a link and receipts the destination page', async () => {
    const res = await engine.navigate({
      url: `${site.baseUrl}/article.html`,
      clickSelector: '#next-link',
    });
    expect(res.receipt.url).toBe(`${site.baseUrl}/destination.html`);
    expect(res.markdown).toContain('The Destination Article');
    expect(verifyReceipt(res.receipt, engine.pubkey().public_key_pem)).toEqual({ valid: true });
  });

  it('navigate follows a link by visible text', async () => {
    const res = await engine.navigate({
      url: `${site.baseUrl}/article.html`,
      followLinkText: 'Continue to the destination',
    });
    expect(res.receipt.url).toBe(`${site.baseUrl}/destination.html`);
  });

  it('navigate fails clearly when the target does not exist', async () => {
    await expect(
      engine.navigate({ url: `${site.baseUrl}/article.html`, clickSelector: '#nope' }),
    ).rejects.toBeInstanceOf(NavigateTargetError);
  });

  it('times out on a hanging page', async () => {
    const fast = await AttestEngine.create(
      testConfig({ navTimeoutMs: 1_500, keyDir: config.keyDir }),
    );
    try {
      await expect(fast.capture({ url: `${site.baseUrl}/slow` })).rejects.toBeInstanceOf(
        NavTimeoutError,
      );
    } finally {
      await fast.close();
    }
  });

  it('reports health with browser status', async () => {
    const health = engine.health();
    expect(health.ok).toBe(true);
    expect(typeof health.browser).toBe('boolean');
  });
});
