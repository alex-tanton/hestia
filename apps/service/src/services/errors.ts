import { createHash } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { SCRUBBED_MESSAGE_MAX_LENGTH, scrubErrorReport } from '@hestia/shared';
import type { Database } from '../db.js';

export type ErrorSource = 'service' | 'web';

export interface ErrorRecord {
  fingerprint: string;
  message: string;
}

/**
 * The `app_error` fingerprint: SHA-256, lowercase hex, of the source, the error name, and the route
 * or job name, joined by newlines.
 */
export function errorFingerprint(source: ErrorSource, name: string, route: string): string {
  return createHash('sha256').update(`${source}\n${name}\n${route}`, 'utf8').digest('hex');
}

/**
 * Builds the record from raw fields, scrubbing every one first. The fingerprint is computed from
 * the scrubbed name and route, so two reports of the same failure group together even when their
 * raw paths differed only in something scrubbed away.
 */
export function buildErrorRecord(
  source: ErrorSource,
  raw: { name?: unknown; message?: unknown; route?: unknown },
): ErrorRecord {
  const { name, message, route } = scrubErrorReport(raw);
  const text = `${name} at ${route}: ${message}`;
  return {
    fingerprint: errorFingerprint(source, name, route),
    message: text.slice(0, SCRUBBED_MESSAGE_MAX_LENGTH),
  };
}

/** Records through `public.record_app_error`; `db` must be an anon transaction (withAnonDb). */
export async function recordAppError(db: Kysely<Database>, record: ErrorRecord): Promise<void> {
  await sql`select public.record_app_error(${record.fingerprint}, ${record.message})`.execute(db);
}
