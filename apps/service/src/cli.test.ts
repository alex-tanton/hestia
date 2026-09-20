import { describe, expect, it, vi } from 'vitest';
import { runCli, SET_PASSWORD_PATH } from './cli.js';
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

const ORIGIN = 'https://hearth.tail1234.ts.net';

describe('hearth-admin', () => {
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

  it.each([[[]], [['reset-password']], [['other', 'a@b.co']], [['reset-password', 'a@b.co', 'x']]])(
    'prints usage for %j',
    async (args) => {
      const { err, io: streams } = io();
      const recoveryLink = vi.fn();
      expect(await runCli(args, { recoveryLink }, ORIGIN, streams)).toBe(2);
      expect(err[0]).toMatch(/^Usage: hearth-admin reset-password <email>/);
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
