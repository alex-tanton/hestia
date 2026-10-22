import { scrubErrorReport } from '@hearth/shared';

/**
 * Unexpected errors are reported to `POST /api/client-error` after passing through the shared
 * scrubbing function, so nothing that reaches the server names a bill amount, a list's contents,
 * or an address. There is no
 * third-party error SDK, and at most ten reports leave a page load.
 */
export const MAX_REPORTS_PER_PAGE_LOAD = 10;

let reportsSent = 0;

export function reportClientError(error: unknown, route: string = window.location.pathname): void {
  if (reportsSent >= MAX_REPORTS_PER_PAGE_LOAD) return;
  reportsSent += 1;

  const report = scrubErrorReport({
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
    route,
  });

  // The report is best-effort: a failure here must never surface or recurse.
  void fetch('/api/client-error', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(report),
    keepalive: true,
  }).catch(() => undefined);
}

/** Global `error` and `unhandledrejection` handlers, installed once at startup. */
export function installErrorReporting(): void {
  window.addEventListener('error', (event) => {
    reportClientError(event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason);
  });
}
