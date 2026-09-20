/** A GoTrue response that was not a success, with GoTrue's own status, code, and message. */
export class GoTrueError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'GoTrueError';
    this.status = status;
    this.code = code;
  }
}

export type Fetch = typeof fetch;

export interface GoTrueResponse {
  status: number;
  body: unknown;
}

// GoTrue must answer quickly; a hung call would otherwise hold the request open.
const TIMEOUT_MS = 10_000;

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function describe(body: unknown): { code: string; message: string } {
  if (typeof body !== 'object' || body === null) return { code: 'unknown', message: '' };
  const record = body as Record<string, unknown>;
  const code = record['error_code'] ?? record['code'] ?? record['error'];
  const message = record['msg'] ?? record['message'] ?? record['error_description'];
  return {
    code: typeof code === 'string' ? code : 'unknown',
    message: typeof message === 'string' ? message : '',
  };
}

export interface GoTrueRequest {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  apikey: string;
  bearer?: string;
  body?: unknown;
  /** The client's address, for GoTrue's per-IP limits (GOTRUE_RATE_LIMIT_HEADER). */
  clientIp?: string;
}

/** Calls GoTrue and returns its JSON body on success, throwing GoTrueError otherwise. */
export async function callGoTrue(
  fetchFn: Fetch,
  baseUrl: string,
  request: GoTrueRequest,
): Promise<GoTrueResponse> {
  const headers: Record<string, string> = { apikey: request.apikey, accept: 'application/json' };
  if (request.bearer !== undefined) headers['authorization'] = `Bearer ${request.bearer}`;
  if (request.clientIp !== undefined) headers['x-forwarded-for'] = request.clientIp;
  if (request.body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetchFn(`${baseUrl}${request.path}`, {
    method: request.method,
    headers,
    ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await readBody(response);
  if (!response.ok) {
    const { code, message } = describe(body);
    throw new GoTrueError(response.status, code, message);
  }
  return { status: response.status, body };
}
