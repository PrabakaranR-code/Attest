#!/usr/bin/env node
/**
 * Offline receipt verifier CLI.
 *
 *   npm run verify -- receipt.json [pub.pem]
 *
 * The public key is taken from the second argument, or from
 * $ATTEST_KEY_DIR/attest-public.pem when omitted. Prints a JSON result and
 * exits 0 when valid, 1 otherwise.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyReceipt } from '../receipt/verify.js';
import { PUBLIC_KEY_FILE } from '../receipt/keys.js';
import type { Receipt } from '../receipt/types.js';

function fail(reason: string): never {
  console.log(JSON.stringify({ valid: false, reason }));
  process.exit(1);
}

const [receiptPath, pubKeyPath] = process.argv.slice(2);
if (!receiptPath) {
  console.error('usage: npm run verify -- receipt.json [pub.pem]');
  process.exit(2);
}

let receipt: Receipt;
try {
  receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as Receipt;
} catch (err) {
  fail(`cannot read receipt: ${(err as Error).message}`);
}

const resolvedPubPath =
  pubKeyPath ??
  (process.env.ATTEST_KEY_DIR ? join(process.env.ATTEST_KEY_DIR, PUBLIC_KEY_FILE) : undefined);
if (!resolvedPubPath) {
  fail('no public key: pass pub.pem as second argument or set ATTEST_KEY_DIR');
}

let publicKeyPem: string;
try {
  publicKeyPem = readFileSync(resolvedPubPath, 'utf8');
} catch (err) {
  fail(`cannot read public key: ${(err as Error).message}`);
}

const result = verifyReceipt(receipt, publicKeyPem);
console.log(JSON.stringify(result));
process.exit(result.valid ? 0 : 1);
