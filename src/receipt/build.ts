import { createHash, sign as edSign } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { canonicalReceiptBuffer } from './canonical.js';
import { nowUtcMicros } from './time.js';
import { ATTEST_VERSION } from './types.js';
import type { Receipt, ReceiptArtifact, UnsignedReceipt } from './types.js';
import { ENGINE_NAME, ENGINE_VERSION } from '../version.js';

export function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function artifactFor(mode: string, mediaType: string, body: Buffer): ReceiptArtifact {
  return { mode, media_type: mediaType, sha256: sha256Hex(body), bytes: body.byteLength };
}

/** sha256 hex over the concatenated artifact sha256 hex strings, in listed order. */
export function contentHashFor(artifacts: ReceiptArtifact[]): string {
  return sha256Hex(artifacts.map((a) => a.sha256).join(''));
}

export interface BuildReceiptInput {
  url: string;
  requestedUrl: string;
  requesterKey?: string | null;
  artifacts: ReceiptArtifact[];
  publicKeyId: string;
  retrievedAt?: string;
}

export function buildReceipt(input: BuildReceiptInput, privateKey: KeyObject): Receipt {
  const unsigned: UnsignedReceipt = {
    attest_version: ATTEST_VERSION,
    url: input.url,
    requested_url: input.requestedUrl,
    retrieved_at: input.retrievedAt ?? nowUtcMicros(),
    requester_key: input.requesterKey ?? null,
    artifacts: input.artifacts,
    content_hash: contentHashFor(input.artifacts),
    engine: { name: ENGINE_NAME, version: ENGINE_VERSION, public_key_id: input.publicKeyId },
  };
  const signature = edSign(null, canonicalReceiptBuffer(unsigned), privateKey).toString('base64');
  return { ...unsigned, signature };
}
