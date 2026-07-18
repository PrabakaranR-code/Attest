import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildReceipt, artifactFor } from '../src/receipt/build.js';
import {
  loadOrCreateKeys,
  PRIVATE_KEY_FILE,
  PUBLIC_KEY_FILE,
  publicKeyIdFor,
} from '../src/receipt/keys.js';
import { verifyReceipt } from '../src/receipt/verify.js';

const dirs: string[] = [];
function tempKeyDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'attest-keys-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('loadOrCreateKeys', () => {
  it('creates a keypair on first start and reuses it on second start', () => {
    const dir = tempKeyDir();

    // Engine start #1: keys generated.
    const first = loadOrCreateKeys(dir);
    const privPemAfterFirst = readFileSync(join(dir, PRIVATE_KEY_FILE), 'utf8');

    // A receipt signed during start #1.
    const receipt = buildReceipt(
      {
        url: 'https://example.com/',
        requestedUrl: 'https://example.com/',
        artifacts: [artifactFor('reader', 'text/markdown', Buffer.from('body'))],
        publicKeyId: first.publicKeyId,
      },
      first.privateKey,
    );

    // Engine start #2 with the same key dir: same identity, no regeneration.
    const second = loadOrCreateKeys(dir);
    expect(second.publicKeyId).toBe(first.publicKeyId);
    expect(second.publicKeyPem).toBe(first.publicKeyPem);
    expect(readFileSync(join(dir, PRIVATE_KEY_FILE), 'utf8')).toBe(privPemAfterFirst);

    // The start-#1 receipt still verifies against start-#2's public key.
    expect(verifyReceipt(receipt, second.publicKeyPem)).toEqual({ valid: true });
  });

  it('derives public_key_id as first 8 hex of sha256(public key DER)', () => {
    const keys = loadOrCreateKeys(tempKeyDir());
    expect(keys.publicKeyId).toMatch(/^[0-9a-f]{8}$/);
    expect(keys.publicKeyId).toBe(publicKeyIdFor(keys.publicKey));
  });

  it('refuses to regenerate over a partial keypair', () => {
    const dir = tempKeyDir();
    loadOrCreateKeys(dir);
    unlinkSync(join(dir, PUBLIC_KEY_FILE));
    expect(() => loadOrCreateKeys(dir)).toThrow(/partial keypair/);
  });

  it('fails loudly on a corrupted private key instead of regenerating', () => {
    const dir = tempKeyDir();
    loadOrCreateKeys(dir);
    writeFileSync(join(dir, PRIVATE_KEY_FILE), 'not a pem');
    expect(() => loadOrCreateKeys(dir)).toThrow();
  });
});
