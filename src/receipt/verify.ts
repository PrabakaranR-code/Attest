/**
 * Standalone offline receipt verifier. Depends only on node:crypto and the
 * canonicalization rules — no network, no engine state. Give it a receipt
 * and the engine's public key PEM.
 */
import { createHash, createPublicKey, verify as edVerify } from 'node:crypto';
import { canonicalReceiptBuffer } from './canonical.js';
import type { Receipt } from './types.js';

export interface VerifyResult {
  valid: boolean;
  reason?: string;
}

export function verifyReceipt(receipt: Receipt, publicKeyPem: string): VerifyResult {
  if (typeof receipt !== 'object' || receipt === null) {
    return { valid: false, reason: 'receipt is not an object' };
  }
  for (const field of [
    'attest_version',
    'url',
    'requested_url',
    'retrieved_at',
    'requester_key',
    'artifacts',
    'content_hash',
    'engine',
    'signature',
  ]) {
    if (!(field in receipt)) return { valid: false, reason: `missing field: ${field}` };
  }

  const recomputedContentHash = createHash('sha256')
    .update(receipt.artifacts.map((a) => a.sha256).join(''))
    .digest('hex');
  if (recomputedContentHash !== receipt.content_hash) {
    return { valid: false, reason: 'content_hash does not match artifact hashes' };
  }

  let publicKey;
  try {
    publicKey = createPublicKey(publicKeyPem);
  } catch {
    return { valid: false, reason: 'invalid public key PEM' };
  }

  const expectedKeyId = createHash('sha256')
    .update(publicKey.export({ type: 'spki', format: 'der' }))
    .digest('hex')
    .slice(0, 8);
  if (expectedKeyId !== receipt.engine.public_key_id) {
    return { valid: false, reason: 'public_key_id does not match provided public key' };
  }

  let signature: Buffer;
  try {
    signature = Buffer.from(receipt.signature, 'base64');
  } catch {
    return { valid: false, reason: 'signature is not valid base64' };
  }

  const ok = edVerify(null, canonicalReceiptBuffer(receipt), publicKey, signature);
  return ok ? { valid: true } : { valid: false, reason: 'signature verification failed' };
}
