import type { PlaywrightBlocker } from '@ghostery/adblocker-playwright';
import type { Browser, Page } from 'playwright';
import { NavigateTargetError, NavTimeoutError, LoadFailureError } from './errors.js';
import { preparePage } from './pageprep.js';
import { extractReaderMarkdown } from './reader.js';

export type WaitStrategy = 'load' | 'networkidle';

export interface CaptureOptions {
  wait?: WaitStrategy;
  navTimeoutMs: number;
  /** /navigate: CSS selector to click on the loaded page. */
  clickSelector?: string;
  /** /navigate: visible link text to follow on the loaded page. */
  followLinkText?: string;
}

export interface PageCapture {
  finalUrl: string;
  screenshot: Buffer;
  markdown: string;
  blockedRequests: number;
}

function translateNavError(err: unknown, url: string): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/Timeout .* exceeded|TimeoutError/i.test(message)) return new NavTimeoutError(url);
  return new LoadFailureError(url, message.split('\n')[0] ?? 'unknown error');
}

/**
 * Capture one page in a fresh, throwaway browser context: enable network-layer
 * ad blocking, navigate, optionally follow a link/click (each hop receipted by
 * the caller), prep the page, and produce screenshot + reader markdown.
 */
export async function capturePage(
  browser: Browser,
  blocker: PlaywrightBlocker,
  url: string,
  opts: CaptureOptions,
): Promise<PageCapture> {
  const wait: WaitStrategy = opts.wait ?? 'load';
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  try {
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(opts.navTimeoutMs);

    let blockedRequests = 0;
    const onBlocked = () => {
      blockedRequests += 1;
    };
    blocker.on('request-blocked', onBlocked);
    try {
      await blocker.enableBlockingInPage(page);

      try {
        await page.goto(url, { waitUntil: wait, timeout: opts.navTimeoutMs });
      } catch (err) {
        throw translateNavError(err, url);
      }

      if (opts.clickSelector || opts.followLinkText) {
        await followNavigation(page, opts, wait);
      }

      await preparePage(page);

      const finalUrl = page.url();
      const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
      const html = await page.content();
      const markdown = extractReaderMarkdown(html, finalUrl);
      return { finalUrl, screenshot, markdown, blockedRequests };
    } finally {
      blocker.unsubscribe('request-blocked', onBlocked);
    }
  } finally {
    await context.close().catch(() => {});
  }
}

async function followNavigation(page: Page, opts: CaptureOptions, wait: WaitStrategy) {
  const target = opts.clickSelector
    ? page.locator(opts.clickSelector).first()
    : page.getByRole('link', { name: opts.followLinkText, exact: false }).first();

  if ((await target.count()) === 0) {
    throw new NavigateTargetError(
      opts.clickSelector
        ? `no element matches selector ${JSON.stringify(opts.clickSelector)}`
        : `no link with text ${JSON.stringify(opts.followLinkText)}`,
    );
  }

  const sourceUrl = page.url();
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: wait, timeout: opts.navTimeoutMs }),
      target.click({ timeout: opts.navTimeoutMs }),
    ]);
  } catch (err) {
    throw translateNavError(err, sourceUrl);
  }
}
