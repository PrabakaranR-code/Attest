import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { artifactFor, buildReceipt, contentHashFor, sha256Hex } from '../src/receipt/build.js';
import { canonicalReceiptJson } from '../src/receipt/canonical.js';
import { publicKeyIdFor } from '../src/receipt/keys.js';
import { UTC_MICROS_REGEX } from '../src/receipt/time.js';
import type { Receipt, UnsignedReceipt } from '../src/receipt/types.js';
import { verifyReceipt } from '../src/receipt/verify.js';

function testKeys() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
  return { privateKey, publicKey, publicKeyPem, publicKeyId: publicKeyIdFor(publicKey) };
}

function sampleReceipt(overrides: Partial<Parameters<typeof buildReceipt>[0]> = {}): {
  receipt: Receipt;
  publicKeyPem: string;
} {
  const keys = testKeys();
  const screenshot = artifactFor('screenshot', 'image/png', Buffer.from('fake-png-bytes'));
  const reader = artifactFor('reader', 'text/markdown', Buffer.from('# Hello'));
  const receipt = buildReceipt(
    {
      url: 'https://example.com/final',
      requestedUrl: 'https://example.com/',
      artifacts: [screenshot, reader],
      publicKeyId: keys.publicKeyId,
      ...overrides,
    },
    keys.privateKey,
  );
  return { receipt, publicKeyPem: keys.publicKeyPem };
}

describe('canonicalReceiptJson', () => {
  it('is stable regardless of input key insertion order', () => {
    const base: UnsignedReceipt = {
      attest_version: '1.0',
      url: 'https://example.com/a',
      requested_url: 'https://example.com/',
      retrieved_at: '2026-01-01T00:00:00.000001Z',
      requester_key: null,
      artifacts: [{ mode: 'screenshot', media_type: 'image/png', sha256: 'ab', bytes: 2 }],
      content_hash: sha256Hex('ab'),
      engine: { name: 'attest', version: '0.1.0', public_key_id: 'deadbeef' },
    };
    // Same data, keys deliberately inserted in a scrambled order.
    const scrambled = JSON.parse(
      JSON.stringify({
        signature: 'ignored',
        engine: { public_key_id: 'deadbeef', version: '0.1.0', name: 'attest' },
        artifacts: [{ bytes: 2, sha256: 'ab', media_type: 'image/png', mode: 'screenshot' }],
        requester_key: null,
        content_hash: base.content_hash,
        retrieved_at: base.retrieved_at,
        requested_url: base.requested_url,
        url: base.url,
        attest_version: '1.0',
      }),
    ) as UnsignedReceipt;
    expect(canonicalReceiptJson(scrambled)).toBe(canonicalReceiptJson(base));
    expect(canonicalReceiptJson(base)).not.toContain('signature');
    expect(canonicalReceiptJson(base)).not.toContain(' ');
  });

  it('orders top-level keys exactly per spec', () => {
    const { receipt } = sampleReceipt();
    const keys = Object.keys(JSON.parse(canonicalReceiptJson(receipt)) as object);
    expect(keys).toEqual([
      'attest_version',
      'url',
      'requested_url',
      'retrieved_at',
      'requester_key',
      'artifacts',
      'content_hash',
      'engine',
    ]);
  });
});

describe('buildReceipt', () => {
  it('produces a spec-shaped receipt', () => {
    const { receipt } = sampleReceipt({ requesterKey: 'caller-42' });
    expect(receipt.attest_version).toBe('1.0');
    expect(receipt.retrieved_at).toMatch(UTC_MICROS_REGEX);
    expect(receipt.requester_key).toBe('caller-42');
    expect(receipt.artifacts).toHaveLength(2);
    expect(receipt.artifacts[0]?.mode).toBe('screenshot');
    expect(receipt.artifacts[1]?.mode).toBe('reader');
    expect(receipt.content_hash).toBe(contentHashFor(receipt.artifacts));
    expect(receipt.engine.name).toBe('attest');
    expect(receipt.signature.length).toBeGreaterThan(0);
  });

  it('defaults requester_key to null', () => {
    const { receipt } = sampleReceipt();
    expect(receipt.requester_key).toBeNull();
  });

  it('hashes artifact bytes correctly', () => {
    const body = Buffer.from('hello artifact');
    const artifact = artifactFor('reader', 'text/markdown', body);
    expect(artifact.sha256).toBe(sha256Hex(body));
    expect(artifact.bytes).toBe(body.byteLength);
  });
});

describe('verifyReceipt', () => {
  it('roundtrips: signed receipt verifies', () => {
    const { receipt, publicKeyPem } = sampleReceipt();
    expect(verifyReceipt(receipt, publicKeyPem)).toEqual({ valid: true });
  });

  it('fails when a field is tampered', () => {
    const { receipt, publicKeyPem } = sampleReceipt();
    const tampered = { ...receipt, url: 'https://evil.example.com/' };
    expect(verifyReceipt(tampered, publicKeyPem).valid).toBe(false);
  });

  it('fails when an artifact hash is tampered', () => {
    const { receipt, publicKeyPem } = sampleReceipt();
    const artifacts = receipt.artifacts.map((a, i) =>
      i === 0 ? { ...a, sha256: a.sha256.replace(/^./, a.sha256[0] === '0' ? '1' : '0') } : a,
    );
    expect(verifyReceipt({ ...receipt, artifacts }, publicKeyPem).valid).toBe(false);
  });

  it('fails when the signature is corrupted', () => {
    const { receipt, publicKeyPem } = sampleReceipt();
    const sig = Buffer.from(receipt.signature, 'base64');
    sig[0] = (sig[0] ?? 0) ^ 0xff;
    const tampered = { ...receipt, signature: sig.toString('base64') };
    expect(verifyReceipt(tampered, publicKeyPem).valid).toBe(false);
  });

  it('fails with the wrong public key', () => {
    const { receipt } = sampleReceipt();
    const other = testKeys();
    expect(verifyReceipt(receipt, other.publicKeyPem).valid).toBe(false);
  });
});
