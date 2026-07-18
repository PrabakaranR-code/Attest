import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PlaywrightBlocker } from '@ghostery/adblocker-playwright';
import { log } from '../log.js';

/**
 * Load the adblock engine (EasyList + uBlock lists) from the serialized
 * cache file; only if the cache is absent, fetch the prebuilt lists once and
 * write the cache. CI and tests always run from the committed cache — no
 * live internet required.
 */
export async function loadBlocker(cachePath: string): Promise<PlaywrightBlocker> {
  if (existsSync(cachePath)) {
    log.info('adblock: loading cached engine', { cachePath });
    return PlaywrightBlocker.deserialize(readFileSync(cachePath));
  }
  log.info('adblock: cache missing, fetching prebuilt lists', { cachePath });
  const blocker = await PlaywrightBlocker.fromPrebuiltAdsAndTracking(fetch);
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, Buffer.from(blocker.serialize()));
  return blocker;
}
