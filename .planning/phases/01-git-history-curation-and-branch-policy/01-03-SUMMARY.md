---
phase: 01-git-history-curation-and-branch-policy
plan: 03
subsystem: infra
tags: [git, history-proof, rebase-exec, typecheck, crlf, file-modes, secret-scan, commitlint]

requires:
  - phase: 01-02
    provides: "curated-main (local only): 44 commits on 7da55e3, tip 83eae2c, single identity alex.c.tanton@gmail.com"
provides:
  - "Proven curated tip 83eae2c841ab8de096d52990f8f3be3f4379c448 (44 commits), recorded in 01-REWRITE-PROPOSAL.md ## Proof results for Gate 2"
  - "Per-commit typecheck proof: 43 PASS, 1 SKIP via git rebase --exec, curated-main SHAs unchanged"
  - "Mode and CRLF scan across all 44 commits with a working detector control; secret scan with 0 unexpected hits and 0 tracked env files"
  - "Proof logs in ../hearth-aside/logs/ and the helper ../hearth-aside/bin/typecheck-commit.sh"
affects: [01-04, 01-05]

actuals:
  tokens: 2000
  tasks: 2
  commits: 0
plan_head_before: 38f3a8878d8e0899406b31f025239ccfae1b876f
plan_head_after: 38f3a8878d8e0899406b31f025239ccfae1b876f

tech-stack:
  added: []
  patterns:
    - "git rebase --exec over a fast-forwarding range as a per-commit build proof that leaves SHAs unchanged"
    - "Detector control: plant a CRLF file in a throwaway repo and require the scan to flag it before trusting a zero"
    - "Proof scans read git objects (ls-tree, grep {rev}, log -p), never the Windows working tree"

key-files:
  created:
    - "../hearth-aside/bin/typecheck-commit.sh (outside the repo)"
  modified:
    - ".planning/phases/01-git-history-curation-and-branch-policy/01-REWRITE-PROPOSAL.md (## Proof results, local-only)"

key-decisions:
  - "The proven tip is 83eae2c841ab8de096d52990f8f3be3f4379c448; plans 01-04 and 01-05 push only this SHA"
  - "Secret-scan category 3 (test-only credential) was applied to the test support modules apps/service/src/test/ and apps/web/src/test/ as well as the plan's listed paths; they are imported only by tests"

requirements-completed: [GIT-01, GIT-04]

duration: ~14min
completed: 2026-10-11
status: complete
---

# Phase 1 Plan 03: Prove the Curated History Summary

**Every one of the 44 commits on `curated-main` typechecks with its own lockfile (43 PASS, 1 SKIP for the docs-only first commit), every shebang script and both Husky hooks are `100755` and CRLF-free in every commit, no commit touches `.planning/` or `.claude/`, and a secret scan finds nothing unexpected. The tip is unchanged at `83eae2c841ab8de096d52990f8f3be3f4379c448`. Nothing was committed or pushed.**

## Performance

- **Duration:** about 14 min; the `git rebase --exec` pass took about 10 min (21:22:10Z to 21:32:23Z)
- **Tasks:** 2 of 2 (both `auto`; no tracer, this plan only verifies)
- **Files:** one local-only planning file edited (`## Proof results`); one helper script written outside the repo

## Accomplishments

### Task 1: per-commit typecheck through `git rebase --exec` (D-02)

- Recorded the tip in `../hearth-aside/logs/curated-tip.txt` (`83eae2c841ab8de096d52990f8f3be3f4379c448`); 44 commits in `7da55e3..curated-main`, worktree clean.
- Wrote `../hearth-aside/bin/typecheck-commit.sh`: prints `SKIP` when `package.json` is absent, otherwise runs `pnpm install --frozen-lockfile --prefer-offline --reporter=silent` then `pnpm typecheck`, appending to `typecheck-detail.log`, and prints `PASS` or `FAIL` plus the short SHA.
- Ran `git rebase --exec 'sh ../hearth-aside/bin/typecheck-commit.sh' 7da55e387f0a766c26c1913004f060608c5152f9` in `../hearth-curate`. 88 todo steps (44 picks, 44 execs). Result: 43 `PASS`, 1 `SKIP` (`07db639`, formerly `e86c43c`), 0 `FAIL`, ending `Successfully rebased and updated refs/heads/curated-main.`
- The PASS/SKIP SHAs match `git rev-list --reverse 7da55e3..curated-main` one for one. Because the base did not change, every pick fast-forwarded: `curated-main` equals `curated-tip.txt` afterwards, so no restore from the backup was needed and no `reset --hard` was run. The worktree stayed clean (no step 4 recovery).
- Ran `pnpm install --frozen-lockfile` in `../hearth-curate` afterwards (already up to date).
- The plan's Task 1 automated verify passed in full.

### Task 2: modes, CRLF, planning paths, secrets, quick proofs

- **Detector control:** a throwaway repo at `../hearth-aside/control` with a CRLF `bad.sh` (`core.autocrlf=false`, no `.gitattributes`); `git grep -l -I -P '\r$' HEAD -- '*.sh'` reported it, so `mode-eol-scan.txt` starts with `CONTROL crlf-detected bad.sh`.
- **Mode and EOL scan (GIT-04, D-04), 44 commits:** `RESULT nonexec=0 crlf=0 husky_nonexec=0 commits=44`. The shebang scan is not vacuous: at the tip it finds the 5 expected files (`apps/service/bin/hearth-admin`, `docker/caddy-entrypoint.sh`, `docker/kong-entrypoint.sh`, `scripts/deploy.sh`, `scripts/generate-secrets.sh`, all 100755) and the two hooks are 100755.
- **Planning paths and config (D-03, D-06):** 0 commits touch `.planning` or `.claude`; `.gitignore` and `.github/` are byte-identical to `b96ca32`.
- **Secret scan (T-01-09):** 133 pattern hits over `git log -p` of all 44 commits (0 for private key, AKIA, GitHub token and Slack token; 2 JWT, 22 DSN, 109 credential-assignment, counts cross-checked with `grep -cE`). All classified benign: 13 local dev defaults, 0 public sample tokens, 78 test-only, 42 variable references. `RESULT unexpected=0 envfiles=0 commits=44`; the only tracked env file is `.env.example`.
- **Quick proofs at the tip:** `git diff --name-only b96ca32 83eae2c` lists exactly `.husky/commit-msg`, `.husky/pre-commit`, `CONTRIBUTING.md`, `docs/file-map.md`; `commitlint --from 7da55e3 --to 83eae2c...` exit 0; one author and committer address (`alex.c.tanton@gmail.com`); `git push --dry-run origin 83eae2c841ab8de096d52990f8f3be3f4379c448:refs/heads/main` printed `7da55e3..83eae2c` (fast-forward, nothing sent).
- Replaced `## Proof results` in `01-REWRITE-PROPOSAL.md` with the tip SHA, the four-path diff, commitlint, typecheck counts, the CONTROL and both RESULT lines verbatim, the per-category secret summary, the identity and the dry-run line.
- The plan's Task 2 automated verify passed in full.

## Final state

| Ref | Value |
| --- | --- |
| `curated-main` (tip, proven) | `83eae2c841ab8de096d52990f8f3be3f4379c448` |
| Range | 44 commits on `7da55e3` |
| `main`, `backup/pre-curation` | both `38f3a88`, untouched |
| `origin` | still only `main` at `7da55e3`, nothing pushed |
| `../hearth-aside/pre-curation.bundle` | present, untouched |

## Task Commits

No commits in this plan, by design (phase rule 2, D-03, `commit_docs=false`). Both tasks only read git objects and write proof logs outside the repository plus one local-only planning file. `commits: 0` is measured: the primary checkout's HEAD stayed at `38f3a88`, and the 44 commits of `curated-main` were not recreated by the `--exec` pass.

## Deviations from Plan

None - plan executed as written.

### Observations (no plan impact)

- Secret-scan category 3 lists `*.test.ts`, `*.test.tsx`, `e2e/` and `supabase/seed/`. The test support modules `apps/service/src/test/*` and `apps/web/src/test/*` (for example `TEST_JWT_SECRET = 'unit-test-secret-at-least-32-characters-long'`, `GOOD_PASSWORD`) are outside that literal list. They are imported only by tests (verified with `git grep` for non-test importers at the tip: none), so they were classified category 3 on that ground. The owner can re-classify them at Gate 2 if the stricter reading is preferred; the values are dummies either way.
- Both JWT hits are test dummies, not the jwt.io sample payload of category 2 (that category had 0 hits): `{"sub":"1"}` in `api.integration.test.ts` and `{"sub":"1234567890","email":"a@b.co"}` in `scrub.test.ts`.
- The documented dev seed password `hearth-seed-pass-2026` and the Postgres dev DSNs on `127.0.0.1:54322` are public in the history by design (README, `docs/testing.md`); they are local-development defaults, not production credentials.
- `git rebase --exec` over an already-linear range with an unchanged base took about 10 min for 44 commits (about 14 s per install-plus-typecheck), well under the plan's 20 to 60 min estimate.
- Node on this host is v26.10.0 against the repo's Node 24; the proof is typecheck only. Test parity is Phase 2.
- `core.filemode=false` on this host means a working-tree `ls -l` says nothing about modes; every mode check read `git ls-tree`.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file access pattern was introduced. T-01-09 (secrets in history), T-01-10 (broken intermediate, non-executable or CRLF scripts) and T-01-11 (SHAs recreated by the `--exec` pass) mitigations held: scan clean, per-commit typecheck 43 PASS with a working CRLF control, and `curated-main` equals the recorded tip after the pass.

## Self-Check: PASSED

- `curated-main` resolves to `83eae2c841ab8de096d52990f8f3be3f4379c448`, equal to `../hearth-aside/logs/curated-tip.txt`; `git rev-list --count 7da55e3..curated-main` is 44.
- `../hearth-aside/bin/typecheck-commit.sh`, `logs/typecheck-pass.log` (43 PASS, 1 SKIP, `Successfully rebased`), `logs/mode-eol-scan.txt`, `logs/secret-scan.txt`, `logs/dry-run-final.txt` and `control/bad.sh` exist.
- `01-REWRITE-PROPOSAL.md` contains `Curated tip: 83eae2c841ab8de096d52990f8f3be3f4379c448` and both RESULT lines verbatim.
- Both plan verify commands passed; `git ls-remote origin` lists only `main` at `7da55e3`; `main` and `backup/pre-curation` at `38f3a88`; bundle present; worktree `../hearth-curate` clean on `curated-main`.
