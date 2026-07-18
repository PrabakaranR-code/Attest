import { rmSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/api/server.js';
import { AttestEngine } from '../src/engine/engine.js';
import { mountMcp } from '../src/mcp/server.js';
import type { Receipt } from '../src/receipt/types.js';
import { verifyReceipt } from '../src/receipt/verify.js';
import { startFixtureSite } from './fixtures/site.js';
import type { FixtureSite } from './fixtures/site.js';
import { testConfig } from './helpers.js';

interface ContentBlock {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

function receiptFromText(text: string): Receipt {
  const marker = text.indexOf('RECEIPT (attest v');
  const jsonStart = text.indexOf('{', marker);
  return JSON.parse(text.slice(jsonStart)) as Receipt;
}

describe('MCP server (Streamable HTTP)', () => {
  let site: FixtureSite;
  let engine: AttestEngine;
  let app: FastifyInstance;
  let client: Client;
  let config: ReturnType<typeof testConfig>;

  beforeAll(async () => {
    site = await startFixtureSite();
    config = testConfig({ navTimeoutMs: 15_000, allowPrivateUrls: true });
    engine = await AttestEngine.create(config);
    app = buildServer(engine, config);
    mountMcp(app, engine, config);
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    client = new Client({ name: 'attest-test-client', version: '0.0.1' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)),
    );
  });

  afterAll(async () => {
    await client.close();
    await app.close();
    await engine.close();
    await site.close();
    rmSync(config.keyDir, { recursive: true, force: true });
  });

  it('lists the three attest tools with freshness note', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(['attest_capture', 'attest_navigate', 'attest_pubkey']);
    for (const tool of tools) {
      expect(tool.description).toContain(
        'signed receipt with UTC microsecond timestamp; treat retrieved_at as the freshness of this data',
      );
    }
  });

  it('attest_capture returns image block + receipt text that verifies', async () => {
    const result = await client.callTool({
      name: 'attest_capture',
      arguments: { url: `${site.baseUrl}/article.html`, requester_key: 'mcp-e2e' },
    });
    const content = result.content as ContentBlock[];

    const image = content.find((c) => c.type === 'image');
    expect(image?.mimeType).toBe('image/png');
    expect(
      Buffer.from(image?.data ?? '', 'base64')
        .subarray(1, 4)
        .toString(),
    ).toBe('PNG');

    const text = content.find((c) => c.type === 'text');
    expect(text?.text).toContain('The Verified Web Article');
    const receipt = receiptFromText(text?.text ?? '');
    expect(receipt.requester_key).toBe('mcp-e2e');

    const pub = engine.pubkey();
    expect(verifyReceipt(receipt, pub.public_key_pem)).toEqual({ valid: true });
  });

  it('attest_navigate captures the destination with its own receipt', async () => {
    const result = await client.callTool({
      name: 'attest_navigate',
      arguments: { url: `${site.baseUrl}/article.html`, click_selector: '#next-link' },
    });
    const content = result.content as ContentBlock[];
    const text = content.find((c) => c.type === 'text');
    const receipt = receiptFromText(text?.text ?? '');
    expect(receipt.url).toBe(`${site.baseUrl}/destination.html`);
    expect(receipt.requested_url).toBe(`${site.baseUrl}/article.html`);
    expect(content.some((c) => c.type === 'image')).toBe(true);
  });

  it('attest_pubkey returns the PEM and key id', async () => {
    const result = await client.callTool({ name: 'attest_pubkey', arguments: {} });
    const text = (result.content as ContentBlock[]).find((c) => c.type === 'text');
    const pub = JSON.parse(text?.text ?? '{}') as { public_key_pem: string; public_key_id: string };
    expect(pub.public_key_pem).toContain('BEGIN PUBLIC KEY');
    expect(pub.public_key_id).toBe(engine.pubkey().public_key_id);
  });

  it('attest_navigate rejects ambiguous targeting as a tool error', async () => {
    const result = await client.callTool({
      name: 'attest_navigate',
      arguments: { url: `${site.baseUrl}/article.html` },
    });
    expect(result.isError).toBe(true);
  });
});
