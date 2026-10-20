/*
 * Static checks on `docker/kong.yml`, the declarative config for the gateway in front of GoTrue.
 * GoTrue is an allowlist (Technical Architecture, "Routing"): each call the browser makes has a
 * route with its method, and everything else under /auth/v1 ends at one refusing route. This test
 * pins that table exactly, so a route added, a method widened, or an ACL group added fails here
 * before it reaches a host. It cannot start Kong; `e2e/tests/08-caddy-refuses-gotrue-endpoints
 * .spec.ts` and the sign-in journeys prove the running gateway behaves as this file says.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const pluginSchema = z.object({
  name: z.string(),
  config: z.record(z.string(), z.unknown()).optional(),
});
const routeSchema = z.object({
  name: z.string(),
  strip_path: z.boolean().optional(),
  methods: z.array(z.string()).optional(),
  paths: z.array(z.string()),
});
const serviceSchema = z.object({
  name: z.string(),
  url: z.string(),
  routes: z.array(routeSchema).optional(),
  plugins: z.array(pluginSchema).optional(),
});
const kongFileSchema = z.object({
  _format_version: z.string(),
  services: z.array(serviceSchema),
});
const composeFileSchema = z.object({
  services: z.object({
    kong: z.object({ environment: z.record(z.string(), z.unknown()) }),
  }),
});

function readDocker(name: string): unknown {
  return parse(
    readFileSync(fileURLToPath(new URL(`../../../docker/${name}`, import.meta.url)), 'utf8'),
  );
}

const kong = kongFileSchema.parse(readDocker('kong.yml'));
const compose = composeFileSchema.parse(readDocker('docker-compose.yml'));

type Plugins = Record<string, Record<string, unknown> | undefined>;

interface FlatRoute {
  name: string;
  upstream: string;
  methods: string[];
  paths: string[];
  stripPath: boolean | undefined;
  plugins: Plugins;
}

/** Every route with the service and plugins it hangs off, flattened. */
const routes: FlatRoute[] = kong.services.flatMap((service) =>
  (service.routes ?? []).map((route) => ({
    name: route.name,
    upstream: service.url,
    methods: [...(route.methods ?? [])].sort(),
    paths: route.paths,
    stripPath: route.strip_path,
    plugins: Object.fromEntries(
      (service.plugins ?? []).map((plugin) => [plugin.name, plugin.config]),
    ),
  })),
);

const gotrue = routes.filter((route) => route.paths.some((path) => /^~?\/auth\/v1/.test(path)));

const KEYED = { 'key-auth': { hide_credentials: false } };
const aclOf = (...allow: string[]): Plugins => ({ acl: { hide_groups_header: true, allow } });

type Row = readonly [
  name: string,
  upstream: string,
  methods: string[],
  path: string,
  plugins: Plugins,
];

// The whole GoTrue surface Kong exposes. Each upstream is the one GoTrue path the route serves.
const ALLOWED: readonly Row[] = [
  ['auth-v1-verify', 'http://auth:9999/verify', ['GET', 'POST'], '~/auth/v1/verify/?$', {}],
  [
    'auth-v1-token',
    'http://auth:9999/token',
    ['POST'],
    '~/auth/v1/token/?$',
    { ...KEYED, ...aclOf('admin', 'anon') },
  ],
  [
    'auth-v1-logout',
    'http://auth:9999/logout',
    ['POST'],
    '~/auth/v1/logout/?$',
    { ...KEYED, ...aclOf('admin', 'anon') },
  ],
  [
    'auth-v1-user',
    'http://auth:9999/user',
    ['GET'],
    '~/auth/v1/user/?$',
    { ...KEYED, ...aclOf('admin', 'anon') },
  ],
  [
    'auth-v1-otp',
    'http://auth:9999/otp',
    ['POST'],
    '~/auth/v1/otp/?$',
    { ...KEYED, ...aclOf('admin', 'anon') },
  ],
  [
    'auth-v1-admin-users',
    'http://auth:9999/admin/users',
    ['GET', 'POST'],
    '~/auth/v1/admin/users/?$',
    { ...KEYED, ...aclOf('admin') },
  ],
];
const DENIED: Row = [
  'auth-v1-denied',
  'http://auth:9999/',
  [],
  '/auth/v1',
  { 'request-termination': { status_code: 403, message: 'Access is forbidden.' } },
];
const DENIED_NAME = DENIED[0];

describe('kong.yml: the GoTrue allowlist', () => {
  it('declares format 3.0, which regex paths need', () => {
    expect(kong._format_version).toBe('3.0');
  });

  it('has exactly the allowed routes, methods, auth and refusal', () => {
    const shape = (route: FlatRoute): unknown[] => [
      route.name,
      route.upstream,
      route.methods,
      route.paths.join(),
      route.plugins,
    ];
    expect(gotrue.map(shape)).toEqual([...ALLOWED, DENIED].map((row) => [...row]));
  });

  it('gives every allowed route a method, an exact path, and a path-stripped upstream', () => {
    for (const route of gotrue.filter((one) => one.name !== DENIED_NAME)) {
      expect(route.methods.length, `${route.name} has no methods`).toBeGreaterThan(0);
      expect(
        route.paths.every((path) => path.startsWith('~/') && path.endsWith('$')),
        `${route.name} path is not an exact regex`,
      ).toBe(true);
      expect(route.stripPath, `${route.name} must strip its path`).toBe(true);
      expect(route.upstream.startsWith('http://auth:9999/')).toBe(true);
      expect(route.upstream.length).toBeGreaterThan('http://auth:9999/'.length);
    }
  });

  it('keeps /verify open and everything else key-authenticated', () => {
    for (const route of gotrue) {
      const open = route.name === 'auth-v1-verify' || route.name === DENIED_NAME;
      expect('key-auth' in route.plugins, route.name).toBe(!open);
    }
  });

  it('never lets the anon key reach admin', () => {
    const admin = gotrue.find((route) => route.name === 'auth-v1-admin-users');
    expect(admin?.plugins['acl']?.['allow']).toEqual(['admin']);
  });

  it('leaves the realtime routes alone', () => {
    const realtime = routes.filter((route) =>
      route.paths.some((path) => path.startsWith('/realtime/v1')),
    );
    expect(realtime.map((route) => [route.name, route.paths.join()])).toEqual([
      ['realtime-v1-ws', '/realtime/v1/'],
      ['realtime-v1-rest', '/realtime/v1/api'],
      ['realtime-v1-rest-tenants', '/realtime/v1/api/tenants'],
      ['realtime-v1-rest-openapi', '/realtime/v1/api/openapi'],
    ]);
  });

  it('only uses plugins the Compose file enables', () => {
    const enabled = new Set(
      z.string().parse(compose.services.kong.environment['KONG_PLUGINS']).split(','),
    );
    const used = new Set(routes.flatMap((route) => Object.keys(route.plugins)));
    for (const plugin of used) {
      expect(enabled.has(plugin), `${plugin} is not in KONG_PLUGINS`).toBe(true);
    }
  });
});

// What Kong would do with a request, for the calls below: a route whose regex path and method both
// match wins over the refusing prefix route. This models the router for this file only; the E2E
// probes are the proof against the real thing.
function decide(method: string, path: string): string {
  const hit = gotrue.find(
    (route) =>
      route.name !== DENIED_NAME &&
      route.methods.includes(method) &&
      route.paths.some((pattern) => new RegExp(`^${pattern.slice(1)}`).test(path)),
  );
  return hit?.name ?? (path.startsWith('/auth/v1') ? DENIED_NAME : 'no route');
}

describe('kong.yml: the calls the browser makes', () => {
  // supabase-js 2.116.0 (auth-js GoTrueClient / GoTrueAdminApi), as apps/web/src/lib/auth uses it.
  const CALLS: readonly (readonly [
    method: string,
    path: string,
    because: string,
    route: string,
  ])[] = [
    ['POST', '/auth/v1/token', 'signInWithPassword, refreshSession, auto refresh', 'auth-v1-token'],
    ['POST', '/auth/v1/logout', 'signOut (any scope)', 'auth-v1-logout'],
    [
      'GET',
      '/auth/v1/user',
      'setSession after /api/signup; the URL-fragment sign-in',
      'auth-v1-user',
    ],
    ['GET', '/auth/v1/verify', 'the recovery email link', 'auth-v1-verify'],
    ['POST', '/auth/v1/verify', 'verifyOtp (magic link)', 'auth-v1-verify'],
    ['POST', '/auth/v1/otp', 'signInWithOtp (magic link)', 'auth-v1-otp'],
    ['POST', '/auth/v1/admin/users', 'the E2E seed creating a user', 'auth-v1-admin-users'],
    ['GET', '/auth/v1/admin/users', 'the E2E seed listing users', 'auth-v1-admin-users'],
  ];
  it.each(CALLS)('%s %s (%s) reaches %s', (method, path, _because, route) => {
    expect(decide(method, path)).toBe(route);
  });

  const REFUSED: readonly (readonly [method: string, path: string])[] = [
    ['POST', '/auth/v1/signup'],
    ['PUT', '/auth/v1/user'],
    ['POST', '/auth/v1/recover'],
    ['GET', '/auth/v1/settings'],
    ['GET', '/auth/v1/.well-known/jwks.json'],
    ['GET', '/auth/v1/health'],
    ['GET', '/auth/v1/authorize'],
    ['POST', '/auth/v1/invite'],
    ['POST', '/auth/v1/admin/generate_link'],
    ['GET', '/auth/v1/admin/users/00000000-0000-4000-8000-000000000000'],
    ['PUT', '/auth/v1/admin/users'],
    ['GET', '/auth/v1/token'],
    ['PUT', '/auth/v1/token'],
    ['DELETE', '/auth/v1/logout'],
    ['POST', '/auth/v1/user'],
    ['GET', '/auth/v1/'],
    ['GET', '/auth/v1'],
  ];
  it.each(REFUSED)('%s %s is refused', (method, path) => {
    expect(decide(method, path)).toBe(DENIED_NAME);
  });
});
