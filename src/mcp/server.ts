import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Config } from '../config.js';
import type { AttestEngine, EngineResponse } from '../engine/engine.js';
import { assertAllowedUrl } from '../api/ssrf.js';
import { ENGINE_VERSION } from '../version.js';

const FRESHNESS_NOTE =
  'Result includes a signed receipt with UTC microsecond timestamp; treat retrieved_at as the freshness of this data.';

function toolResult(res: EngineResponse) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `${res.markdown}\n---\nRECEIPT (attest v${res.receipt.attest_version}):\n${JSON.stringify(res.receipt, null, 2)}`,
      },
      {
        type: 'image' as const,
        data: res.screenshot.toString('base64'),
        mimeType: 'image/png',
      },
    ],
  };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

export function buildMcpServer(engine: AttestEngine, config: Config): McpServer {
  const server = new McpServer({ name: 'attest', version: ENGINE_VERSION });

  server.registerTool(
    'attest_capture',
    {
      description:
        'Capture a live web page: ad-blocked full-page screenshot plus reader-mode Markdown, ' +
        `with a signed receipt proving what was captured, from where, and when. ${FRESHNESS_NOTE}`,
      inputSchema: {
        url: z.string().describe('The http(s) URL to capture'),
        requester_key: z
          .string()
          .optional()
          .describe('Optional caller identity recorded in the receipt'),
        wait: z.enum(['load', 'networkidle']).optional().describe('Navigation wait strategy'),
      },
    },
    async ({ url, requester_key, wait }) => {
      try {
        await assertAllowedUrl(url, config.allowPrivateUrls);
        const res = await engine.capture({ url, requesterKey: requester_key ?? null, wait });
        return toolResult(res);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'attest_navigate',
    {
      description:
        'Open a web page, follow a link on it (by CSS selector or visible link text), and capture ' +
        `the destination page with its own fresh signed receipt. ${FRESHNESS_NOTE}`,
      inputSchema: {
        url: z.string().describe('The http(s) URL of the starting page'),
        click_selector: z.string().optional().describe('CSS selector of the element to click'),
        follow_link_text: z.string().optional().describe('Visible text of the link to follow'),
        requester_key: z
          .string()
          .optional()
          .describe('Optional caller identity recorded in the receipt'),
        wait: z.enum(['load', 'networkidle']).optional().describe('Navigation wait strategy'),
      },
    },
    async ({ url, click_selector, follow_link_text, requester_key, wait }) => {
      try {
        if ((click_selector ? 1 : 0) + (follow_link_text ? 1 : 0) !== 1) {
          throw new Error('provide exactly one of click_selector or follow_link_text');
        }
        await assertAllowedUrl(url, config.allowPrivateUrls);
        const res = await engine.navigate({
          url,
          clickSelector: click_selector,
          followLinkText: follow_link_text,
          requesterKey: requester_key ?? null,
          wait,
        });
        return toolResult(res);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'attest_pubkey',
    {
      description:
        'Return the engine Ed25519 public key (PEM) and public_key_id used to verify Attest ' +
        `receipts offline. ${FRESHNESS_NOTE}`,
      inputSchema: {},
    },
    async () => ({
      content: [{ type: 'text' as const, text: JSON.stringify(engine.pubkey(), null, 2) }],
    }),
  );

  return server;
}

/**
 * Mount the MCP door on the shared Fastify instance as a stateless
 * Streamable HTTP endpoint at /mcp: one transport+server pair per request.
 */
export function mountMcp(app: FastifyInstance, engine: AttestEngine, config: Config): void {
  app.post('/mcp', async (request, reply) => {
    const server = buildMcpServer(engine, config);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    reply.hijack();
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  for (const method of ['GET', 'DELETE'] as const) {
    app.route({
      method,
      url: '/mcp',
      handler: async (_request, reply) =>
        reply.status(405).send({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Method not allowed: stateless transport' },
          id: null,
        }),
    });
  }
}
