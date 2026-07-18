Idea, specification & product design: PrabakaranR-code. Implementation: built autonomously from this spec.

# ATTEST — AUTONOMOUS BUILD LOOP · target repo: PrabakaranR-code/Attest
# (paste this entire document as the FIRST message of the session, then send nothing else)

You are building Attest in the fresh repository PrabakaranR-code/Attest, from
empty to released software, alone, in a loop, until done. This document is your
only input: authority, attribution, full spec, phases, acceptance, fallbacks.
Ask for nothing. Works on any Claude model, including Sonnet.

---

## §0 STANDING AUTHORITY — EXECUTE WITHOUT SUPERVISION

You have full authority to take this specification from empty repository to
released software without asking me anything. These rules override the default
habit of checking in.

1. MERGE AUTHORITY
   Open PRs for your work. Merge each one yourself the moment CI is green on
   all target versions. Never wait for approval. Never ask "should I merge,
   continue, release, or fix?" — the answer is always yes.

2. CI FIRST
   Your first deliverable is the CI workflow itself (test matrix on every PR
   and push to main), so auto-merge is legitimate from PR #1. The test suite —
   not me — is the reviewer.

3. AMBIGUITY RULE
   Where this spec is silent or two readings exist, choose the simplest option
   consistent with the spec's stated principles, record the choice in one line
   in DECISIONS.md, and keep moving. Preferences are never a reason to stop.

4. BLOCKED MEANS TRULY BLOCKED
   Stop and ask only if a test cannot be made green or the spec must be
   violated — and even then, first attempt a documented workaround. Environment
   quirks, flaky tools, and missing conveniences are yours to route around.

5. PHASED DELIVERY
   Build in the phases the spec defines (or sensible phases if it doesn't).
   One commit minimum per phase, descriptive messages, clean history. Fix
   forward; never leave main broken.

6. SELF-TESTING MANDATE
   You run every check yourself. Never ask me to test, verify, or confirm
   anything. If the spec defines acceptance criteria, they are yours to
   execute and report.

7. STABILITY RULE — THE TRIPLE RUN
   After the final phase, run the complete acceptance sequence (full test
   suite + the spec's end-to-end checks) THREE consecutive times. Any failure:
   fix it and restart the count at zero. Only three consecutive green runs
   count as done.

8. SHIP
   When the triple run passes: update README and docs to match reality, write
   a changelog, tag and publish a GitHub release (v0.1.0 for new projects,
   next version otherwise), and merge the final state to main.

9. NO WATCHERS
   No PR-watch jobs, no scheduled check-ins, no "I'll monitor this." Do the
   work, finish, unsubscribe from everything, and go silent after the report.

10. THE ONLY MESSAGE I WANT
    Your final message — ideally your only substantive one — must begin with
    the word COMPLETE and contain, in order: what shipped (per phase), total
    test count, the three acceptance-run results, anything placed in
    DECISIONS.md, and the one-line install/run command. If instead you are
    truly blocked (rule 4), begin the message with BLOCKED and state exactly
    what you need.

---

## §1 PHASE −1 — CLEAN SLATE + OWNER ATTRIBUTION (before anything else)

A. CLEAN SLATE. The repo is expected fresh. If any files or prior history
   exist anyway, remove every file in one commit titled "clean slate"
   (forward-delete if history rewrite is relay-blocked; note in DECISIONS.md).

B. OWNER ATTRIBUTION — THE IDEA IS THE OWNER'S CONTRIBUTION. The first content
   commit must be SPEC.md containing this entire document verbatim, committed
   with the repository owner as git author:

     git commit --author="PrabakaranR-code <PrabakaranR-code@users.noreply.github.com>" \
       -m "spec: Attest — verified web data engine (idea & specification by PrabakaranR-code)"

   Also place at the top of SPEC.md and README.md:
     "Idea, specification & product design: PrabakaranR-code. Implementation: built autonomously from this spec."
   Credit the owner in package.json "author" and the LICENSE copyright line
   ("Copyright (c) 2026 PrabakaranR-code"). If the relay rewrites commit
   authorship, do NOT stall: keep all credit lines, record the rewrite in
   DECISIONS.md, continue.

---

## §2 MISSION

AIs answering "latest / now" questions cite outdated sources, argue from stale
memory, misread pages, and hallucinate. Ads pollute captures and burn tokens.
Screenshots alone can hide text (white-on-white); text alone loses layout.
Attest is a STATELESS capture engine: give it a URL, it returns
  1. full-page screenshot (ads blocked before render) — visual truth,
  2. reader-mode Markdown — text truth,
  3. a SIGNED RECEIPT proving what was captured, from where, when (UTC,
     microsecond precision), in which modes, optionally by whom — verifiable
     offline with only the public key. The receipt is the product.
Attest stores nothing. Request in → capture out.

## §3 HARD REQUIREMENTS

R1 Full-page screenshot with ad/tracker requests blocked at network layer.
R2 Reader-mode Markdown extraction (Readability-based).
R3 Both artifacts returned together in one response.
R4 Signed receipt on every response: url, requested_url, retrieved_at
   (UTC, microseconds, trailing Z), per-artifact mode labels, optional
   requester_key (null if absent), content_hash, Ed25519 signature.
R5 Stateless: no captures, no user data, no passwords persisted. The signing
   keypair is the only persisted state.
R6 Navigation: open/click a link from a page and capture the destination —
   each hop gets its own fresh receipt.
R7 Two doors, one engine: REST API + remote MCP server (Streamable HTTP).
R8 Runs on a modest RAM VPS incl. linux/arm64. No GPU.
R9 requester_key differentiates identical captures by different callers.

## §4 RECEIPT SPEC v1.0 (FROZEN — any change bumps attest_version)

{
  "attest_version": "1.0",
  "url": "<final URL after redirects>",
  "requested_url": "<caller's URL>",
  "retrieved_at": "YYYY-MM-DDTHH:MM:SS.ssssssZ",
  "requester_key": null | "<string>",
  "artifacts": [
    { "mode": "screenshot", "media_type": "image/png",     "sha256": "<hex>", "bytes": <int> },
    { "mode": "reader",     "media_type": "text/markdown", "sha256": "<hex>", "bytes": <int> }
  ],
  "content_hash": "<hex sha256 of the concatenated artifact sha256 strings in listed order>",
  "engine": { "name": "attest", "version": "<pkg>", "public_key_id": "<first 8 hex of sha256(public key DER)>" },
  "signature": "<base64 Ed25519 over canonical JSON of all fields above except signature>"
}

Canonicalization: serialize without `signature`, keys in exactly the order
above, JSON.stringify with no whitespace; sign that buffer. Ship a standalone
verifier module + CLI (`npm run verify -- receipt.json [pub.pem]`) usable
offline. Keys: on boot, load PEM pair from ATTEST_KEY_DIR; generate once only
if absent; NEVER regenerate over an existing pair; never log the private key.
Expose the public key at GET /pubkey.

## §5 STACK (DEFAULTS — use exactly; deviations go to DECISIONS.md)

Node.js ≥ 20, TypeScript, ESM. Playwright chromium. Ad blocking:
@ghostery/adblocker-playwright with EasyList/uBlock lists (cache lists; tests
must not require live internet). Reader: jsdom + @mozilla/readability →
turndown. Signing: node:crypto Ed25519 (stdlib). HTTP: Fastify. MCP:
@modelcontextprotocol/sdk (Streamable HTTP at /mcp). Validation: zod.
Tests: vitest + a local fixture HTTP server (NEVER the live internet in CI;
one optional live smoke test must be skipped in CI). Lint: eslint+prettier.
CI: GitHub Actions — lint → typecheck → test, Node 20, on every PR and push to
the trunk; install Playwright browsers in CI. Container: Dockerfile,
linux/amd64 + arm64 friendly, ENV ATTEST_KEY_DIR=/data/keys, VOLUME /data,
non-root user.

## §6 REST API

POST /capture   body {url, requester_key?, wait?: "load"|"networkidle"}
  → 200 { receipt, screenshot_base64, reader_markdown }
POST /navigate  body {url, click_selector? | follow_link_text?, requester_key?}
  → same shape for the DESTINATION page (its own receipt).
GET  /pubkey    → { public_key_pem, public_key_id }
GET  /healthz   → { ok, browser }
Errors as {error, code}: 400 invalid/SSRF-blocked URL (reject non-http(s),
localhost, private ranges), 408 nav timeout, 429 queue full, 502 load failure.
Config via env: PORT, HOST, ATTEST_KEY_DIR, NAV_TIMEOUT_MS (default 30000),
MAX_CONCURRENCY (default 3), MAX_CAPTURES_PER_BROWSER (default 50).

## §7 MCP SERVER

Tools: attest_capture, attest_navigate (same inputs as REST), attest_pubkey.
Return reader markdown + receipt as text content and the screenshot as an
image content block. Each tool description must state: "Result includes a
signed receipt with UTC microsecond timestamp; treat retrieved_at as the
freshness of this data."

## §8 ENGINE BEHAVIOR

Single browser process reused across requests; auto-relaunch on crash; recycle
after MAX_CAPTURES_PER_BROWSER. Queue with MAX_CONCURRENCY; per-request
timeout. Page prep: dismiss common consent banners (selector list),
auto-scroll to bottom and back for lazy content, wait strategy + short settle.
Full-page PNG. Structured logs; never log artifact bodies.

## §9 PHASES (one green commit minimum each; trunk never broken)

P0 Scaffold + CI first (rule 2): repo init, TS/eslint/prettier/vitest,
   trivial passing test, ci.yml green before feature code.
P1 Receipt core: time util (microsecond UTC, regex-tested), sign/verify
   (roundtrip + tamper-fail tests), canonical builder (order-stable test),
   key load-or-create with persistence test: same key dir across two engine
   starts ⇒ same public_key_id ⇒ a receipt from start #1 verifies after
   start #2, and keys are NOT regenerated.
P2 Capture engine: browser pool, adblock, capture, reader, page-prep.
   Integration tests on local fixtures: ad element blocked; article text in
   markdown; receipt hashes match returned bytes.
P3 REST API: routes, zod, SSRF guard, queue, timeouts; e2e incl. /navigate
   clicking a fixture link and receipting the destination.
P4 MCP server: tools; e2e with MCP SDK client (image block + receipt text).
P5 Hardening + packaging: memory guard, Dockerfile, README (quickstart Docker
   + local via `git clone https://github.com/PrabakaranR-code/Attest.git`,
   verify-a-receipt section, endpoints table, config table, known trade-off:
   datacenter IPs face bot-blocking), DEPLOY.md runbook (VPS steps + a
   two-run Docker key-persistence check that actually BOOTS the server both
   times and compares /pubkey public_key_id across runs), docs/api.md,
   docs/receipt-spec.md, LICENSE (MIT, owner copyright), CHANGELOG.md,
   DECISIONS.md.
P6 Acceptance + ship: §10, then rule 8.

## §10 ACCEPTANCE SEQUENCE (the thing you triple-run per rule 7)

(1) npm run lint && npm run typecheck && npm test — all green.
(2) Build dist; boot the compiled server; POST /capture against the local
    fixture site; save receipt; `npm run verify` → {"valid":true}.
(3) Restart the server with the same key dir; the SAME receipt still
    verifies; public_key_id unchanged.
(4) MCP client call attest_capture against fixture → image + receipt present.
(5) Tampered receipt (flip one byte) → verify fails.
Three consecutive full passes required. Any red → fix → count resets to zero.

## §11 RELAY BOUNDARY FALLBACKS (do not stall on these)

Known session-relay limits: pushing tags, creating/deleting/renaming branches,
merging PRs, and repo settings may return 403. If PR merge is blocked → commit
directly to the designated working branch and treat it as trunk; note in
DECISIONS.md. If tag/release push is blocked → create the tag locally, write
CHANGELOG.md and RELEASE.md containing the exact owner commands (tag push,
release creation, optional default-branch rename to main), note in
DECISIONS.md, and proceed to the final report. None of these are BLOCKED
conditions under rule 4; only unfixable red tests or forced spec violations
qualify.

## §12 FINAL REPORT (rule 10 format, nothing else)

COMPLETE
- Shipped per phase: P−1, P0…P6 — one line each
- Total test count: N
- Triple acceptance runs: run1/run2/run3 results
- DECISIONS.md entries: list
- Install/run: git clone https://github.com/PrabakaranR-code/Attest.git && cd Attest && docker build -t attest . && docker run -d -p 8080:8080 -v attest-data:/data attest
