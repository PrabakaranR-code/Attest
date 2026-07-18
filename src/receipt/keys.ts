import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface EngineKeys {
  privateKey: KeyObject;
  publicKey: KeyObject;
  publicKeyPem: string;
  publicKeyId: string;
}

export const PRIVATE_KEY_FILE = 'attest-private.pem';
export const PUBLIC_KEY_FILE = 'attest-public.pem';

/** First 8 hex chars of sha256 over the public key's DER (SPKI) encoding. */
export function publicKeyIdFor(publicKey: KeyObject): string {
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return createHash('sha256').update(der).digest('hex').slice(0, 8);
}

/**
 * Load the Ed25519 keypair from `dir`, generating it once if absent.
 * An existing pair is NEVER regenerated or overwritten; a half-present
 * pair (one file missing) is an error rather than a silent regenerate.
 */
export function loadOrCreateKeys(dir: string): EngineKeys {
  const privPath = join(dir, PRIVATE_KEY_FILE);
  const pubPath = join(dir, PUBLIC_KEY_FILE);
  const havePriv = existsSync(privPath);
  const havePub = existsSync(pubPath);

  if (havePriv !== havePub) {
    throw new Error(
      `Key dir ${dir} contains only one of ${PRIVATE_KEY_FILE}/${PUBLIC_KEY_FILE}; ` +
        'refusing to regenerate over a partial keypair. Restore or remove both files.',
    );
  }

  if (!havePriv) {
    mkdirSync(dir, { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
    writeFileSync(privPath, privPem, { mode: 0o600 });
    writeFileSync(pubPath, pubPem, { mode: 0o644 });
  }

  const privateKey = createPrivateKey(readFileSync(privPath, 'utf8'));
  const publicKey = createPublicKey(readFileSync(pubPath, 'utf8'));
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
  return { privateKey, publicKey, publicKeyPem, publicKeyId: publicKeyIdFor(publicKey) };
}
