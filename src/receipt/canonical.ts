import type { Receipt, UnsignedReceipt } from './types.js';

/**
 * Canonical JSON of a receipt without its signature: keys in exactly the
 * order defined by receipt spec v1.0, no whitespace. The Ed25519 signature
 * is computed over the UTF-8 bytes of this string.
 */
export function canonicalReceiptJson(receipt: UnsignedReceipt | Receipt): string {
  const ordered = {
    attest_version: receipt.attest_version,
    url: receipt.url,
    requested_url: receipt.requested_url,
    retrieved_at: receipt.retrieved_at,
    requester_key: receipt.requester_key,
    artifacts: receipt.artifacts.map((a) => ({
      mode: a.mode,
      media_type: a.media_type,
      sha256: a.sha256,
      bytes: a.bytes,
    })),
    content_hash: receipt.content_hash,
    engine: {
      name: receipt.engine.name,
      version: receipt.engine.version,
      public_key_id: receipt.engine.public_key_id,
    },
  };
  return JSON.stringify(ordered);
}

export function canonicalReceiptBuffer(receipt: UnsignedReceipt | Receipt): Buffer {
  return Buffer.from(canonicalReceiptJson(receipt), 'utf8');
}
