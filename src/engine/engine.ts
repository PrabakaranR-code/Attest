import type { PlaywrightBlocker } from '@ghostery/adblocker-playwright';
import type { Config } from '../config.js';
import { log } from '../log.js';
import { artifactFor, buildReceipt } from '../receipt/build.js';
import { loadOrCreateKeys } from '../receipt/keys.js';
import type { EngineKeys } from '../receipt/keys.js';
import type { Receipt } from '../receipt/types.js';
import { loadBlocker } from './blocker.js';
import { BrowserManager } from './browser.js';
import { capturePage } from './capture.js';
import type { WaitStrategy } from './capture.js';
import { CaptureQueue } from './queue.js';

export interface CaptureRequest {
  url: string;
  requesterKey?: string | null;
  wait?: WaitStrategy;
}

export interface NavigateRequest extends CaptureRequest {
  clickSelector?: string;
  followLinkText?: string;
}

export interface EngineResponse {
  receipt: Receipt;
  screenshot: Buffer;
  markdown: string;
  blockedRequests: number;
}

/**
 * The one engine behind both doors (REST + MCP). Stateless by design: nothing
 * about a capture is retained; the signing keypair is the only persisted state.
 */
export class AttestEngine {
  private constructor(
    private readonly config: Config,
    private readonly keys: EngineKeys,
    private readonly blocker: PlaywrightBlocker,
    private readonly browsers: BrowserManager,
    private readonly queue: CaptureQueue,
  ) {}

  static async create(config: Config): Promise<AttestEngine> {
    const keys = loadOrCreateKeys(config.keyDir);
    log.info('engine: keys ready', { publicKeyId: keys.publicKeyId, keyDir: config.keyDir });
    const blocker = await loadBlocker(config.listCachePath);
    const browsers = new BrowserManager({
      chromiumPath: config.chromiumPath,
      maxCapturesPerBrowser: config.maxCapturesPerBrowser,
    });
    const queue = new CaptureQueue(config.maxConcurrency);
    return new AttestEngine(config, keys, blocker, browsers, queue);
  }

  async capture(req: CaptureRequest): Promise<EngineResponse> {
    return this.run(req, {});
  }

  async navigate(req: NavigateRequest): Promise<EngineResponse> {
    return this.run(req, {
      clickSelector: req.clickSelector,
      followLinkText: req.followLinkText,
    });
  }

  private async run(
    req: CaptureRequest,
    nav: { clickSelector?: string; followLinkText?: string },
  ): Promise<EngineResponse> {
    return this.queue.run(async () => {
      const browser = await this.browsers.getBrowser();
      const started = Date.now();
      const result = await capturePage(browser, this.blocker, req.url, {
        wait: req.wait,
        navTimeoutMs: this.config.navTimeoutMs,
        clickSelector: nav.clickSelector,
        followLinkText: nav.followLinkText,
      });
      this.browsers.noteCapture();

      const screenshotArtifact = artifactFor('screenshot', 'image/png', result.screenshot);
      const readerArtifact = artifactFor(
        'reader',
        'text/markdown',
        Buffer.from(result.markdown, 'utf8'),
      );
      const receipt = buildReceipt(
        {
          url: result.finalUrl,
          requestedUrl: req.url,
          requesterKey: req.requesterKey ?? null,
          artifacts: [screenshotArtifact, readerArtifact],
          publicKeyId: this.keys.publicKeyId,
        },
        this.keys.privateKey,
      );

      log.info('capture: done', {
        url: result.finalUrl,
        ms: Date.now() - started,
        screenshotBytes: screenshotArtifact.bytes,
        markdownBytes: readerArtifact.bytes,
        blockedRequests: result.blockedRequests,
      });

      return {
        receipt,
        screenshot: result.screenshot,
        markdown: result.markdown,
        blockedRequests: result.blockedRequests,
      };
    });
  }

  pubkey(): { public_key_pem: string; public_key_id: string } {
    return { public_key_pem: this.keys.publicKeyPem, public_key_id: this.keys.publicKeyId };
  }

  health(): { ok: boolean; browser: boolean } {
    return { ok: true, browser: this.browsers.isConnected() };
  }

  async close(): Promise<void> {
    await this.browsers.close();
  }
}
