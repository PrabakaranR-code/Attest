# Attest REST API

All request/response bodies are JSON. Errors are `{error, code}`.

## POST /capture

Capture one page.

Request:

```json
{ "url": "https://example.com/", "requester_key": "optional-caller-id", "wait": "load" }
```

- `url` (required) — http(s) only. Localhost and private ranges are rejected unless `ATTEST_ALLOW_PRIVATE` is set.
- `requester_key` (optional) — recorded in the receipt; differentiates identical captures by different callers.
- `wait` (optional) — `"load"` (default) or `"networkidle"`.

Response `200`:

```json
{
  "receipt": { "...": "see docs/receipt-spec.md" },
  "screenshot_base64": "<base64 PNG>",
  "reader_markdown": "# Title\n..."
}
```

## POST /navigate

Open `url`, follow one link on it, and capture the **destination** page. The response has the same shape as `/capture`; the receipt belongs to the destination hop (`requested_url` is the starting URL, `url` is where the click landed).

```json
{ "url": "https://example.com/", "click_selector": "#next" }
{ "url": "https://example.com/", "follow_link_text": "Continue" }
```

Exactly one of `click_selector` / `follow_link_text` is required. `requester_key` and `wait` are accepted as in `/capture`.

## GET /pubkey

```json
{ "public_key_pem": "-----BEGIN PUBLIC KEY-----\n...", "public_key_id": "ab12cd34" }
```

## GET /healthz

```json
{ "ok": true, "browser": true }
```

`browser` reports whether the shared Chromium process is currently connected (it launches lazily on first capture).

## Errors

| Status | Code              | Meaning                                        |
| ------ | ----------------- | ---------------------------------------------- |
| 400    | `INVALID_REQUEST` | Body failed validation                         |
| 400    | `INVALID_URL`     | Not a valid http(s) URL                        |
| 400    | `SSRF_BLOCKED`    | Localhost/private-range target                 |
| 400    | `NAVIGATE_TARGET` | Selector/link text matched nothing on the page |
| 408    | `NAV_TIMEOUT`     | Navigation exceeded `NAV_TIMEOUT_MS`           |
| 429    | `QUEUE_FULL`      | Capture queue backlog exceeded                 |
| 502    | `LOAD_FAILURE`    | Page failed to load                            |
| 500    | `INTERNAL`        | Unexpected engine error                        |

## MCP door

`POST /mcp` is a stateless MCP Streamable HTTP endpoint exposing `attest_capture`, `attest_navigate` (same inputs as REST, snake_case), and `attest_pubkey`. Tool results carry the reader markdown + receipt as text content and the screenshot as an image content block.
