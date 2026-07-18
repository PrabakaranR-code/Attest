import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';
import type { Config } from '../src/config.js';

/**
 * Dev-environment convenience: this workspace ships Chromium at a fixed path
 * instead of the Playwright-managed download. CI installs the managed browser
 * and ignores this.
 */
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
if (!process.env.ATTEST_CHROMIUM_PATH && existsSync(LOCAL_CHROMIUM)) {
  process.env.ATTEST_CHROMIUM_PATH = LOCAL_CHROMIUM;
}

export function testConfig(overrides: Partial<Config> = {}): Config {
  const base = loadConfig(process.env);
  return {
    ...base,
    keyDir: mkdtempSync(join(tmpdir(), 'attest-test-keys-')),
    port: 0,
    ...overrides,
  };
}
