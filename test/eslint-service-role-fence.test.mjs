/*
 * Probes for the service-role fence in `eslint.config.js`: outside `main.ts`, `cli.ts`, tests, and
 * `apps/service/src/privileged/`, a module may not import from `privileged/` (the only code that
 * builds a `service_role` client, which bypasses RLS), statically or with `import('...')`. Each
 * probe is a snippet linted under a path in the service tree with the repo's real config. A bad
 * probe must raise the fence at error severity; a good one must not. Run by `pnpm test` through
 * the root `test:harness` script.
 *
 * Out of reach of the fence, so not probed and not claimed: a dynamic import whose specifier is a
 * variable or template literal, `require`, a raw `set local role service_role` in SQL, and code
 * outside `apps/service/src`. `docs/testing.md` lists the same limits.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { REPO_ROOT } from './support/vitest-project.mjs';

// The probes are virtual files, which the type-aware project service cannot find; the fence reads
// syntax only, so type information is switched off for them.
const eslint = new ESLint({
  cwd: REPO_ROOT,
  overrideConfig: tseslint.config(tseslint.configs.disableTypeChecked),
});

const FENCE_RULES = new Set(['@typescript-eslint/no-restricted-imports', 'no-restricted-syntax']);

/** The fence's reports for `code` linted as if it lived at `filePath`. */
async function fenceMessages(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  assert.ok(result, 'no lint result');
  const fatal = result.messages.filter((message) => message.fatal);
  assert.deepEqual(fatal, [], `the probe did not parse: ${JSON.stringify(fatal)}`);
  return result.messages.filter((message) => FENCE_RULES.has(message.ruleId));
}

const SERVICE_MODULE = 'apps/service/src/routes/probe.ts';

const BAD = [
  "import { withServiceRoleDb } from '../privileged/service-role-db.js';",
  "import { createJobDatabase } from '../privileged/job-database.js';",
  "import * as admin from '../../privileged/gotrue-admin.js';",
  "import '../privileged/service-role-db.js';",
  "export { readSystemHealth } from '../privileged/service-role-db.js';",
  "export * from '../privileged/service-role-db.js';",
  // A type-only import is allowed; one value beside it is not.
  "import { type SystemHealthRow, readSystemHealth } from '../privileged/service-role-db.js';",
  // no-restricted-imports sees static imports only.
  "const loaded = await import('../privileged/service-role-db.js');",
  "void import('../privileged/notification-outbox.js').then(() => undefined);",
];

const GOOD = [
  "import type { SystemHealthRow } from '../privileged/service-role-db.js';",
  "import { type SystemHealthRow } from '../privileged/service-role-db.js';",
  "import { fail } from '../problem.js';",
  "const loaded = await import('../problem.js');",
];

describe('service-role fence: imports the fence must report', () => {
  for (const code of BAD) {
    it(code, async () => {
      const messages = await fenceMessages(code, SERVICE_MODULE);
      assert.ok(messages.length >= 1, 'not reported');
      assert.ok(
        messages.every((message) => message.severity === 2),
        'reported below error severity',
      );
    });
  }
});

describe('service-role fence: imports it must leave alone', () => {
  for (const code of GOOD) {
    it(code, async () => {
      assert.deepEqual(await fenceMessages(code, SERVICE_MODULE), []);
    });
  }
});

describe('service-role fence: where it applies', () => {
  const value = "import { withServiceRoleDb } from '../privileged/service-role-db.js';";

  // Every directory of the service, including the files the audit named (routes/users.ts,
  // http/context.ts).
  const fenced = [
    'apps/service/src/routes/users.ts',
    'apps/service/src/http/context.ts',
    'apps/service/src/services/lists.ts',
    'apps/service/src/jobs/scheduler.ts',
    'apps/service/src/db/user-db.ts',
    'apps/service/src/app.ts',
    'apps/service/src/env.ts',
    'apps/service/src/push/test-seam.ts',
  ];
  for (const filePath of fenced) {
    it(`${filePath} is fenced`, async () => {
      const messages = await fenceMessages(value, filePath);
      assert.ok(messages.length >= 1, 'not covered');
      assert.ok(
        messages.every((message) => message.severity === 2),
        'reported below error severity',
      );
    });
  }

  // The sanctioned callers.
  const exempt = [
    'apps/service/src/main.ts',
    'apps/service/src/cli.ts',
    'apps/service/src/privileged/probe.ts',
    'apps/service/src/privileged/nested/probe.ts',
    'apps/service/src/routes/probe.test.ts',
    'apps/service/src/probe.integration.test.ts',
    'apps/service/src/test/probe.ts',
  ];
  for (const filePath of exempt) {
    it(`${filePath} may import privileged/`, async () => {
      assert.deepEqual(await fenceMessages(value, filePath), []);
    });
  }
});
