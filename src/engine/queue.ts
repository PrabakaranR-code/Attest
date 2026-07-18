import { QueueFullError } from './errors.js';

/**
 * Small FIFO queue bounding concurrent captures. Rejects new work with
 * QueueFullError once the backlog exceeds maxQueued (→ HTTP 429).
 */
export class CaptureQueue {
  private running = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    private readonly concurrency: number,
    private readonly maxQueued: number = concurrency * 4,
  ) {}

  get backlog(): number {
    return this.waiting.length;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.concurrency) {
      if (this.waiting.length >= this.maxQueued) throw new QueueFullError();
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running += 1;
    try {
      return await fn();
    } finally {
      this.running -= 1;
      this.waiting.shift()?.();
    }
  }
}
