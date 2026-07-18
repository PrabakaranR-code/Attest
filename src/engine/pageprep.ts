import type { Page } from 'playwright';

/** Common consent-banner accept buttons, tried best-effort before capture. */
const CONSENT_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '#didomi-notice-agree-button',
  '.fc-cta-consent',
  '#sp-cc-accept',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  'button#truste-consent-button',
  '#cookie-accept',
  'button[aria-label="Accept all" i]',
  'button[aria-label="Accept cookies" i]',
];

/**
 * Best-effort page preparation before capture: dismiss consent banners,
 * auto-scroll to the bottom and back to trigger lazy-loaded content, then
 * settle briefly.
 */
export async function preparePage(page: Page, settleMs = 300): Promise<void> {
  for (const selector of CONSENT_SELECTORS) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 100 })) {
        await el.click({ timeout: 1_000 });
      }
    } catch {
      // Banner not present or not clickable — never fail a capture over it.
    }
  }

  try {
    await page.evaluate(async () => {
      const step = window.innerHeight;
      const limit = 50; // hard cap for infinite-scroll pages
      for (let i = 0; i < limit; i++) {
        const bottom = document.documentElement.scrollHeight - window.innerHeight;
        if (window.scrollY >= bottom - 2) break;
        window.scrollBy(0, step);
        await new Promise((r) => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });
  } catch {
    // Scrolling can fail on odd pages (e.g. no document element); ignore.
  }

  await page.waitForTimeout(settleMs);
}
