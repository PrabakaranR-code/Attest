import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import type { Config } from '../config.js';
import type { AttestEngine, EngineResponse } from '../engine/engine.js';
import {
  LoadFailureError,
  NavTimeoutError,
  NavigateTargetError,
  QueueFullError,
} from '../engine/errors.js';
import { log } from '../log.js';
import { captureBodySchema, navigateBodySchema } from './schemas.js';
import { assertAllowedUrl, InvalidUrlError, SsrfBlockedError } from './ssrf.js';

function respond(reply: FastifyReply, res: EngineResponse) {
  return reply.send({
    receipt: res.receipt,
    screenshot_base64: res.screenshot.toString('base64'),
    reader_markdown: res.markdown,
  });
}

function sendError(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({ error: message, code });
}

function handleFailure(reply: FastifyReply, err: unknown) {
  if (err instanceof ZodError) {
    return sendError(reply, 400, 'INVALID_REQUEST', err.issues[0]?.message ?? 'invalid request');
  }
  if (err instanceof InvalidUrlError) return sendError(reply, 400, err.code, err.message);
  if (err instanceof SsrfBlockedError) return sendError(reply, 400, err.code, err.message);
  if (err instanceof NavigateTargetError) return sendError(reply, 400, err.code, err.message);
  if (err instanceof NavTimeoutError) return sendError(reply, 408, err.code, err.message);
  if (err instanceof QueueFullError) return sendError(reply, 429, err.code, err.message);
  if (err instanceof LoadFailureError) return sendError(reply, 502, err.code, err.message);
  log.error('api: unexpected error', { error: err instanceof Error ? err.message : String(err) });
  return sendError(reply, 500, 'INTERNAL', 'internal error');
}

export function buildServer(engine: AttestEngine, config: Config): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });

  app.post('/capture', async (request, reply) => {
    try {
      const body = captureBodySchema.parse(request.body ?? {});
      await assertAllowedUrl(body.url, config.allowPrivateUrls);
      const res = await engine.capture({
        url: body.url,
        requesterKey: body.requester_key ?? null,
        wait: body.wait,
      });
      return await respond(reply, res);
    } catch (err) {
      return handleFailure(reply, err);
    }
  });

  app.post('/navigate', async (request, reply) => {
    try {
      const body = navigateBodySchema.parse(request.body ?? {});
      await assertAllowedUrl(body.url, config.allowPrivateUrls);
      const res = await engine.navigate({
        url: body.url,
        clickSelector: body.click_selector,
        followLinkText: body.follow_link_text,
        requesterKey: body.requester_key ?? null,
        wait: body.wait,
      });
      return await respond(reply, res);
    } catch (err) {
      return handleFailure(reply, err);
    }
  });

  app.get('/pubkey', async () => engine.pubkey());

  app.get('/healthz', async () => engine.health());

  return app;
}
