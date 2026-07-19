import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { log } from '../log.js';

export interface BrowserManagerOptions {
  chromiumPath?: string | undefined;
  maxCapturesPerBrowser: number;
}

/**
 * Owns the single shared Chromium process: lazy launch, relaunch after a
 * crash/disconnect, and recycle after maxCapturesPerBrowser captures to
 * bound memory growth on small VPSes.
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private captures = 0;
  private launching: Promise<Browser> | null = null;

  constructor(private readonly opts: BrowserManagerOptions) {}

  async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected() && this.captures < this.opts.maxCapturesPerBrowser) {
      return this.browser;
    }
    if (this.launching) return this.launching;

    this.launching = (async () => {
      if (this.browser?.isConnected()) {
        log.info('browser: recycling after capture limit', { captures: this.captures });
        await this.browser.close().catch(() => {});
      } else if (this.browser) {
        log.warn('browser: previous process disconnected, relaunching');
      }
      this.browser = await chromium.launch({
        executablePath: this.opts.chromiumPath,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
      this.captures = 0;
      log.info('browser: launched', { version: this.browser.version() });
      return this.browser;
    })();

    try {
      return await this.launching;
    } finally {
      this.launching = null;
    }
  }

  noteCapture(): void {
    this.captures += 1;
  }

  isConnected(): boolean {
    return this.browser?.isConnected() ?? false;
  }

  /** Close the current browser; the next capture relaunches a fresh one. */
  async forceRecycle(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    this.captures = 0;
    await browser?.close().catch(() => {});
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => {});
    this.browser = null;
  }
}
