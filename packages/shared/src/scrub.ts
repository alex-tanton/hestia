/**
 * Error scrubbing.
 *
 * A recorded error may name a route, a job, a user id, or a household id. It must never carry a
 * bill amount, list or pantry contents, recipe data, an email address, or an auth token. The
 * service and the PWA both pass everything bound for `app_error` or the logs through here.
 *
 * Free text cannot be understood, so it is scrubbed by shape and errs towards removing too much:
 * anything quoted or bracketed (where user data sits in almost every error message), every URL,
 * every decimal or long number, every currency amount, and every value after a key that names a
 * secret or household content is removed, as are emails, JWTs, bearer credentials, and long
 * hex or base64 runs. UUIDs survive because ids are the point of a useful error. Structured
 * fields are allow-listed instead: only known-safe keys with safe-shaped values are kept.
 */

export const SCRUBBED_MESSAGE_MAX_LENGTH = 500;
export const SCRUBBED_ROUTE_MAX_LENGTH = 200;
const NAME_MAX_LENGTH = 80;
const MARK = String.fromCharCode(1);

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const UUID_EXACT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Keys whose values are secrets.
const SECRET_KEYS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'api[_-]?key',
  'apikey',
  'authorization',
  'auth',
  'cookie',
  'set-cookie',
  'session',
  'jwt',
  'code',
  'otp',
  'signature',
  'sig',
  'key',
].join('|');

// Keys whose values are household content or personal data.
const CONTENT_KEYS = [
  'name',
  'display_?name',
  'title',
  'items?',
  'item_?name',
  'notes?',
  'quantity(?:_?note)?',
  'ingredients?',
  'recipe',
  'list',
  'pantry',
  'body',
  'content',
  'text',
  'query',
  'q',
  'description',
  'email',
  'e-mail',
  'user_?name',
  'address',
  'phone',
  'url',
].join('|');

// Words after which a number is money (a bill amount, a price, a payment).
const MONEY_WORDS =
  'amount|amounts|price|prices|cost|costs|total|subtotal|paid|pay|payment|payments|balance|due|charge|charged|fee|fees|rent|bill|bills|spend|spent|usd|dollars?|cents?';

type Rule = readonly [RegExp, string];

const RULES: readonly Rule[] = [
  // Supabase API keys and credentials in an Authorization-style header.
  [/\bsb_(?:secret|publishable)_[\w-]+/gi, '[token]'],
  [/\b(bearer|basic)(?:\s*[:=]\s*|\s+)[^\s,;"'()]+/gi, '$1 [token]'],
  [/\b(token)\s+[^\s,;"'()]+/gi, '$1 [token]'],
  // JWTs, whole or as a lone header segment.
  [/\beyJ[\w-]*\.[\w-]*(?:\.[\w-]*)?/g, '[token]'],
  [/\beyJ[\w-]{8,}/g, '[token]'],
  // Any URL: recipe links, invite links with their token, query strings with search terms.
  [/\b(?:https?|wss?|ftp|file|data|blob|mailto):[^\s"'<>`]*/gi, '[url]'],
  // Emails, including loosely formed ones.
  [/[^\s@<>"'`(),;:[\]{}]+@[^\s@<>"'`(),;:[\]{}]+/g, '[email]'],
  // key=value and key: value pairs that name a secret or content.
  [
    new RegExp(
      `\\b(${SECRET_KEYS}|${CONTENT_KEYS})(\\s*[:=]\\s*)(?:"[^"]*"|'[^']*'|[^\\s,;&)]+)`,
      'gi',
    ),
    '$1$2[redacted]',
  ],
  // Money: a currency symbol with a number, a number with a currency word, a money word with a
  // number.
  [/[$€£¥¢]\s*[-+]?\d[\d,]*(?:\.\d+)?/g, '[amount]'],
  [/[-+]?\d[\d,]*(?:\.\d+)?\s*(?:usd|dollars?|cents?|bucks)\b/gi, '[amount]'],
  [
    new RegExp(`\\b(${MONEY_WORDS})(\\W{0,3}(?:of|is|was|to|at)?\\W{0,3})[-+]?\\d[\\d,.]*`, 'gi'),
    '$1$2[amount]',
  ],
  // Any decimal (amounts without a symbol, quantities such as 1.5 lb) and long numbers (cents,
  // card or phone numbers).
  [/[-+]?\b\d+[.,]\d+(?:[.,]\d+)*\b/g, '[number]'],
  [/\b\d{5,}\b/g, '[number]'],
  // Long hex (digests, keys) and long base64 or base64url runs that look like secrets.
  [/\b[0-9a-f]{16,}\b/gi, '[secret]'],
  [/[A-Za-z0-9+/_-]{24,}={0,2}/g, '[secret]'],
];

function removeBracketed(text: string): string {
  // Innermost first, until nothing bracketed remains. The stand-in has no brackets, so an outer
  // pair still matches once its contents are replaced.
  const standIn = String.fromCharCode(2);
  let current = text;
  for (let i = 0; i < 50; i += 1) {
    const next = current
      .replace(/\{[^{}]*\}/g, standIn)
      .replace(/\[[^[\]]*\]/g, standIn)
      .replace(/<[^<>]*>/g, standIn);
    if (next === current) break;
    current = next;
  }
  return current.replaceAll(standIn, '[data]');
}

function removeQuoted(text: string): string {
  return (
    text
      .replace(/"[^"]*"/g, '[text]')
      .replace(/`[^`]*`/g, '[text]')
      .replace(/“[^”]*”/g, '[text]')
      .replace(/‘[^’]*’/g, '[text]')
      // A single quote pair, but not an apostrophe inside a word ("can't", "Alex's").
      .replace(/(^|[^\p{L}\p{N}])'[^']*'(?![\p{L}\p{N}])/gu, '$1[text]')
      // An unmatched quote to the end: whatever follows it was meant to be quoted.
      .replace(/["`“‘][^]*$/, '[text]')
  );
}

/** Scrubs a free-text error message, returning at most 500 characters. */
export function scrubErrorText(input: unknown): string {
  let text = typeof input === 'string' ? input : input instanceof Error ? input.message : '';
  // Never scan unbounded input; anything past this would be cut anyway.
  text = text.slice(0, 4 * SCRUBBED_MESSAGE_MAX_LENGTH);
  // Control characters and line breaks would let a message forge extra log lines.
  text = text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ');

  // UUIDs are set aside so no rule below mistakes one for a secret, then put back. The marker
  // uses a control character, which the step above has just removed from the input, so input
  // cannot forge one.
  const ids: string[] = [];
  text = text.replace(UUID, (id) => {
    ids.push(id.toLowerCase());
    return `${MARK}${String(ids.length - 1)}${MARK}`;
  });

  text = removeBracketed(text);
  text = removeQuoted(text);
  for (const [pattern, replacement] of RULES) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(
    new RegExp(`${MARK}(\\d+)${MARK}`, 'g'),
    (_match, index: string) => ids[Number(index)] ?? '',
  );
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > SCRUBBED_MESSAGE_MAX_LENGTH
    ? text.slice(0, SCRUBBED_MESSAGE_MAX_LENGTH)
    : text;
}

/** An error's name, kept only when it looks like a class name ("TypeError", "DOMException"). */
export function scrubErrorName(input: unknown): string {
  if (typeof input !== 'string') return 'Error';
  const name = input.trim();
  return new RegExp(`^[A-Za-z_$][\\w$.]{0,${String(NAME_MAX_LENGTH - 1)}}$`).test(name)
    ? name
    : 'Error';
}

/**
 * A route or path reduced to its shape: no origin, query, or fragment, and every segment that is
 * not a lowercase word or a UUID replaced by `:param`, so a path can never carry a name or a
 * token.
 */
export function scrubRoute(input: unknown): string {
  if (typeof input !== 'string' || input.trim() === '') return 'unknown';
  let path = input.trim();
  path = path.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '');
  path = path.split(/[?#]/)[0] ?? '';
  if (path === '' || path === '/') return '/';
  const segments = path.split('/').map((segment) => {
    if (segment === '') return '';
    if (/^[a-z][a-z0-9-]{0,39}$/.test(segment)) return segment;
    if (/^:[A-Za-z]\w{0,39}$/.test(segment)) return segment;
    if (UUID_EXACT.test(segment)) return segment.toLowerCase();
    return ':param';
  });
  const route = segments.join('/');
  return route.length > SCRUBBED_ROUTE_MAX_LENGTH
    ? route.slice(0, SCRUBBED_ROUTE_MAX_LENGTH)
    : route;
}

export interface ScrubbedErrorReport {
  name: string;
  message: string;
  route: string;
}

/** The three fields an error record is built from, each scrubbed. */
export function scrubErrorReport(input: {
  name?: unknown;
  message?: unknown;
  route?: unknown;
}): ScrubbedErrorReport {
  return {
    name: scrubErrorName(input.name),
    message: scrubErrorText(input.message),
    route: scrubRoute(input.route),
  };
}

/**
 * Structured context scrubbed by allow-list: ids (keys ending in `id` or `Id` with a UUID
 * value), a route, a method, an HTTP status, a job name, an error name or code, and a message
 * are kept, each checked or scrubbed; every other key's value is replaced, whatever it holds.
 */
export function scrubFields(
  fields: Readonly<Record<string, unknown>>,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (/(?:^id|Id|_id)$/.test(key)) {
      result[key] = typeof value === 'string' && UUID_EXACT.test(value) ? value : '[redacted]';
    } else if (key === 'route' || key === 'path' || key === 'url') {
      result[key] = scrubRoute(value);
    } else if (key === 'method') {
      result[key] = typeof value === 'string' && /^[A-Z]{3,7}$/.test(value) ? value : '[redacted]';
    } else if (key === 'status' || key === 'statusCode') {
      result[key] =
        typeof value === 'number' && Number.isInteger(value) && value >= 100 && value < 600
          ? value
          : '[redacted]';
    } else if (key === 'job') {
      result[key] =
        typeof value === 'string' && /^[a-z][a-z0-9_-]{0,39}$/.test(value) ? value : '[redacted]';
    } else if (key === 'name') {
      result[key] = scrubErrorName(value);
    } else if (key === 'code') {
      result[key] =
        typeof value === 'string' && /^[A-Z0-9_]{1,40}$/.test(value) ? value : '[redacted]';
    } else if (key === 'message') {
      result[key] = scrubErrorText(value);
    } else {
      result[key] = '[redacted]';
    }
  }
  return result;
}
