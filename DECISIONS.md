# DECISIONS

One-line records of choices made where the spec was silent or the environment forced a workaround (spec §0.3).

1. Repo was genuinely empty at session start — no "clean slate" commit was needed (spec §1A).
2. Local dev environment runs Node 22; CI pins Node 20 per spec, `engines` requires `>=20`.
3. Added `ATTEST_CHROMIUM_PATH` env knob: the build environment ships Chromium at a fixed path instead of a Playwright-managed download (which is blocked here); the knob is also generally useful for custom/ARM installs. CI and Docker use the standard `playwright install chromium`.
4. Committed `.list-cache/adblock-engine.bin` (serialized @ghostery prebuilt ads+tracking engine, EasyList/uBlock lists) so tests and CI never fetch lists from the live internet; it is refreshed only if the file is deleted.
5. Added `ATTEST_ALLOW_PRIVATE` env flag to permit loopback/private-range targets (required for local fixture tests; useful for trusted intranets). SSRF guard is on by default; scheme checks always apply.
6. `/navigate` requires exactly one of `click_selector` | `follow_link_text` (400 `INVALID_REQUEST` otherwise) — a navigate without a target would just be `/capture`.
7. Selector/link-text matching nothing on the page maps to 400 `NAVIGATE_TARGET` (spec's error table is silent on this case).
8. Reader fallback: pages Readability cannot parse fall back to a whole-body markdown conversion so the caller always receives text truth.
9. Memory guard implemented as `ATTEST_MAX_RSS_MB` (default 1024, `0` disables): RSS over limit force-recycles the browser process.
10. MCP door is stateless Streamable HTTP: a fresh server+transport pair per `POST /mcp` request; `GET`/`DELETE /mcp` return 405 (no sessions, matching the engine's stateless design).
11. `npm run verify` runs the verifier from source via tsx; the same CLI is compiled to `dist/cli/verify.js` for dependency-free offline use.
12. Trunk strategy: the designated working branch is developed on directly and `main` is fast-forwarded from it; each phase lands as its own commit with CI on every push (spec §0.2, §11).
13. Dockerfile gained a `BASE_IMAGE` build arg (default `node:20-bookworm-slim`) so builds can point at a Docker Hub mirror when the Hub blob CDN is unreachable.
14. Sandbox network policy blocks Docker Hub's blob CDN, the Playwright browser CDN, and Debian apt repos; the production Dockerfile was therefore validated here via an uncommitted sandbox variant (mirror base + sandbox egress CA + browser install skipped — the browser launches lazily). The image boots as non-root and the DEPLOY.md two-run key-persistence check passed in-container: identical `public_key_id` across two boots on one volume.
15. The §10 acceptance sequence is committed as `scripts/acceptance.sh` (with `scripts/fixture-site.ts` and `scripts/mcp-check.mjs`) so the triple run is reproducible by the owner.
