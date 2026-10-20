# Fix ledger: PR 3 (infra FIX-06, FIX-07)

base=9819e7c1436a8ad984f459c9fcb3e62fa68e0806
stacked-on=test/guard-tests@72b0668741791409946a7fd7cd071d51fdf99a9d
branch=fix/deploy-kong
continuation=fix/kong-allowlist

Raw logs are under `.planning/cleanup/logs/` (gitignored) as `04-05-{fix}-{red,green,...}.log`. PR 3 is stacked on PR 2's branch so the `test:harness` line and the testing-doc counts build on PR 2's; it is opened only after PR 1 and PR 2 are merged (D-11).

## Red and green

| FIX | Test | Red (unfixed) | Green (fixed) | Commit |
| --- | --- | --- | --- | --- |
| FIX-06 | `scripts/deploy.test.mjs` (6 cases: runs to the end against the stubs; the password is on no command line; the script does not print it; only the `supabase` stub sees `PGPASSWORD`; the `--db-url` is user and host only; a password with URL-reserved characters arrives intact) | `node --test scripts/deploy.test.mjs` in `../hearth-deploy-kong` on the unfixed `deploy.sh`: exit=1, `ℹ pass 2`, `ℹ fail 4`. Failing: `is on no command line` (`AssertionError: supabase was given the password`), `reaches the migration command through its environment, and nothing else` (`+ 'PGPASSWORD=<unset>'`, the CLI never saw `PGPASSWORD`), `leaves the connection string as user and host only` (the URL carried a password), `arrives intact, which a password inside a URL would not`. Passing: `runs to the end against the stubs`, `is not printed by the script either`. | Same command after the one-command change: exit=0, `ℹ pass 6`, `ℹ fail 0`. `bash -n scripts/deploy.sh`, ESLint `--max-warnings=0` and Prettier on the test and `package.json`: exit=0. `pnpm test:harness`: 221 tests, 221 pass, exit=0. `deploy.sh` stays mode 100755; its diff against `origin/test/guard-tests` is one hunk. | e05a2203a6819c96c98643db28beaa58dfa55926 (`fix/deploy-kong`) |
| FIX-07 (E2E) | Two tests in `e2e/tests/08-caddy-refuses-gotrue-endpoints.spec.ts`: `Kong refuses every GoTrue path and method that has no route, with or without a key` (17 method and path pairs, each with and without the anon `apikey`, `expect.soft` on status 403 and on the body `Access is forbidden.`) and `Kong answers the calls the PWA makes itself`. `docker/kong.yml` is unchanged on this branch, so the refusal test is expected to fail. | pending PR 3 CI | pending PR 3 CI | 1f3f36cd8f180c496976ffb9fee01c76cb15d954 (`fix/deploy-kong`) |

## Findings

- FIX-06: the stub run makes the test non-vacuous: case (a) requires a logged `supabase migration up`, and the other cases read the same log, so a run that escaped the stubs cannot pass quietly. The passwords in the test are made-up sentinels; no real credential appears in the test, logs or this ledger.
- FIX-06: T-04-13 (`PGPASSWORD` readable in `/proc/{pid}/environ` while the migration runs) is accepted per D-09.

## Gates and decisions

- Plan 04-05 Task 1: `fix/deploy-kong` was cut from `origin/test/guard-tests` at 72b0668741791409946a7fd7cd071d51fdf99a9d and pushed at e05a2203a6819c96c98643db28beaa58dfa55926. Its diff against `origin/main` is PR 2's four files plus `docs/deploy.md`, `docs/testing.md`, `package.json` (the `test:harness` line only), `scripts/deploy.sh` and `scripts/deploy.test.mjs`.
- Plan 04-05 Task 2: the Kong probes sit on `fix/deploy-kong` with `docker/kong.yml` equal to `origin/main`'s (`git diff --quiet origin/main -- docker/kong.yml`), so PR 3's `test-e2e` run can fail on them (04-07). e2e typecheck, ESLint `--max-warnings=0` and Prettier on the spec: exit=0.

gate-yaml=approve (owner, 2026-10-20)

pr3-head-candidate=1f3f36cd8f180c496976ffb9fee01c76cb15d954

## CI

No pull request yet (04-07).
