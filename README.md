Idea, specification & product design: PrabakaranR-code. Implementation: built autonomously from this spec.

# Attest

**Stateless capture engine for the verified web.** Give Attest a URL and it returns three things in one response:

1. **Full-page screenshot** (PNG) with ads and trackers blocked at the network layer before render — the _visual_ truth.
2. **Reader-mode Markdown** (Readability-based extraction) — the _text_ truth.
3. **A signed receipt** proving what was captured, from where, when (UTC, microsecond precision), in which modes, and optionally by whom — verifiable offline with only the engine's public key.

The receipt is the product. Attest stores nothing: request in → capture out. The Ed25519 signing keypair is the only persisted state.

## Quickstart (Docker)

```bash
git clone https://github.com/PrabakaranR-code/Attest.git && cd Attest
docker build -t attest .
docker run -d -p 8080:8080 -v attest-data:/data attest
```

Then:

```bash
curl -s http://localhost:8080/capture \
  -H 'content-type: application/json' \
  -d '{"url": "https://example.com/"}' > response.json
```

The response contains `receipt`, `screenshot_base64`, and `reader_markdown`.

## Quickstart (local)

```bash
git clone https://github.com/PrabakaranR-code/Attest.git && cd Attest
npm ci
npx playwright install --with-deps chromium
npm run build
npm start
```

## Verify a receipt

Receipts verify offline — no server, no network, just the public key.

```bash
# save the receipt and the engine public key
curl -s http://localhost:8080/capture -H 'content-type: application/json' \
  -d '{"url": "https://example.com/"}' | python3 -c 'import json,sys; print(json.dumps(json.load(sys.stdin)["receipt"]))' > receipt.json
curl -s http://localhost:8080/pubkey | python3 -c 'import json,sys; print(json.load(sys.stdin)["public_key_pem"])' > pub.pem

# verify (prints {"valid":true} and exits 0)
npm run verify -- receipt.json pub.pem
```

The compiled verifier also works without dev dependencies: `node dist/cli/verify.js receipt.json pub.pem`. Verification recomputes the canonical receipt JSON, checks the `content_hash` against the artifact hashes, checks `public_key_id` against the key, and verifies the Ed25519 signature. Flipping a single byte anywhere fails it. See [docs/receipt-spec.md](docs/receipt-spec.md).

## Two doors, one engine

| Door       | Where                                                            | What                                                                                                      |
| ---------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| REST API   | `POST /capture`, `POST /navigate`, `GET /pubkey`, `GET /healthz` | JSON in/out; see [docs/api.md](docs/api.md)                                                               |
| MCP server | `POST /mcp` (Streamable HTTP, stateless)                         | Tools `attest_capture`, `attest_navigate`, `attest_pubkey`; screenshot returned as an image content block |

## Endpoints

| Method | Path        | Purpose                                                                                                   |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------- |
| POST   | `/capture`  | Capture a URL → `{receipt, screenshot_base64, reader_markdown}`                                           |
| POST   | `/navigate` | Open a page, click a selector or follow link text, capture the **destination** with its own fresh receipt |
| GET    | `/pubkey`   | `{public_key_pem, public_key_id}`                                                                         |
| GET    | `/healthz`  | `{ok, browser}`                                                                                           |
| POST   | `/mcp`      | MCP Streamable HTTP endpoint                                                                              |

Errors are `{error, code}` with status 400 (invalid/SSRF-blocked URL, bad navigate target), 408 (navigation timeout), 429 (queue full), 502 (load failure).

## Configuration

| Env var                    | Default                          | Meaning                                                                                                                 |
| -------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `PORT`                     | `8080`                           | Listen port                                                                                                             |
| `HOST`                     | `0.0.0.0`                        | Listen address                                                                                                          |
| `ATTEST_KEY_DIR`           | `.keys` (Docker: `/data/keys`)   | Directory holding the Ed25519 keypair — the only persisted state. Created once, never regenerated over an existing pair |
| `NAV_TIMEOUT_MS`           | `30000`                          | Per-navigation timeout                                                                                                  |
| `MAX_CONCURRENCY`          | `3`                              | Concurrent captures                                                                                                     |
| `MAX_CAPTURES_PER_BROWSER` | `50`                             | Captures before the browser process is recycled                                                                         |
| `ATTEST_MAX_RSS_MB`        | `1024`                           | RSS limit before the browser is force-recycled (`0` disables)                                                           |
| `ATTEST_ALLOW_PRIVATE`     | off                              | Allow loopback/private-range targets (tests, trusted intranets). SSRF guard is on by default                            |
| `ATTEST_CHROMIUM_PATH`     | —                                | Explicit Chromium executable path (custom installs)                                                                     |
| `ATTEST_LIST_CACHE`        | `.list-cache/adblock-engine.bin` | Serialized adblock engine (EasyList/uBlock). Cached in-repo; fetched once only if missing                               |

## Development

```bash
npm ci
npm run lint && npm run typecheck && npm test
```

Tests run against a local fixture site — CI never touches the live internet. One optional live smoke test runs only with `ATTEST_LIVE_SMOKE=1` outside CI.

## Known trade-off

Attest fetches pages from wherever it runs. On datacenter IPs (VPS, cloud), some sites aggressively bot-block or serve challenge pages; the receipt then honestly attests to _what the engine was served_, which may differ from a residential view. Run the engine close to the network vantage point you want to attest from.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 PrabakaranR-code.
