#!/usr/bin/env bash
# Attest acceptance sequence (SPEC.md §10). Exits 0 only if every step passes.
set -euo pipefail
cd "$(dirname "$0")/.."

WORK=$(mktemp -d)
KEYDIR="$WORK/keys"
PORT=18099
SERVER_PID=""
FIXTURE_PID=""

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "$FIXTURE_PID" ] && kill "$FIXTURE_PID" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

boot_server() {
  ATTEST_KEY_DIR="$KEYDIR" PORT=$PORT HOST=127.0.0.1 ATTEST_ALLOW_PRIVATE=1 \
    node dist/server.js >"$WORK/server.log" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 60); do
    curl -sf "http://127.0.0.1:$PORT/healthz" >/dev/null && return 0
    sleep 0.5
  done
  echo "server failed to boot"; cat "$WORK/server.log"; return 1
}

stop_server() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  SERVER_PID=""
}

echo "== (1) lint + typecheck + tests =="
npm run lint
npm run typecheck
npm test

echo "== (2) build, boot compiled server, capture, verify receipt =="
npm run build
node_modules/.bin/tsx scripts/fixture-site.ts >"$WORK/fixture.url" &
FIXTURE_PID=$!
for _ in $(seq 1 40); do [ -s "$WORK/fixture.url" ] && break; sleep 0.5; done
FIXTURE_URL=$(head -n1 "$WORK/fixture.url")
echo "fixture at $FIXTURE_URL"
boot_server
curl -sf "http://127.0.0.1:$PORT/capture" -H 'content-type: application/json' \
  -d "{\"url\": \"$FIXTURE_URL/article.html\", \"requester_key\": \"acceptance\"}" >"$WORK/response.json"
node -e '
  const fs = require("fs");
  const r = JSON.parse(fs.readFileSync(process.argv[1] + "/response.json", "utf8"));
  if (!r.reader_markdown.includes("The Verified Web Article")) throw new Error("markdown missing article");
  const png = Buffer.from(r.screenshot_base64, "base64");
  if (png.subarray(1, 4).toString() !== "PNG") throw new Error("not a PNG");
  fs.writeFileSync(process.argv[1] + "/receipt.json", JSON.stringify(r.receipt));
' "$WORK"
curl -sf "http://127.0.0.1:$PORT/pubkey" >"$WORK/pubkey.json"
node -e '
  const fs = require("fs");
  fs.writeFileSync(process.argv[1] + "/pub.pem", JSON.parse(fs.readFileSync(process.argv[1] + "/pubkey.json", "utf8")).public_key_pem);
' "$WORK"
KEYID1=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1] + "/pubkey.json", "utf8")).public_key_id)' "$WORK")
VERIFY1=$(node dist/cli/verify.js "$WORK/receipt.json" "$WORK/pub.pem")
echo "verify #1: $VERIFY1"
[ "$VERIFY1" = '{"valid":true}' ]

echo "== (3) restart server, same key dir: receipt still verifies, key id unchanged =="
stop_server
boot_server
curl -sf "http://127.0.0.1:$PORT/pubkey" >"$WORK/pubkey2.json"
KEYID2=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1] + "/pubkey2.json", "utf8")).public_key_id)' "$WORK")
echo "public_key_id run1=$KEYID1 run2=$KEYID2"
[ "$KEYID1" = "$KEYID2" ]
VERIFY2=$(node dist/cli/verify.js "$WORK/receipt.json" "$WORK/pub.pem")
echo "verify #2 (after restart): $VERIFY2"
[ "$VERIFY2" = '{"valid":true}' ]

echo "== (4) MCP client capture: image block + receipt =="
node scripts/mcp-check.mjs "http://127.0.0.1:$PORT" "$FIXTURE_URL/article.html"

echo "== (5) tampered receipt must fail verification =="
node -e '
  const fs = require("fs");
  const r = JSON.parse(fs.readFileSync(process.argv[1] + "/receipt.json", "utf8"));
  const c = r.content_hash.split("");
  c[0] = c[0] === "0" ? "1" : "0"; // flip one nibble
  r.content_hash = c.join("");
  fs.writeFileSync(process.argv[1] + "/tampered.json", JSON.stringify(r));
' "$WORK"
if node dist/cli/verify.js "$WORK/tampered.json" "$WORK/pub.pem" >"$WORK/tamper.out"; then
  echo "FAIL: tampered receipt verified"; exit 1
fi
echo "tamper verify output: $(cat "$WORK/tamper.out")"

echo "ACCEPTANCE PASS"
