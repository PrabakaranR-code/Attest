# Attest Receipt Spec v1.0 (FROZEN)

Any change to this format bumps `attest_version`.

## Shape

```json
{
  "attest_version": "1.0",
  "url": "<final URL after redirects>",
  "requested_url": "<caller's URL>",
  "retrieved_at": "YYYY-MM-DDTHH:MM:SS.ssssssZ",
  "requester_key": null,
  "artifacts": [
    { "mode": "screenshot", "media_type": "image/png", "sha256": "<hex>", "bytes": 12345 },
    { "mode": "reader", "media_type": "text/markdown", "sha256": "<hex>", "bytes": 678 }
  ],
  "content_hash": "<hex>",
  "engine": { "name": "attest", "version": "<pkg>", "public_key_id": "<8 hex>" },
  "signature": "<base64 Ed25519>"
}
```

## Field semantics

- `url` — final URL after redirects; `requested_url` — exactly what the caller asked for.
- `retrieved_at` — capture time, UTC, microsecond precision, trailing `Z`.
- `requester_key` — optional caller identity; `null` when absent. Two callers capturing the same page get receipts that differ in this field (and therefore in signature).
- `artifacts[].sha256` — hex SHA-256 of the artifact's exact bytes as returned to the caller.
- `content_hash` — hex SHA-256 of the _concatenated artifact sha256 hex strings_, in listed order.
- `engine.public_key_id` — first 8 hex chars of SHA-256 over the engine public key's DER (SPKI) encoding.

## Canonicalization & signature

The signature is Ed25519 over the UTF-8 bytes of the receipt serialized **without** `signature`, with keys in exactly the order shown above (including nested `artifacts[]` and `engine` key order), `JSON.stringify` with no whitespace.

## Verification (offline)

Inputs: the receipt JSON and the engine public key PEM (`GET /pubkey`, or shipped out-of-band).

1. Recompute `content_hash` from `artifacts[].sha256`; must match.
2. Check `public_key_id` matches the provided key.
3. Rebuild the canonical JSON and verify the Ed25519 signature.
4. (When you hold the artifacts) hash them and compare to `artifacts[].sha256`.

```bash
npm run verify -- receipt.json pub.pem      # from source
node dist/cli/verify.js receipt.json pub.pem # compiled, no dev deps
```

Output is `{"valid":true}` (exit 0) or `{"valid":false,"reason":"..."}` (exit 1). If `pub.pem` is omitted, the key is read from `$ATTEST_KEY_DIR/attest-public.pem`.

## Key lifecycle

On boot the engine loads the PEM pair from `ATTEST_KEY_DIR`, generating it **once** only if absent. An existing pair is never regenerated or overwritten; a half-present pair is a hard error. The private key is never logged and never leaves the key dir.
