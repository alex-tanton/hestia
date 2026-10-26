import { composeChecked } from './compose.ts';

/**
 * The service's own structured log, read back out of the running container. Pino writes one JSON
 * object per line;
 * `--no-log-prefix` is what keeps Compose from gluing a `hestia-service-1  |` tag onto the front of
 * each one, which would otherwise stop it parsing as JSON.
 */
export interface ServiceLogLine {
  readonly level: number;
  readonly msg?: string;
  readonly [field: string]: unknown;
}

/** Every line the service has logged since the container started, oldest first. */
export function serviceLogLines(): ServiceLogLine[] {
  const output = composeChecked(['logs', '--no-color', '--no-log-prefix', 'hestia-service']);
  const lines: ServiceLogLine[] = [];
  for (const line of output.split('\n')) {
    if (line.trim() === '') continue;
    try {
      lines.push(JSON.parse(line) as ServiceLogLine);
    } catch {
      // A line the service printed that is not JSON (a stack trace's continuation line, say);
      // nothing this suite reads needs it.
    }
  }
  return lines;
}

/**
 * Every Flipp request the request queue made, in order (`request-queue.ts`, "flipp request"):
 * mode and path with the gap since the request before it, so the rate discipline is readable
 * rather than assumed. E2E never calls Flipp live, so every one of these came from the fixture
 * transport, and this is that call count.
 */
export function flippRequestLines(lines: readonly ServiceLogLine[]): ServiceLogLine[] {
  return lines.filter((line) => line.msg === 'flipp request');
}

/** The redacted path a "flipp request" line carries, or '' for a line that has none. */
export function urlOf(line: ServiceLogLine): string {
  return typeof line['url'] === 'string' ? line['url'] : '';
}
