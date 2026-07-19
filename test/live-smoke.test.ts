import { rmSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AttestEngine } from '../src/engine/engine.js';
import { verifyReceipt } from '../src/receipt/verify.js';
import { testConfig } from './helpers.js';

/**
 * Optional live-internet smoke test. Always skipped in CI (per spec: CI never
 * touches the live internet). Run locally with ATTEST_LIVE_SMOKE=1.
 */
const runLive = !process.env.CI && process.env.ATTEST_LIVE_SMOKE === '1';

describe.skipIf(!runLive)('live smoke', () => {
  it('captures example.com with a verifying receipt', async () => {
    const config = testConfig({ navTimeoutMs: 30_000 });
    const engine = await AttestEngine.create(config);
    try {
      const res = await engine.capture({ url: 'https://example.com/' });
      expect(res.markdown.toLowerCase()).toContain('example');
      expect(verifyReceipt(res.receipt, engine.pubkey().public_key_pem)).toEqual({ valid: true });
    } finally {
      await engine.close();
      rmSync(config.keyDir, { recursive: true, force: true });
    }
  });
});
