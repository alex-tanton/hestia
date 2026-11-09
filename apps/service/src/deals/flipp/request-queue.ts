/**
 * Rate discipline for every Flipp call. Bounded concurrency worker pool with minimum gap pacing,
 * exponential backoff on any non-200, and a circuit breaker that stays open for half an hour.
 *
 * Flipp publishes no rate limit and no SLA, which is exactly why the client has to impose one:
 * personal-scale traffic is the only pattern this may ever produce.
 */

/** The minimum a well-behaved client leaves between two calls. */
export const MIN_GAP_MS = 150;
export const DEFAULT_CONCURRENCY = 4;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 1_000;
const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_OPEN_MS = 30 * 60 * 1_000;

export interface HttpResponse {
  readonly status: number;
  json(): Promise<unknown>;
}

/** One GET. Injected so tests never reach the network. */
export type HttpGet = (url: string, headers: Record<string, string>) => Promise<HttpResponse>;

export interface QueueLogger {
  warn(data: Record<string, unknown>, message: string): void;
  /**
   * Optional, because most callers only want the warnings. The refresh job passes a logger that has
   * it, so the rate discipline is observable in the logs rather than taken on trust.
   */
  info?(data: Record<string, unknown>, message: string): void;
}

export interface RequestQueueOptions {
  get: HttpGet;
  /**
   * Identifies the app and the host it runs on, so an operator seeing the traffic can tell what
   * it is and where it comes from. Built from HESTIA_ORIGIN.
   */
  userAgent: string;
  logger?: QueueLogger;
  minGapMs?: number;
  concurrency?: number;
  attempts?: number;
  backoffMs?: number;
  failureThreshold?: number;
  openMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Thrown when the breaker is open. Callers abandon the work rather than writing part of it. */
export class CircuitOpenError extends Error {
  readonly openUntil: number;

  constructor(openUntil: number) {
    super('The Flipp circuit breaker is open');
    this.name = 'CircuitOpenError';
    this.openUntil = openUntil;
  }
}

export class FlippRequestError extends Error {
  readonly url: string;
  readonly status: number | null;

  constructor(url: string, status: number | null, cause?: unknown) {
    super(
      `Flipp request failed (${status === null ? 'transport error' : String(status)}): ${url}`,
      {
        cause,
      },
    );
    this.name = 'FlippRequestError';
    this.url = url;
    this.status = status;
  }
}

/** The default transport: the platform's fetch, with no cookies, key, or Referer — none is needed. */
export const fetchGet: HttpGet = async (url, headers) => {
  const response = await fetch(url, { headers, redirect: 'follow' });
  return { status: response.status, json: () => response.json() };
};

export function buildUserAgent(origin: string): string {
  return `Hestia/1.0 (self-hosted household admin; +${origin})`;
}

/**
 * A search URL carries the user's query string, which is their data. Logs identify the mode and
 * the path, never the terms.
 */
function redact(url: string): string {
  const parsed = new URL(url);
  const postalCode = parsed.searchParams.get('postal_code');
  return postalCode === null ? parsed.pathname : `${parsed.pathname}?postal_code=${postalCode}`;
}

interface QueuedTask {
  url: string;
  resolve: (val: unknown) => void;
  reject: (err: unknown) => void;
}

const noop = (): void => undefined;

export class FlippRequestQueue {
  private readonly options: Required<Omit<RequestQueueOptions, 'logger'>> & {
    logger: QueueLogger | undefined;
  };
  private readonly queue: QueuedTask[] = [];
  private activeWorkers = 0;
  private lastDispatchedAt = Number.NEGATIVE_INFINITY;
  private consecutiveFailures = 0;
  private openUntil: number | null = null;
  private pacingTail: Promise<void> = Promise.resolve();

  constructor(options: RequestQueueOptions) {
    this.options = {
      get: options.get,
      userAgent: options.userAgent,
      logger: options.logger,
      minGapMs: options.minGapMs ?? MIN_GAP_MS,
      concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
      attempts: options.attempts ?? DEFAULT_ATTEMPTS,
      backoffMs: options.backoffMs ?? DEFAULT_BACKOFF_MS,
      failureThreshold: options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD,
      openMs: options.openMs ?? DEFAULT_OPEN_MS,
      now: options.now ?? (() => Date.now()),
      sleep: options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    };
  }

  /** True while the breaker is open; the daily refresh checks it before starting more work. */
  get isOpen(): boolean {
    return this.isCircuitOpen();
  }

  get activeCount(): number {
    return this.activeWorkers;
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  private isCircuitOpen(): boolean {
    return this.openUntil !== null && this.options.now() < this.openUntil;
  }

  private getOpenUntil(): number {
    return this.openUntil ?? 0;
  }

  /** Queues one GET into the bounded worker pool, and resolves with its parsed body. */
  request(url: string): Promise<unknown> {
    if (this.isCircuitOpen()) {
      return Promise.reject(new CircuitOpenError(this.getOpenUntil()));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ url, resolve, reject });
      this.drainQueue();
    });
  }

  private drainQueue(): void {
    if (this.isCircuitOpen()) {
      this.flushQueueOnBreakerOpen();
      return;
    }
    while (this.activeWorkers < this.options.concurrency && this.queue.length > 0) {
      if (this.isCircuitOpen()) {
        this.flushQueueOnBreakerOpen();
        break;
      }
      const task = this.queue.shift();
      if (!task) break;
      this.activeWorkers += 1;
      void this.runWorker(task).finally(() => {
        this.activeWorkers -= 1;
        this.drainQueue();
      });
    }
  }

  private async runWorker(task: QueuedTask): Promise<void> {
    try {
      const result = await this.execute(task.url);
      task.resolve(result);
    } catch (error: unknown) {
      task.reject(error);
    }
  }

  private async execute(url: string): Promise<unknown> {
    if (this.isCircuitOpen()) throw new CircuitOpenError(this.getOpenUntil());
    this.openUntil = null;

    let lastError: FlippRequestError | null = null;
    for (let attempt = 1; attempt <= this.options.attempts; attempt += 1) {
      if (this.isCircuitOpen()) throw new CircuitOpenError(this.getOpenUntil());

      if (attempt > 1) {
        const backoffMs = this.options.backoffMs * 2 ** (attempt - 2);
        this.options.logger?.warn(
          { url: redact(url), attempt, backoffMs, status: lastError?.status ?? null },
          'backing off before retrying a Flipp request',
        );
        await this.options.sleep(backoffMs);
      }

      if (this.isCircuitOpen()) throw new CircuitOpenError(this.getOpenUntil());

      const gapMs = await this.waitForGap();

      if (this.isCircuitOpen()) throw new CircuitOpenError(this.getOpenUntil());

      try {
        const response = await this.options.get(url, { 'User-Agent': this.options.userAgent });
        this.options.logger?.info?.(
          { url: redact(url), attempt, status: response.status, gapMs },
          'flipp request',
        );

        if (this.isCircuitOpen()) throw new CircuitOpenError(this.getOpenUntil());

        if (response.status === 200) {
          this.consecutiveFailures = 0;
          return await response.json();
        }
        lastError = new FlippRequestError(url, response.status);
      } catch (error: unknown) {
        if (error instanceof CircuitOpenError) throw error;
        lastError = new FlippRequestError(url, null, error);
      }
    }

    this.recordFailure(url, lastError);
    if (this.isCircuitOpen()) {
      this.flushQueueOnBreakerOpen();
    }
    throw lastError ?? new FlippRequestError(url, null);
  }

  private async waitForGap(): Promise<number | null> {
    const previous = this.pacingTail;
    let release!: () => void;
    this.pacingTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous.catch(noop);

    try {
      if (this.isCircuitOpen()) throw new CircuitOpenError(this.getOpenUntil());
      for (;;) {
        const wait = this.lastDispatchedAt + this.options.minGapMs - this.options.now();
        if (!(wait > 0)) break;
        await this.options.sleep(wait);
      }
      const previousDispatchedAt = this.lastDispatchedAt;
      this.lastDispatchedAt = this.options.now();
      return Number.isFinite(previousDispatchedAt)
        ? this.lastDispatchedAt - previousDispatchedAt
        : null;
    } finally {
      release();
    }
  }

  private flushQueueOnBreakerOpen(): void {
    const openUntil = this.getOpenUntil();
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        task.reject(new CircuitOpenError(openUntil));
      }
    }
  }

  private recordFailure(url: string, error: FlippRequestError | null): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures < this.options.failureThreshold) return;
    this.openUntil = this.options.now() + this.options.openMs;
    this.consecutiveFailures = 0;
    this.options.logger?.warn(
      { url: redact(url), status: error?.status ?? null, openMs: this.options.openMs },
      'Flipp circuit breaker opened after consecutive failures',
    );
  }
}
