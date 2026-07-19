/**
 * Acceptance step (4): MCP client calls attest_capture against the fixture
 * site through the compiled server; asserts an image block and a verifying
 * receipt are present. Usage: node scripts/mcp-check.mjs <serverUrl> <pageUrl>
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const [serverUrl, pageUrl] = process.argv.slice(2);
if (!serverUrl || !pageUrl) {
  console.error('usage: node scripts/mcp-check.mjs <serverUrl> <pageUrl>');
  process.exit(2);
}

const client = new Client({ name: 'attest-acceptance', version: '0.0.1' });
await client.connect(new StreamableHTTPClientTransport(new URL(`${serverUrl}/mcp`)));

const result = await client.callTool({
  name: 'attest_capture',
  arguments: { url: pageUrl, requester_key: 'acceptance-mcp' },
});
await client.close();

const content = result.content ?? [];
const image = content.find((c) => c.type === 'image');
const text = content.find((c) => c.type === 'text');

if (!image || image.mimeType !== 'image/png' || !image.data) {
  console.error('FAIL: no PNG image block in MCP result');
  process.exit(1);
}
if (!text || !text.text.includes('RECEIPT (attest v')) {
  console.error('FAIL: no receipt text block in MCP result');
  process.exit(1);
}
const receipt = JSON.parse(text.text.slice(text.text.indexOf('{', text.text.indexOf('RECEIPT'))));
if (receipt.requester_key !== 'acceptance-mcp' || !receipt.signature) {
  console.error('FAIL: receipt malformed');
  process.exit(1);
}
console.log('MCP CHECK OK');
