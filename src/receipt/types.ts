/** Receipt spec v1.0 — FROZEN. Any change bumps attest_version. */

export const ATTEST_VERSION = '1.0';

export interface ReceiptArtifact {
  mode: string;
  media_type: string;
  sha256: string;
  bytes: number;
}

export interface ReceiptEngine {
  name: string;
  version: string;
  public_key_id: string;
}

export interface UnsignedReceipt {
  attest_version: string;
  url: string;
  requested_url: string;
  retrieved_at: string;
  requester_key: string | null;
  artifacts: ReceiptArtifact[];
  content_hash: string;
  engine: ReceiptEngine;
}

export interface Receipt extends UnsignedReceipt {
  signature: string;
}
