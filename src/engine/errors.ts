/** Typed engine errors, mapped to HTTP codes at the API layer. */

export class NavTimeoutError extends Error {
  readonly code = 'NAV_TIMEOUT';
  constructor(url: string) {
    super(`navigation timed out for ${url}`);
  }
}

export class LoadFailureError extends Error {
  readonly code = 'LOAD_FAILURE';
  constructor(url: string, cause: string) {
    super(`failed to load ${url}: ${cause}`);
  }
}

export class QueueFullError extends Error {
  readonly code = 'QUEUE_FULL';
  constructor() {
    super('capture queue is full, retry later');
  }
}

export class NavigateTargetError extends Error {
  readonly code = 'NAVIGATE_TARGET';
  constructor(detail: string) {
    super(detail);
  }
}
