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
| FIX-07 (static) | `apps/service/src/kong-routes.test.ts` (Vitest, D-08; 32 cases: format 3.0, the exact GoTrue route table, per-route shape, `/verify` open and the rest keyed, the `admin/users` ACL is `admin` only, the four realtime routes, plugins in `KONG_PLUGINS`, eight browser calls reach their routes, seventeen refused calls reach `auth-v1-denied`) | `pnpm --filter @hearth/service exec vitest run src/kong-routes.test.ts` in `../hearth-kong-allowlist` against the unchanged `docker/kong.yml`: exit=1, `Tests  13 failed \| 19 passed (32)`. First assertion: `declares format 3.0, which regex paths need` (`AssertionError: expected '2.1' to be '3.0'`); also failing: the route table, the per-route shape, the open `/verify`, the admin ACL and the eight browser calls (each `expected 'auth-v1-denied' to be '<route>'`). Passing: the realtime, plugin and seventeen refusal cases. | Same command on the allowlist: exit=0, `Tests  32 passed (32)`. Service unit suite exit=0 (56 files, 757 tests), service typecheck, ESLint `--max-warnings=0` on the test, Prettier on `kong.yml`, the test and `package.json`, and `pnpm install --frozen-lockfile`: exit=0. Lockfile diff: 3 added, 0 deleted (importer lines for `yaml` 2.9.1 only). | 5c800a0b37efe451ec781ddd2bf3a6c69826c68d (`fix/kong-allowlist`) |

## Findings

- FIX-06: the stub run makes the test non-vacuous: case (a) requires a logged `supabase migration up`, and the other cases read the same log, so a run that escaped the stubs cannot pass quietly. The passwords in the test are made-up sentinels; no real credential appears in the test, logs or this ledger.
- FIX-06: T-04-13 (`PGPASSWORD` readable in `/proc/{pid}/environ` while the migration runs) is accepted per D-09.

## Gates and decisions

- Plan 04-05 Task 1: `fix/deploy-kong` was cut from `origin/test/guard-tests` at 72b0668741791409946a7fd7cd071d51fdf99a9d and pushed at e05a2203a6819c96c98643db28beaa58dfa55926. Its diff against `origin/main` is PR 2's four files plus `docs/deploy.md`, `docs/testing.md`, `package.json` (the `test:harness` line only), `scripts/deploy.sh` and `scripts/deploy.test.mjs`.
- Plan 04-05 Task 2: the Kong probes sit on `fix/deploy-kong` with `docker/kong.yml` equal to `origin/main`'s (`git diff --quiet origin/main -- docker/kong.yml`), so PR 3's `test-e2e` run can fail on them (04-07). e2e typecheck, ESLint `--max-warnings=0` and Prettier on the spec: exit=0.

gate-yaml=approve (owner, 2026-10-20)

kong-parse=skipped (no daemon)

kong-allowlist-tip=1e482269fc1424811a3a5d01b1e9973a3a570c22

docs-commit=1e482269fc1424811a3a5d01b1e9973a3a570c22

pr3-head-candidate=1f3f36cd8f180c496976ffb9fee01c76cb15d954

pr2-merged=7da14613cd4060086c3ce8daeb13ffcfb0afd20b
pr3-ready=F:19f16fb35a65b6f523149c802dc375c9da77ed4d K:7c0efdc0855e002606fc2924d00b85dac101bf6a
gate-pr3=approve (owner, 2026-10-20)

- 04-07 Task 1: PR 2 (#16) is merged as the squash `7da1461` on `origin/main` (one commit, the four PR 2 files; read with git, because the GitHub CLI token was invalid in this session). `origin/main` went into the working branch by a plain merge, then into `fix/deploy-kong` (F) as `19f16fb`. The two conflicted files (`package.json`, `docs/testing.md`) took F's side in every conflicted hunk; F's `test:harness` line is `origin/main`'s plus ` scripts/deploy.test.mjs`, and nothing else in `package.json` differs. `fix/deploy-kong` went into `fix/kong-allowlist` (K) as `7c0efdc` with no conflict. `pnpm-lock.yaml` needed no merge work (K's three `yaml` importer lines apply as they were). Both branches were pushed as plain fast-forwards (`1f3f36c..19f16fb`, `1e48226..7c0efdc`).
- Content: K's diff against `origin/main` is the ten PR 3 files (`apps/service/package.json`, `apps/service/src/kong-routes.test.ts`, `docker/kong.yml`, `docs/deploy.md`, `docs/testing.md`, the spec 08 file, `package.json`, `pnpm-lock.yaml`, `scripts/deploy.sh`, `scripts/deploy.test.mjs`), `apps/service/package.json` differs only by `"yaml": "2.9.1"`, and the secret pattern matches nothing in the added lines. F's diff is the six files without the Kong change, the two `apps/service` files and the lockfile.
- Local proof, Node v24.21.0, `TZ` unset, logs `04-07-*` in the gitignored logs folder, each ending `exit=0`: at K's tip frozen install, lint, `format:check`, typecheck, `pnpm test` (harness 221/221 with the deploy test and the fence probe; service 757, including the Kong route test, web 726), `pnpm build` (app shell 198.0 KB against the 200 KB budget), commitlint `--from origin/main --to HEAD`, `bash -n scripts/deploy.sh`; the unit sweep is 36/36. At F's tip (the red-run head) frozen install, lint, typecheck and test pass, so run A can fail only on the Kong probes. knip exits 1 as on the Phase 3 baseline and reports no line beyond `phase3-after-default-summary.txt` (`04-07-knip-new.txt` is empty).
- The PR body is drafted in the gitignored `04-07-pr3.md` (FIX-06, FIX-07 with the allowlist table, the CI plan, the host step with `hearth-compose up -d --force-recreate kong`, `## Risks & Dependencies`). No pull request exists for `fix/deploy-kong`.

## CI

No pull request yet (04-07).
