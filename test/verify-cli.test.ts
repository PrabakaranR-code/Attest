import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { artifactFor, buildReceipt } from '../src/receipt/build.js';
import { loadOrCreateKeys } from '../src/receipt/keys.js';

const workDir = mkdtempSync(join(tmpdir(), 'attest-cli-'));
afterAll(() => rmSync(workDir, { recursive: true, force: true }));

function runVerify(args: string[]) {
  const tsx = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  return spawnSync(process.execPath, [tsx, 'src/cli/verify.ts', ...args], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
}

describe('verify CLI', () => {
  const keys = loadOrCreateKeys(join(workDir, 'keys'));
  const receipt = buildReceipt(
    {
      url: 'https://example.com/',
      requestedUrl: 'https://example.com/',
      artifacts: [artifactFor('reader', 'text/markdown', Buffer.from('cli test'))],
      publicKeyId: keys.publicKeyId,
    },
    keys.privateKey,
  );
  const receiptPath = join(workDir, 'receipt.json');
  const pubPath = join(workDir, 'pub.pem');
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  writeFileSync(pubPath, keys.publicKeyPem);

  it('prints {"valid":true} and exits 0 for a good receipt', () => {
    const res = runVerify([receiptPath, pubPath]);
    expect(res.status).toBe(0);
    expect(JSON.parse(res.stdout)).toEqual({ valid: true });
  });

  it('exits 1 for a tampered receipt', () => {
    const tamperedPath = join(workDir, 'tampered.json');
    writeFileSync(tamperedPath, JSON.stringify({ ...receipt, url: 'https://evil.example.com/' }));
    const res = runVerify([tamperedPath, pubPath]);
    expect(res.status).toBe(1);
    expect(JSON.parse(res.stdout).valid).toBe(false);
  });
});
