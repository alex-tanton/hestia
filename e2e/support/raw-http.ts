import { request as httpRequest } from 'node:http';
import { BASE_URL } from './env.ts';

export interface RawResponse {
  status: number;
  body: string;
}

/**
 * Sends a request line with the path exactly as written. Every URL parser on the way to a normal
 * HTTP client collapses `/./`, resolves `/../`, and re-encodes escapes, which is precisely what
 * the Caddy refusal test must not let happen: the point is what Caddy does with the odd spelling,
 * not what a client would have tidied it into first.
 */
export function rawRequest(
  method: string,
  path: string,
  headers: Readonly<Record<string, string>> = {},
): Promise<RawResponse> {
  const { hostname, port } = new URL(BASE_URL);
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({});
    const client = httpRequest(
      {
        hostname,
        port,
        method,
        path,
        headers: { 'content-type': 'application/json', 'content-length': body.length, ...headers },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    client.on('error', reject);
    client.end(body);
  });
}
