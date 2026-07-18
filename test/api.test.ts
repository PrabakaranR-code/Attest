import { rmSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/api/server.js';
import { AttestEngine } from '../src/engine/engine.js';
import { sha256Hex } from '../src/receipt/build.js';
import type { Receipt } from '../src/receipt/types.js';
import { verifyReceipt } from '../src/receipt/verify.js';
import { startFixtureSite } from './fixtures/site.js';
import type { FixtureSite } from './fixtures/site.js';
import { testConfig } from './helpers.js';

interface CaptureReply {
  receipt: Receipt;
  screenshot_base64: string;
  reader_markdown: string;
}

describe('REST API', () => {
  let site: FixtureSite;
  let engine: AttestEngine;
  let app: FastifyInstance;
  let config: ReturnType<typeof testConfig>;

  beforeAll(async () => {
    site = await startFixtureSite();
    config = testConfig({ navTimeoutMs: 15_000, allowPrivateUrls: true });
    engine = await AttestEngine.create(config);
    app = buildServer(engine, config);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await engine.close();
    await site.close();
    rmSync(config.keyDir, { recursive: true, force: true });
  });

  it('POST /capture returns receipt + both artifacts', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/capture',
      payload: { url: `${site.baseUrl}/article.html`, requester_key: 'rest-e2e' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as CaptureReply;

    expect(body.reader_markdown).toContain('The Verified Web Article');
    const screenshot = Buffer.from(body.screenshot_base64, 'base64');
    expect(screenshot.subarray(1, 4).toString()).toBe('PNG');

    expect(body.receipt.requester_key).toBe('rest-e2e');
    expect(body.receipt.artifacts[0]?.sha256).toBe(sha256Hex(screenshot));
    expect(body.receipt.artifacts[1]?.sha256).toBe(
      sha256Hex(Buffer.from(body.reader_markdown, 'utf8')),
    );

    const pub = (await app.inject({ method: 'GET', url: '/pubkey' })).json() as {
      public_key_pem: string;
      public_key_id: string;
    };
    expect(verifyReceipt(body.receipt, pub.public_key_pem)).toEqual({ valid: true });
    expect(body.receipt.engine.public_key_id).toBe(pub.public_key_id);
  });

  it('POST /navigate clicks through and receipts the destination', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/navigate',
      payload: { url: `${site.baseUrl}/article.html`, click_selector: '#next-link' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as CaptureReply;
    expect(body.receipt.url).toBe(`${site.baseUrl}/destination.html`);
    expect(body.receipt.requested_url).toBe(`${site.baseUrl}/article.html`);
    expect(body.reader_markdown).toContain('The Destination Article');
  });

  it('POST /navigate by link text works too', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/navigate',
      payload: { url: `${site.baseUrl}/article.html`, follow_link_text: 'destination' },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as CaptureReply).receipt.url).toBe(`${site.baseUrl}/destination.html`);
  });

  it('rejects navigate with both or neither targeting fields', async () => {
    const neither = await app.inject({
      method: 'POST',
      url: '/navigate',
      payload: { url: `${site.baseUrl}/article.html` },
    });
    expect(neither.statusCode).toBe(400);
    const both = await app.inject({
      method: 'POST',
      url: '/navigate',
      payload: {
        url: `${site.baseUrl}/article.html`,
        click_selector: '#a',
        follow_link_text: 'b',
      },
    });
    expect(both.statusCode).toBe(400);
    expect(both.json()).toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('400 on invalid or non-http URLs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/capture',
      payload: { url: 'file:///etc/passwd' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'INVALID_URL' });
  });

  it('408 with NAV_TIMEOUT on a hanging page', async () => {
    const fastEngine = await AttestEngine.create(
      testConfig({ navTimeoutMs: 1_200, allowPrivateUrls: true, keyDir: config.keyDir }),
    );
    const fastApp = buildServer(fastEngine, { ...config, navTimeoutMs: 1_200 });
    try {
      const res = await fastApp.inject({
        method: 'POST',
        url: '/capture',
        payload: { url: `${site.baseUrl}/slow` },
      });
      expect(res.statusCode).toBe(408);
      expect(res.json()).toMatchObject({ code: 'NAV_TIMEOUT' });
    } finally {
      await fastApp.close();
      await fastEngine.close();
    }
  });

  it('502 with LOAD_FAILURE when the site is unreachable', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/capture',
      payload: { url: 'http://127.0.0.1:9/unreachable' },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ code: 'LOAD_FAILURE' });
  });

  it('blocks SSRF when private URLs are not allowed', async () => {
    const guarded = buildServer(engine, { ...config, allowPrivateUrls: false });
    try {
      const res = await guarded.inject({
        method: 'POST',
        url: '/capture',
        payload: { url: `${site.baseUrl}/article.html` },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'SSRF_BLOCKED' });
    } finally {
      await guarded.close();
    }
  });

  it('GET /healthz reports engine state', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });
});
