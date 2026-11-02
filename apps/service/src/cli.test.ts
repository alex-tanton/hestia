import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli, SET_PASSWORD_PATH, type PushOps, type PushSubscriptionTarget } from './cli.js';
import { GoTrueError } from './gotrue/http.js';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: { out: (line: string) => out.push(line), err: (line: string) => err.push(line) },
  };
}

const ORIGIN = 'https://hestia.aberrance.app';

describe('hestia-admin', () => {
  it('prints a recovery link that lands on the set-new-password screen', async () => {
    const recoveryLink = vi.fn(() => Promise.resolve('https://h/auth/v1/verify?token=abc'));
    const { out, err, io: streams } = io();
    const code = await runCli(
      ['reset-password', 'alex@example.com'],
      { recoveryLink },
      ORIGIN,
      streams,
    );
    expect(code).toBe(0);
    expect(out).toEqual(['https://h/auth/v1/verify?token=abc']);
    expect(err.join('\n')).toMatch(/expires in an hour/);
    expect(recoveryLink).toHaveBeenCalledWith('alex@example.com', `${ORIGIN}${SET_PASSWORD_PATH}`);
    expect(SET_PASSWORD_PATH).toBe('/set-password');
  });

  it.each([[[]], [['other', 'a@b.co']]])('prints general usage for %j', async (args) => {
    const { err, io: streams } = io();
    const recoveryLink = vi.fn();
    expect(await runCli(args, { recoveryLink }, ORIGIN, streams)).toBe(2);
    expect(err[0]).toMatch(
      /^Usage:\s+hestia-admin reset-password <email>\s+hestia-admin test-push/,
    );
    expect(recoveryLink).not.toHaveBeenCalled();
  });

  it.each([[['reset-password']], [['reset-password', 'a@b.co', 'x']]])(
    'prints reset-password usage for %j',
    async (args) => {
      const { err, io: streams } = io();
      const recoveryLink = vi.fn();
      expect(await runCli(args, { recoveryLink }, ORIGIN, streams)).toBe(2);
      expect(err[0]).toMatch(/^Usage: hestia-admin reset-password <email>/);
      expect(recoveryLink).not.toHaveBeenCalled();
    },
  );

  it('refuses something that is not an email', async () => {
    const { err, io: streams } = io();
    expect(
      await runCli(['reset-password', 'alex'], { recoveryLink: vi.fn() }, ORIGIN, streams),
    ).toBe(2);
    expect(err[0]).toMatch(/Not an email/);
  });

  it('explains an unknown user, a GoTrue refusal, and any other failure', async () => {
    const cases: [unknown, RegExp][] = [
      [new GoTrueError(404, 'user_not_found', 'User not found'), /No user has the email/],
      [new GoTrueError(403, 'not_admin', 'bad key'), /GoTrue refused: 403 bad key/],
      [new Error('ECONNREFUSED'), /Could not create the link: ECONNREFUSED/],
      ['weird', /Could not create the link: weird/],
    ];
    for (const [failure, message] of cases) {
      const { err, out, io: streams } = io();
      // A non-Error rejection is one of the cases under test.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      const recoveryLink = () => Promise.reject(failure);
      expect(await runCli(['reset-password', 'a@b.co'], { recoveryLink }, ORIGIN, streams)).toBe(1);
      expect(out).toEqual([]);
      expect(err[0]).toMatch(message);
    }
  });
});

function mockPushOps(overrides: Partial<PushOps> = {}): PushOps {
  return {
    lookupUser: vi.fn(() => Promise.resolve({ id: 'user-1' })),
    listSubscriptions: vi.fn(() =>
      Promise.resolve([
        {
          id: 'sub-1',
          endpoint: 'https://push1.example.com',
          keys: { p256dh: 'key1', auth: 'auth1' },
        },
      ]),
    ),
    deleteSubscription: vi.fn(() => Promise.resolve()),
    transport: {
      send: vi.fn(() => Promise.resolve({ kind: 'accepted' as const })),
    },
    ...overrides,
  };
}

describe('hestia-admin test-push', () => {
  it.each([
    [['test-push']],
    [['test-push', '--unknown']],
    [['test-push', '--email']],
    [['test-push', '--email', 'a@b.co', '--title']],
    [['test-push', '--email', 'a@b.co', '--body']],
  ])('prints usage for %j', async (args) => {
    const { err, io: streams } = io();
    const ops = mockPushOps();
    expect(await runCli(args, { recoveryLink: vi.fn() }, ORIGIN, streams, ops)).toBe(2);
    expect(err[0]).toMatch(/^Usage: hestia-admin test-push --email <email>/);
  });

  it('fails when push operations are not configured', async () => {
    const { err, io: streams } = io();
    expect(
      await runCli(
        ['test-push', '--email', 'alex@example.com'],
        { recoveryLink: vi.fn() },
        ORIGIN,
        streams,
      ),
    ).toBe(1);
    expect(err[0]).toBe('Push operations are not configured.');
  });

  it('refuses an invalid email address', async () => {
    const { err, io: streams } = io();
    const ops = mockPushOps();
    expect(
      await runCli(
        ['test-push', '--email', 'invalid-email'],
        { recoveryLink: vi.fn() },
        ORIGIN,
        streams,
        ops,
      ),
    ).toBe(2);
    expect(err[0]).toBe('Not an email address: invalid-email');
  });

  it('reports error when user is not found in profile', async () => {
    const { err, io: streams } = io();
    const ops = mockPushOps({
      lookupUser: vi.fn(() => Promise.resolve(undefined)),
    });
    expect(
      await runCli(
        ['test-push', '--email', 'unknown@example.com'],
        { recoveryLink: vi.fn() },
        ORIGIN,
        streams,
        ops,
      ),
    ).toBe(1);
    expect(err[0]).toBe('No user has the email unknown@example.com.');
  });

  it('reports notice when user has no active push subscriptions', async () => {
    const { err, io: streams } = io();
    const ops = mockPushOps({
      listSubscriptions: vi.fn(() => Promise.resolve([])),
    });
    expect(
      await runCli(
        ['test-push', '--email', 'alex@example.com'],
        { recoveryLink: vi.fn() },
        ORIGIN,
        streams,
        ops,
      ),
    ).toBe(1);
    expect(err[0]).toBe('User alex@example.com has no active push subscriptions.');
  });

  it('successfully dispatches test push to devices with default copy', async () => {
    const { out, io: streams } = io();
    const sub1: PushSubscriptionTarget = {
      id: 'sub-1',
      endpoint: 'https://push1',
      keys: { p256dh: 'k1', auth: 'a1' },
    };
    const sub2: PushSubscriptionTarget = {
      id: 'sub-2',
      endpoint: 'https://push2',
      keys: { p256dh: 'k2', auth: 'a2' },
    };
    const send = vi.fn(() => Promise.resolve({ kind: 'accepted' as const }));
    const ops = mockPushOps({
      listSubscriptions: vi.fn(() => Promise.resolve([sub1, sub2])),
      transport: { send },
    });

    const code = await runCli(
      ['test-push', '--email', 'alex@example.com'],
      { recoveryLink: vi.fn() },
      ORIGIN,
      streams,
      ops,
    );

    expect(code).toBe(0);
    expect(out[0]).toBe(
      'Dispatched test push to 2 device(s) for alex@example.com: 2 accepted, 0 gone, 0 failed.',
    );
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(
      1,
      sub1,
      JSON.stringify({
        title: 'Test Push Notification',
        body: 'This is a test notification from Hestia.',
        url: '/',
      }),
    );
    expect(send).toHaveBeenNthCalledWith(
      2,
      sub2,
      JSON.stringify({
        title: 'Test Push Notification',
        body: 'This is a test notification from Hestia.',
        url: '/',
      }),
    );
  });

  it('supports custom --title and --body arguments', async () => {
    const { out, io: streams } = io();
    const sub: PushSubscriptionTarget = {
      id: 'sub-1',
      endpoint: 'https://push1',
      keys: { p256dh: 'k1', auth: 'a1' },
    };
    const send = vi.fn(() => Promise.resolve({ kind: 'accepted' as const }));
    const ops = mockPushOps({
      listSubscriptions: vi.fn(() => Promise.resolve([sub])),
      transport: { send },
    });

    const code = await runCli(
      [
        'test-push',
        '--email',
        'alex@example.com',
        '--title',
        'Custom Title',
        '--body',
        'Custom Body',
      ],
      { recoveryLink: vi.fn() },
      ORIGIN,
      streams,
      ops,
    );

    expect(code).toBe(0);
    expect(out[0]).toBe(
      'Dispatched test push to 1 device(s) for alex@example.com: 1 accepted, 0 gone, 0 failed.',
    );
    expect(send).toHaveBeenCalledWith(
      sub,
      JSON.stringify({
        title: 'Custom Title',
        body: 'Custom Body',
        url: '/',
      }),
    );
  });

  it('deletes expired subscriptions when transport returns gone', async () => {
    const { out, io: streams } = io();
    const sub1: PushSubscriptionTarget = {
      id: 'sub-1',
      endpoint: 'https://push1',
      keys: { p256dh: 'k1', auth: 'a1' },
    };
    const sub2: PushSubscriptionTarget = {
      id: 'sub-2',
      endpoint: 'https://push2',
      keys: { p256dh: 'k2', auth: 'a2' },
    };
    const deleteSubscription = vi.fn(() => Promise.resolve());
    const send = vi.fn((sub: PushSubscriptionTarget) => {
      if (sub.id === 'sub-1') return Promise.resolve({ kind: 'gone' as const });
      return Promise.resolve({ kind: 'accepted' as const });
    });
    const ops = mockPushOps({
      listSubscriptions: vi.fn(() => Promise.resolve([sub1, sub2])),
      deleteSubscription,
      transport: { send },
    });

    const code = await runCli(
      ['test-push', '--email', 'alex@example.com'],
      { recoveryLink: vi.fn() },
      ORIGIN,
      streams,
      ops,
    );

    expect(code).toBe(0);
    expect(out[0]).toBe(
      'Dispatched test push to 2 device(s) for alex@example.com: 1 accepted, 1 gone, 0 failed.',
    );
    expect(deleteSubscription).toHaveBeenCalledTimes(1);
    expect(deleteSubscription).toHaveBeenCalledWith('sub-1');
  });

  it('handles failed transport sends without throwing', async () => {
    const { out, io: streams } = io();
    const sub: PushSubscriptionTarget = {
      id: 'sub-1',
      endpoint: 'https://push1',
      keys: { p256dh: 'k1', auth: 'a1' },
    };
    const deleteSubscription = vi.fn(() => Promise.resolve());
    const send = vi.fn(() => Promise.resolve({ kind: 'failed' as const, statusCode: 500 }));
    const ops = mockPushOps({
      listSubscriptions: vi.fn(() => Promise.resolve([sub])),
      deleteSubscription,
      transport: { send },
    });

    const code = await runCli(
      ['test-push', '--email', 'alex@example.com'],
      { recoveryLink: vi.fn() },
      ORIGIN,
      streams,
      ops,
    );

    expect(code).toBe(0);
    expect(out[0]).toBe(
      'Dispatched test push to 1 device(s) for alex@example.com: 0 accepted, 0 gone, 1 failed.',
    );
    expect(deleteSubscription).not.toHaveBeenCalled();
  });
});
/**
 * The `invokedDirectly` block (lines 60-74) only runs when the module is the process's actual
 * entrypoint -- `import.meta.url === pathToFileURL(process.argv[1]).href` -- which no in-process
 * unit test calling `runCli` directly can ever trigger. This spawns the real script as its own
 * process, the same way `bin/hestia-admin` does in production, against a throwaway local HTTP
 * server standing in for GoTrue (never a live network call).
 */
describe('hestia-admin, invoked directly as a script', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server === undefined) return;
    await new Promise<void>((resolve) =>
      server?.close(() => {
        resolve();
      }),
    );
    server = undefined;
  });

  async function startGoTrueDouble(status: number, body: unknown): Promise<string> {
    server = createServer((_req, res) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    });
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('test GoTrue double has no address');
    }
    return `http://127.0.0.1:${String(address.port)}`;
  }

  const ENV_KEYS = ['GOTRUE_URL', 'SERVICE_ROLE_KEY', 'HESTIA_ORIGIN'] as const;

  // Cache-busting token for the re-import below. The clock cannot serve: the shared pin freezes
  // it, so a second import would repeat the query string and hit the module cache.
  let importCount = 0;

  /**
   * The `invokedDirectly` block (lines 60-74) only runs once, at module load, when
   * `import.meta.url === pathToFileURL(process.argv[1]).href` — which no in-process call to
   * `runCli` can ever trigger, since `process.argv[1]` is the test runner's own entrypoint by
   * then. This re-imports the module with a cache-busting query string (forcing Vite/Vitest to
   * re-evaluate its top level) after pointing `process.argv[1]` at the module's own path, the one
   * way to exercise that guard within this process rather than losing it to a spawned
   * subprocess's own, uninstrumented coverage. Every piece of global state it touches
   * (`process.argv`, `process.env`, `process.exitCode`, stdout/stderr) is saved and restored in
   * `finally`, so this cannot leak into any other test.
   */
  async function runInvokedDirectly(
    gotrueUrl: string,
  ): Promise<{ exitCode: number | undefined; out: string[]; err: string[] }> {
    const originalArgv = [...process.argv];
    const originalExitCode = process.exitCode;
    const originalEnv: Record<string, string | undefined> = {};
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];

    const out: string[] = [];
    const err: string[] = [];
    const outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      out.push(String(chunk));
      return true;
    });
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      err.push(String(chunk));
      return true;
    });

    try {
      const cliPath = fileURLToPath(new URL('./cli.ts', import.meta.url));
      process.argv = [originalArgv[0] ?? 'node', cliPath, 'reset-password', 'alex@example.com'];
      process.env['GOTRUE_URL'] = gotrueUrl;
      process.env['SERVICE_ROLE_KEY'] = 'test-service-role-key';
      process.env['HESTIA_ORIGIN'] = 'https://hestia.example.test';
      process.exitCode = undefined;

      await import(/* @vite-ignore */ `./cli.ts?invoked-directly=${String(++importCount)}`);

      return { exitCode: process.exitCode, out, err };
    } finally {
      process.argv = originalArgv;
      process.exitCode = originalExitCode;
      for (const key of ENV_KEYS) {
        if (originalEnv[key] === undefined) Reflect.deleteProperty(process.env, key);
        else process.env[key] = originalEnv[key];
      }
      outSpy.mockRestore();
      errSpy.mockRestore();
    }
  }

  it('parses env, builds the real GoTrue admin client, and writes the link to real stdout', async () => {
    const gotrueUrl = await startGoTrueDouble(200, {
      action_link: 'https://gotrue.example/verify?token=one-time',
    });

    const { exitCode, out, err } = await runInvokedDirectly(gotrueUrl);

    expect(exitCode).toBe(0);
    expect(out.join('')).toContain('https://gotrue.example/verify?token=one-time');
    expect(err.join('')).toContain('expires in an hour');
  });

  it('writes a GoTrue refusal to real stderr and sets exit code 1', async () => {
    const gotrueUrl = await startGoTrueDouble(403, { error_code: 'not_admin', msg: 'bad key' });

    const { exitCode, out, err } = await runInvokedDirectly(gotrueUrl);

    expect(exitCode).toBe(1);
    expect(out).toEqual([]);
    expect(err.join('')).toContain('GoTrue refused: 403 bad key');
  });
});
