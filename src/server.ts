#!/usr/bin/env node
/** Attest entrypoint: one engine, two doors (REST + MCP over Streamable HTTP). */
import { buildServer } from './api/server.js';
import { loadConfig } from './config.js';
import { AttestEngine } from './engine/engine.js';
import { log } from './log.js';
import { mountMcp } from './mcp/server.js';

const config = loadConfig();
const engine = await AttestEngine.create(config);
const app = buildServer(engine, config);
mountMcp(app, engine, config);

await app.listen({ port: config.port, host: config.host });
log.info('attest: listening', { port: config.port, host: config.host });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    log.info(`attest: ${signal}, shutting down`);
    void Promise.allSettled([app.close(), engine.close()]).then(() => process.exit(0));
  });
}
