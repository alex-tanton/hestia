/*
 * Static checks on the ingress files: both Compose files, the Caddyfile and `.env.example`. No
 * unit test can start the tunnel or Caddy, so this pins the values whose drift would open the
 * stack: a published port, a token on a command line, a wider trust list, a second client header.
 * E2E spec 20 proves the running client-address rule and `scripts/caddy-entrypoint.test.mjs` the
 * production CSP host.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseDocument, type ScalarTag } from 'yaml';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const envSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
const serviceSchema = z.looseObject({
  image: z.string().optional(),
  restart: z.string().optional(),
  command: z.array(z.string()).optional(),
  ports: z.array(z.unknown()).optional(),
  profiles: z.array(z.string()).optional(),
  logging: z.unknown().optional(),
  networks: z.union([z.array(z.string()), z.record(z.string(), z.unknown())]).optional(),
  environment: envSchema.optional(),
  healthcheck: z.looseObject({ test: z.array(z.string()) }).optional(),
});
const composeSchema = z.looseObject({
  services: z.record(z.string(), serviceSchema),
  networks: z
    .looseObject({
      hestia: z.looseObject({
        ipam: z
          .looseObject({
            config: z.array(z.looseObject({ subnet: z.string() })),
          })
          .nullable(),
      }),
    })
    .optional(),
});
const packageSchema = z.looseObject({
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});

/** Compose's `!reset` tag, which the overlay uses to drop the base file's ipam block. */
const composeReset: ScalarTag = { tag: '!reset', resolve: () => null };

function readRepoFile(path: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf8');
}

function loadCompose(path: string): { messages: string[]; file: z.infer<typeof composeSchema> } {
  const document = parseDocument(readRepoFile(path), { customTags: [composeReset] });
  const messages = [...document.errors, ...document.warnings].map((problem) => problem.message);
  return { messages, file: composeSchema.parse(document.toJS()) };
}

const base = loadCompose('docker/docker-compose.yml');
const overlay = loadCompose('e2e/docker-compose.e2e.yml');
const caddyfile = readRepoFile('docker/Caddyfile');
const envExample = readRepoFile('.env.example');

/** The Caddyfile without comment lines, so a directive named in a comment never counts. */
const caddyDirectives = caddyfile
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');
const globalBlock = caddyDirectives.slice(0, caddyDirectives.indexOf(':8080 {'));

function service(file: z.infer<typeof composeSchema>, name: string): z.infer<typeof serviceSchema> {
  const found = file.services[name];
  if (found === undefined) throw new Error(`no ${name} service`);
  return found;
}

function variable(file: z.infer<typeof composeSchema>, name: string, key: string): unknown {
  return service(file, name).environment?.[key];
}

describe('ingress configuration', () => {
  it('publishes no host port from the production stack and pins no network gateway', () => {
    expect(base.messages).toEqual([]);
    for (const [name, entry] of Object.entries(base.file.services)) {
      expect(entry.ports, `${name} ports`).toBeUndefined();
    }
    const [pool] = base.file.networks?.hestia.ipam?.config ?? [];
    expect(pool?.subnet).toBeTruthy();
    expect(pool).not.toHaveProperty('gateway');
    for (const text of [
      readRepoFile('docker/docker-compose.yml'),
      readRepoFile('e2e/docker-compose.e2e.yml'),
      caddyfile,
    ]) {
      expect(text).not.toContain('HESTIA_HOST_GATEWAY');
    }
  });

  it('runs a pinned cloudflared that needs the tunnel token and never puts it on a command line', () => {
    const tunnel = service(base.file, 'cloudflared');
    expect(tunnel.image).toMatch(/^cloudflare\/cloudflared:\d{4}\.\d+\.\d+$/);
    expect(tunnel.environment?.['TUNNEL_TOKEN']).toBe('${CLOUDFLARE_TUNNEL_TOKEN:?set in .env}');
    expect(String(tunnel.environment?.['TUNNEL_METRICS'])).toMatch(/^127\.0\.0\.1:/);
    expect(tunnel.healthcheck?.test).toEqual(['CMD', 'cloudflared', 'tunnel', 'ready']);
    expect(tunnel.restart).toBe('unless-stopped');
    expect(tunnel.networks).toContain('hestia');
    expect(tunnel.logging).toEqual(service(base.file, 'db').logging);
    expect(tunnel.ports).toBeUndefined();
    expect((tunnel.command ?? []).join(' ')).not.toMatch(/token/i);
  });

  it('trusts only the Compose subnet in Caddy, the same subnet Kong and the service trust', () => {
    const subnet = base.file.networks?.hestia.ipam?.config[0]?.subnet;
    expect(subnet).toMatch(/^\d+\.\d+\.\d+\.\d+\/\d+$/);
    expect(variable(base.file, 'caddy', 'HESTIA_TRUSTED_PROXIES')).toBe(subnet);
    expect(variable(base.file, 'kong', 'KONG_TRUSTED_IPS')).toBe(subnet);
    expect(variable(base.file, 'hestia-service', 'HESTIA_TRUSTED_PROXIES')).toBe(subnet);
  });

  it('reads the client only from CF-Connecting-IP and passes one X-Forwarded-For downstream', () => {
    expect(globalBlock).toContain('trusted_proxies static {$HESTIA_TRUSTED_PROXIES}');
    expect(globalBlock).toMatch(/^\s*trusted_proxies_strict\s*$/m);
    expect(
      [...caddyDirectives.matchAll(/^\s*client_ip_headers\s+(.+?)\s*$/gm)].map((m) => m[1]),
    ).toEqual(['CF-Connecting-IP']);
    expect(caddyDirectives.split('header_up X-Forwarded-For {client_ip}')).toHaveLength(3);
  });

  it("keeps cloudflared out of E2E and gives Caddy the run's own subnet there", () => {
    expect(overlay.messages).toEqual([]);
    expect(service(overlay.file, 'cloudflared').profiles?.length).toBeGreaterThan(0);
    expect(variable(overlay.file, 'caddy', 'HESTIA_TRUSTED_PROXIES')).toBe(
      '${HESTIA_E2E_SUBNET:?}',
    );
    const published = Object.entries(overlay.file.services)
      .filter(([, entry]) => entry.ports !== undefined)
      .map(([name]) => name)
      .sort();
    expect(published).toEqual(['caddy', 'db', 'inbucket']);
  });

  it("derives the CSP WebSocket host and GoTrue's URLs from HESTIA_ORIGIN", () => {
    expect(caddyDirectives).toContain("connect-src 'self' wss://{$HESTIA_HOST}");
    const auth = (key: string): unknown => variable(base.file, 'auth', key);
    expect(auth('API_EXTERNAL_URL')).toBe('${HESTIA_ORIGIN:?set in .env}');
    expect(auth('GOTRUE_SITE_URL')).toBe('${HESTIA_ORIGIN}');
    expect(auth('GOTRUE_URI_ALLOW_LIST')).toBe('${HESTIA_ORIGIN},${HESTIA_ORIGIN}/**');
    expect(auth('GOTRUE_JWT_ISSUER')).toBe('${HESTIA_ORIGIN}/auth/v1');
    expect(variable(base.file, 'caddy', 'HESTIA_ORIGIN')).toBe('${HESTIA_ORIGIN}');
    expect(variable(base.file, 'hestia-service', 'HESTIA_ORIGIN')).toBe('${HESTIA_ORIGIN}');
  });

  it('has no CORS or cookie surface', () => {
    expect(caddyfile).not.toMatch(/access-control-/i);
    expect(caddyfile).not.toMatch(/set-cookie/i);
    const manifest = packageSchema.parse(JSON.parse(readRepoFile('apps/service/package.json')));
    const names = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
    expect(names).not.toContain('@fastify/cors');
    expect(names).not.toContain('@fastify/cookie');
  });

  it('ships the new origin and an empty tunnel token in .env.example', () => {
    const lines = envExample.split('\n');
    expect(lines).toContain('HESTIA_ORIGIN=https://hestia.aberrance.app');
    expect(lines).toContain('CLOUDFLARE_TUNNEL_TOKEN=');
  });
});
