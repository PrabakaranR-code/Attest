# Changelog

## v0.1.0 — 2026-07-18

First release: the complete Attest engine, built from `SPEC.md`.

- **Receipt core** — Ed25519-signed receipts (spec v1.0, frozen): microsecond-UTC `retrieved_at`, per-artifact SHA-256, `content_hash`, canonical-JSON signing, offline verifier module + CLI (`npm run verify`). Keypair persisted in `ATTEST_KEY_DIR`, generated once, never regenerated.
- **Capture engine** — shared Chromium (Playwright) with crash relaunch, capture-count recycling and an RSS memory guard; ad/tracker blocking at the network layer from a cached EasyList/uBlock engine; reader-mode Markdown (Readability + turndown) with whole-body fallback; consent-banner dismissal and lazy-load auto-scroll.
- **REST door** — `POST /capture`, `POST /navigate` (click a selector or follow link text; the destination hop gets its own receipt), `GET /pubkey`, `GET /healthz`; zod validation, SSRF guard (scheme/localhost/private ranges + DNS check), bounded queue; errors as `{error, code}` with 400/408/429/502.
- **MCP door** — stateless Streamable HTTP endpoint at `/mcp` with `attest_capture`, `attest_navigate`, `attest_pubkey`; screenshots as image content blocks, receipts as text.
- **Packaging** — Dockerfile (non-root, `VOLUME /data`, amd64/arm64-friendly), DEPLOY.md runbook with a two-run key-persistence check, API and receipt-spec docs, MIT license.
