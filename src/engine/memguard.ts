import { log } from '../log.js';

/**
 * Memory guard for modest-RAM hosts: when process RSS crosses the limit,
 * trigger the recycle callback (closing the browser frees the bulk of RSS;
 * the next capture relaunches it).
 */
export class MemoryGuard {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly limitMb: number,
    private readonly onExceed: () => void | Promise<void>,
    private readonly rssBytes: () => number = () => process.memoryUsage.rss(),
    private readonly intervalMs = 30_000,
  ) {}

  checkNow(): boolean {
    const rssMb = this.rssBytes() / (1024 * 1024);
    if (rssMb > this.limitMb) {
      log.warn('memguard: RSS over limit, recycling browser', {
        rssMb: Math.round(rssMb),
        limitMb: this.limitMb,
      });
      void this.onExceed();
      return true;
    }
    return false;
  }

  start(): void {
    if (this.timer || this.limitMb <= 0) return;
    this.timer = setInterval(() => this.checkNow(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
