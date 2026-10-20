# Fix ledger: PR 2 (guard tests FIX-03, FIX-05)

base=9819e7c1436a8ad984f459c9fcb3e62fa68e0806
branch=test/guard-tests

Raw logs are under `.planning/cleanup/logs/` (gitignored) as `04-03-{fix}-{red,green,...}.log`. PR 2 is tests, harness wiring and docs only: no runtime behavior changes.

## Red and green

| FIX | Test | Red (unfixed) | Green (fixed) | Commit |
| --- | --- | --- | --- | --- |
| FIX-03 | `packages/shared/src/api/patch-schemas.test.ts` (24 cases: registry found and non-empty, 11 PATCH bodies, the `update*RequestSchema` cross-check, the three non-PATCH defaulted schemas, 8 mutant schemas, a clean schema, a non-object body) | The property holds today, so the red is a real schema mutation: in `../hearth-guard-tests` `packages/shared/src/api/bills.ts`, `updateBillRequestSchema`'s `autopay: billFieldsSchema.shape.autopay.unwrap(),` became `autopay: billFieldsSchema.shape.autopay,` (restored with `git checkout --`, confirmed clean). `pnpm --filter @hearth/shared exec vitest run src/api/patch-schemas.test.ts`: exit=1, 1 failed / 23 passed. FAIL `PATCH body schemas > /api/bills/:id injects no default for a field left out`: `AssertionError: expected [ 'autopay' ] to deeply equal []`. | Same command on the unmutated tree: exit=0, `Tests  24 passed (24)`. Whole shared suite: exit=0, 172 passed. Shared typecheck, ESLint `--max-warnings=0` and Prettier on the file: exit=0. | 72b0668741791409946a7fd7cd071d51fdf99a9d (`test/guard-tests`) |
| FIX-05 | `test/eslint-service-role-fence.test.mjs` (28 ESLint API probes: 9 bad imports, 4 good imports, 8 fenced paths, 7 exempt paths), run by `pnpm test:harness` | The fence holds today, so there is no bug to fail against; the red is four one-line mutations of the fence block in `eslint.config.js`, each run with `node --test test/eslint-service-role-fence.test.mjs` in `../hearth-guard-tests`, each restored with `git checkout -- eslint.config.js` and confirmed clean. m1 (line 110, `'error'` to `'warn'` on `@typescript-eslint/no-restricted-imports`): exit=1, 15 failed / 13 passed. m2 (`'apps/service/src/routes/**',` added to `ignores`): exit=1, 10 failed / 18 passed. m3 (selector regex `/privileged/` to `/no-such-module/`): exit=1, 2 failed / 26 passed (the two dynamic-import probes). m4 (`files` pointed at `apps/none/**/*.ts`): exit=1, 17 failed / 11 passed. m1 fails 15, not the 7 the research saw, because the fenced-path cases also assert error severity. | Same command on the unmutated config: exit=0, `pass 28`, `fail 0`. `pnpm test:harness`: 215 tests, exit=0. ESLint `--max-warnings=0` and Prettier on the test, `package.json` and `docs/testing.md`: exit=0. The audit (below) records 0 violations. | ba7d50116bd1e0db91360d26dd879165f3be2612 (`test/guard-tests`) |

## Service-role audit

Method: `git grep -n -I -i -E 'service_role|SERVICE_ROLE_KEY|withServiceRoleDb|serviceRole|privileged/' -- apps packages supabase/seed e2e` on `test/guard-tests` (base 9819e7c), 116 hits in total, saved to `.planning/cleanup/logs/04-03-audit.txt`; every hit outside `apps/service/src/privileged/` is classified below. A second pass looked for role switches and client construction outside `privileged/` (`set local role`, `set role`, `createClient(`) and for `require(` or a non-literal `import(` in the service tree. `packages/` has no hit at all.

| Location | What it does | Verdict |
| --- | --- | --- |
| `apps/service/src/main.ts:18-21,43,121` | Imports `createGoTrueAdmin`, `createJobDatabase`, `createNotificationOutbox`, `readSystemHealth`; passes `env.SERVICE_ROLE_KEY` to the GoTrue admin and to the push test seam | Sanctioned: the fence ignores `main.ts` |
| `apps/service/src/cli.ts:5,65` | `createGoTrueAdmin({ url: env.GOTRUE_URL, serviceRoleKey: env.SERVICE_ROLE_KEY })` for the owner CLI | Sanctioned: the fence ignores `cli.ts` |
| `apps/service/src/http/context.ts:9,23` | `import type { SystemHealthRow } from '../privileged/service-role-db.js'`; a doc comment on `systemHealth` | Type-only import, allowed by `allowTypeImports`; builds nothing |
| `apps/service/src/routes/users.ts` | No service-role or `privileged/` reference at all; calls the injected `ctx.deps.changeEmail` (line 79) | Clean: the capability arrives as a function from `main.ts` |
| `apps/service/src/jobs/{log-autopay,prune-cache,refresh-deals}.ts`, `jobs/types.ts:13-14` | Call `deps.database.asServiceRole(...)`, a narrow function typed in `jobs/types.ts` | The intended design: the function is built in `privileged/job-database.ts` and handed in by `main.ts`; no client is built here |
| `apps/service/src/jobs/dispatch-notifications.ts:13`, `jobs/types.ts:9-10`, `jobs/prune-cache.ts:63` | Comments about the capability | Comment only |
| `apps/service/src/services/readiness.ts:17-19`, `services/deals/{storage,dormancy}.ts` | Comments saying the caller's transaction may be `service_role` | Comment only |
| `apps/service/src/env.ts:50,149` | `SERVICE_ROLE_KEY: z.string().min(1)` and its redaction flag | Config parsing; builds no client |
| `apps/service/src/push/test-seam.ts:15,34` | Takes `serviceRoleKey` and compares it with the `Authorization` header using `timingSafeEqual` | Builds no client. Registered only when `HEARTH_PUSH_TRANSPORT` is `test-double` (`main.ts:119-121`) |
| `apps/service/src/test/service-stack.ts:12-13,28,68,119` | Imports `privileged/*` and builds a GoTrue admin for the integration stack | Test support, exempt by the fence's `ignores` (`apps/service/src/test/**`) |
| `apps/service/src/*.integration.test.ts` (`api`, `dispatch-notifications`, `jobs`, `log-autopay`, `notification-producers`, `readiness`), `db/policies.integration.test.ts` | Import `privileged/*`, call `withServiceRoleDb`, or query as `service_role` | Test code, exempt by `**/*.test.ts` |
| `apps/service/src/{cli,env}.test.ts`, `auth/jwt.test.ts`, `gotrue/gotrue.test.ts`, `jobs/scheduler*.test.ts`, `push/test-seam.test.ts`, `routes/routes.test.ts` | Fake `asServiceRole`, test keys, a signed `service_role` token | Test code, exempt by `**/*.test.ts`; none builds a real client |
| `supabase/seed/seed-users.ts`, `e2e/setup/stack.ts:152`, `e2e/support/push.ts` | Read the service-role key for the dev seed and for E2E requests | Dev and test tooling outside the service tree, outside the fence by design |
| Role switches and clients (second pass) | `set local role authenticated` and `anon` in `db/user-db.ts`; `test/integration-db.ts` (test support, exempt) switches to a role the test names, which is how the integration tests act as `service_role`; no `set local role service_role`, no `createClient(`, no `require(`, no non-literal `import(` in non-test service code | None builds a privileged connection |

audit-violations=0

## Gates and decisions

pr1-merged=1b0e69f2414cf3619b8941a8596842edee6d274d
pr2-ready=f246c74ec58e88b93020eafa3320c4d4cdca129b

- 04-04 Task 1: PR 1 (#15) is merged; `origin/main` is 1b0e69f. `test/guard-tests` took it by a plain merge (no conflict, no lockfile change) and is pushed at f246c74. Its diff against `origin/main` is exactly the four PR 2 files, and `package.json` changes only the `test:harness` line. Frozen install, lint, format:check, typecheck, `pnpm test` (harness 215/215 with the fence probe; shared 172/172 with the PATCH guard, 24 cases), `pnpm build`, commitlint and knip (nothing beyond the Phase 3 baseline) pass; the full unit sweep is 36/36. No pull request exists yet; the owner gate (`gate-pr2=`) is pending.

- Plan 04-03 has no owner gate. PR 2 is opened in 04-04 after PR 1 is merged (D-11); `test/guard-tests` is based on `origin/main` at 9819e7c and is pushed at 72b0668741791409946a7fd7cd071d51fdf99a9d.
- The branch diff against `origin/main` is exactly `docs/testing.md`, `package.json` (the `test:harness` line only), `packages/shared/src/api/patch-schemas.test.ts` and `test/eslint-service-role-fence.test.mjs`; `eslint.config.js` and `bills.ts` are unchanged.
- Known gaps of the fence, written in the test header and `docs/testing.md`, not closed here (no fence change without a finding): a dynamic import of a variable or template literal, `require`, a raw `set local role service_role`, and code outside `apps/service/src`. The audit found none of them in use.

## CI

No pull request yet (04-04).
