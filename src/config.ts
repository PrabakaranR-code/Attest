import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo/package root (works from both src/ and dist/). */
export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export interface Config {
  port: number;
  host: string;
  keyDir: string;
  navTimeoutMs: number;
  maxConcurrency: number;
  maxCapturesPerBrowser: number;
  /** Optional explicit Chromium executable (Docker/arm64/custom installs). */
  chromiumPath: string | undefined;
  /** Serialized adblock engine cache file. */
  listCachePath: string;
  /** Allow http(s) URLs to loopback/private ranges (tests, trusted intranets). */
  allowPrivateUrls: boolean;
}

function intEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got ${JSON.stringify(raw)}`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: intEnv(env, 'PORT', 8080),
    host: env.HOST || '0.0.0.0',
    keyDir: env.ATTEST_KEY_DIR || join(PACKAGE_ROOT, '.keys'),
    navTimeoutMs: intEnv(env, 'NAV_TIMEOUT_MS', 30_000),
    maxConcurrency: intEnv(env, 'MAX_CONCURRENCY', 3),
    maxCapturesPerBrowser: intEnv(env, 'MAX_CAPTURES_PER_BROWSER', 50),
    chromiumPath: env.ATTEST_CHROMIUM_PATH || undefined,
    listCachePath: env.ATTEST_LIST_CACHE || join(PACKAGE_ROOT, '.list-cache', 'adblock-engine.bin'),
    allowPrivateUrls: env.ATTEST_ALLOW_PRIVATE === '1' || env.ATTEST_ALLOW_PRIVATE === 'true',
  };
}
