/**
 * Rate discipline for every Flipp call (non-negotiable 19; Technical Architecture, "Rate
 * discipline"). One queue, one request at a time, a minimum gap between them, exponential
 * backoff on any non-200, and a circuit breaker that stays open for half an hour.
 *
 * Flipp publishes no rate limit and no SLA, which is exactly why the client has to impose one:
 * personal-scale traffic is the only pattern this may ever produce.
 */

/** The minimum a well-behaved client leaves between two calls. */
export const MIN_GAP_MS = 500;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 1_000;
const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_OPEN_MS = 30 * 60 * 1_000;

export interface HttpResponse {
  readonly status: number;
  json(): Promise<unknown>;
}

/** One GET. Injected so tests never reach the network (non-negotiable 17). */
export type HttpGet = (url: string, headers: Record<string, string>) => Promise<HttpResponse>;

export interface QueueLogger {
  warn(data: Record<string, unknown>, message: string): void;
  /**
   * Optional, because most callers only want the warnings. The refresh job passes a logger that
   * has it, so the rate discipline is observable in the logs rather than taken on trust (Handoff,
   * Phase 2: "Rate discipline is observable in logs").
   */
  info?(data: Record<string, unknown>, message: string): void;
}

export interface RequestQueueOptions {
  get: HttpGet;
  /**
   * Identifies the app and the host it runs on, so an operator seeing the traffic can tell what
   * it is and where it comes from. Built from HEARTH_ORIGIN.
   */
  userAgent: string;
  logger?: QueueLogger;
  minGapMs?: number;
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
  return `Hearth/1.0 (self-hosted household admin; +${origin})`;
}

/**
 * A search URL carries the user's query string, which is their data. Logs identify the mode and
 * the path, never the terms (Technical Architecture, "Logging"; non-negotiable 3).
 */
function redact(url: string): string {
  const parsed = new URL(url);
  const postalCode = parsed.searchParams.get('postal_code');
  return postalCode === null ? parsed.pathname : `${parsed.pathname}?postal_code=${postalCode}`;
}

export class FlippRequestQueue {
  private readonly options: Required<Omit<RequestQueueOptions, 'logger'>> & {
    logger: QueueLogger | undefined;
  };
  /** The tail of the serialized chain: every request waits for the one before it. */
  private tail: Promise<unknown> = Promise.resolve();
  private lastStartedAt = Number.NEGATIVE_INFINITY;
  private consecutiveFailures = 0;
  private openUntil: number | null = null;

  constructor(options: RequestQueueOptions) {
    this.options = {
      get: options.get,
      userAgent: options.userAgent,
      logger: options.logger,
      minGapMs: options.minGapMs ?? MIN_GAP_MS,
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
    return this.openUntil !== null && this.options.now() < this.openUntil;
  }

  /** Queues one GET behind every request already queued, and resolves with its parsed body. */
  request(url: string): Promise<unknown> {
    const run = this.tail.then(
      () => this.execute(url),
      () => this.execute(url),
    );
    // The chain must not reject, or one failure would poison every request behind it.
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async execute(url: string): Promise<unknown> {
    if (this.isOpen) throw new CircuitOpenError(this.openUntil ?? 0);
    this.openUntil = null;

    let lastError: FlippRequestError | null = null;
    for (let attempt = 1; attempt <= this.options.attempts; attempt += 1) {
      if (attempt > 1) {
        // Exponential: one second, then two, then four.
        const backoffMs = this.options.backoffMs * 2 ** (attempt - 2);
        this.options.logger?.warn(
          { url: redact(url), attempt, backoffMs, status: lastError?.status ?? null },
          'backing off before retrying a Flipp request',
        );
        await this.options.sleep(backoffMs);
      }
      await this.waitForGap();
      const previousStartedAt = this.lastStartedAt;
      this.lastStartedAt = this.options.now();
      // The gap is the evidence that requests are serialized: it is never below the minimum.
      const gapMs = Number.isFinite(previousStartedAt)
        ? this.lastStartedAt - previousStartedAt
        : null;
      try {
        const response = await this.options.get(url, { 'User-Agent': this.options.userAgent });
        this.options.logger?.info?.(
          { url: redact(url), attempt, status: response.status, gapMs },
          'flipp request',
        );
        if (response.status === 200) {
          this.consecutiveFailures = 0;
          return await response.json();
        }
        lastError = new FlippRequestError(url, response.status);
      } catch (error: unknown) {
        lastError = new FlippRequestError(url, null, error);
      }
    }

    this.recordFailure(url, lastError);
    throw lastError ?? new FlippRequestError(url, null);
  }

  private async waitForGap(): Promise<void> {
    // A timer can wake a millisecond early against the clock, so one sleep is not always enough:
    // sleep again until the minimum gap has really passed. Before the first request the gap is
    // negative infinity, so there is nothing to wait for.
    for (;;) {
      const wait = this.lastStartedAt + this.options.minGapMs - this.options.now();
      if (!(wait > 0)) return;
      await this.options.sleep(wait);
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
