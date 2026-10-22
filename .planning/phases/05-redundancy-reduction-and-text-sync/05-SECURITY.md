---
phase: "05"
slug: redundancy-reduction-and-text-sync
status: verified
threats_total: 39
threats_closed: 39
threats_open: 0
asvs_level: 1
block_on: high
created: "2026-10-22"
---

# Phase 05 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Audited ref: origin/main a5c4384 (code, docs) plus working branch claude/eloquent-mayer-szjtjf 0bf13b8 (.planning). Phase base c64d79e.
> Order of PRs on main: A ac8ef34, B a660d58, C 9fdc9c9, D a5c4384.

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| ci.yml -> deploy.yml | Deploy fires on `workflow_run` of the workflow named `CI` |
| session -> GitHub (push) | `GH_TOKEN` authenticates pushes; it must never leave the environment; no `workflow` scope |
| patch hand-off -> owner's push | the owner pushes exactly the proven tree |
| test helper -> test files | shared helpers decide stack, app, online state, pointer and clock |
| codemod -> source/config/fixtures | automated comment edits must not change code, directives, SQL text, config values or importer output |
| docs/maps/CLAUDE.md -> operators and future agents | wrong or dropped statements mislead |
| branch -> main | each squash merge publishes history and queues Deploy |
| npm registry -> repo | no package may enter |

## Threat Register

Severity ordering critical > high > medium > low. Status: CLOSED or OPEN. All dispositions are mitigate.

| Threat ID | Category | Severity | Disposition | Status | Evidence |
|-----------|----------|----------|-------------|--------|----------|
| T-05-01 | Tampering | high | mitigate | CLOSED | `ci.yml:1` `name: CI`; job ids lint, typecheck, test-unit, test-integration, test-e2e, build in order; the six `uses: ./.github/actions/setup` at `ci.yml:21,29,36,43,69,120`. Independent script expanded the composite into every job and deep-compared parsed YAML with c64d79e: `EXPANDED_EQUALS_BASE true` (name, ids, on, permissions, concurrency equal). `deploy.yml:8` `workflows: [CI]` unchanged. REST: PR A head run 39650921896 has six jobs success. |
| T-05-02 | Information disclosure | high | mitigate | CLOSED | `grep -rIlF "$GH_TOKEN" .planning .claude` (incl. gitignored logs) and sibling worktrees: no match. `git log --all -F -S"$GH_TOKEN"`: empty. Pattern scan (ghp_/gho_/ghs_/github_pat_/x-access-token/dckr_pat_/npm_/AKIA/xox/PRIVATE KEY/JWT shape) over tracked, untracked and ignored files in `.planning .claude`: no hit; `git log --all -G<same patterns> -- .planning .claude .github`: empty. `SERVICE_ROLE_KEY\|JWT_SECRET\|VAPID_PRIVATE_KEY\|ANON_KEY\|POSTGRES_PASSWORD` assignment scan: only earlier-phase test sentinels (`04-05-PLAN.md:138`, `01-03-SUMMARY.md:99`). origin URL carries no credentials; `.git/config` has none. The plans show the helper only as `$GH_TOKEN` inside a single-quoted helper (`05-01-PLAN.md:180`); no `set -x` added anywhere. Limit: logs for 05-01..05-08 are not on disk here. |
| T-05-03 | Tampering | medium | mitigate | CLOSED | `.planning/cleanup/patches/ci-setup-action/apply.sh:14-15` pins BASE and TREE, `:44` `git am --3way`, `:48-49` refuses to push on tree mismatch, `:54` DRY_RUN. Rebuilt the tree by applying the three patches to c64d79e through a temp index: `fd704a4c1fbb066fb7402eaee02a950aae456177`, equal to apply.sh TREE and to `git rev-parse ac8ef34^{tree}`. |
| T-05-04 | Tampering | low | mitigate | CLOSED | `.github/dependabot.yml:14` `directories: ['/', '/.github/actions/setup']`; file parses; npm/docker entries unchanged. Dependabot's first post-merge run cannot be observed yet (non-blocking). |
| T-05-05 | Tampering | medium | mitigate | CLOSED | `apps/service/src/test/stack-hooks.ts:17-30` hook bodies match the removed per-file hooks (c64d79e `api.integration.test.ts:42-53`). Over all 456 changed ts/tsx files `describe/it/test` declarations 1608 -> 1608, skip/only/todo 0 -> 0, `expect` 3342 -> 3332 = the 11 removed local `expectStatus` bodies minus the one in `stack-hooks.ts:32`. CI logs: `test-integration` "Tests 1190 passed" (76 files) identical on runs 39653516611, 39658694324, 39661257811, 39707916284, 39709025122, 39718363858. Unit counts identical between base CI (39645569683, head c64d79e) and final CI (39718363858): matching 156, shared 172, recurrence 77, service 757, web 728. |
| T-05-06 | Tampering | low | mitigate | CLOSED | `grep` of `stack-hooks.ts`, `job-logger.ts`, `browser.ts`: no `new Date()`, `Date.now()`, `performance.now` or `privileged`. `eslint.config.js:146-166` clock ban lists `apps/service/src/test/**` and `apps/web/src/test/**`; fence at `eslint.config.js:97-127` intact. `lint` job success in every run. |
| T-05-07 | Denial of Service | high | mitigate | CLOSED | REST: PR A head run 39650921896 (pull_request, head 4367263, attempt 1) lint, typecheck, test-unit, test-integration, test-e2e, build all success. Main after A: run 39653516611 attempt 2 success (attempt 1: one e2e spec, owner-approved rerun, not setup related). Later main runs 39661257811, 39709025122, 39718363858 success. |
| T-05-08 | Repudiation | low | mitigate | CLOSED | Ledger run ids confirmed by REST: 39650921896, 39653516611 (attempt 2), 39661257811, 39718363858 and PR #26 `merged=true merge_commit=ac8ef34 changed_files=5`. `CI-SETUP-LEDGER.md:138` `steps-compare=as-expected`, `:151` `ci-seed-typecheck=once`. |
| T-05-09 | Tampering | medium | mitigate | CLOSED | `apps/web/src/test/browser.ts` replaces hooks 1:1: 8 removed `afterEach` blocks (`onlineManager.setOnline(true); vi.unstubAllGlobals(); vi.restoreAllMocks()`) vs 5 `registerBrowserStubs()` + 3 `registerHouseholdClock(PINNED_INSTANT)`; 3 removed `useFakeTimers/setSystemTime` vs 3 helper calls. Web declaration and `expect` counts equal per file; web unit 728 = 728. |
| T-05-10 | Tampering | low | mitigate | CLOSED | `registerHouseholdClock(instant: Date)` takes an explicit instant; the three call sites pass `PINNED_INSTANT` (`chores/household-timezone.test.tsx:59`, `bills/household-timezone.test.tsx:62`, `screens/household-timezone.test.tsx:106`); no clock read in `browser.ts`; `eslint.config.js` clock ban covers `apps/web/src/test/**`. |
| T-05-11 | Tampering | medium | mitigate | CLOSED | Four sync merges 1ab6170, 708c714, 3a561ad, 0db4b1b: outside `.planning`, each equals its origin/main parent (ac8ef34, a660d58, 9fdc9c9, a5c4384). No `.planning` file deleted vs c64d79e. WB HEAD vs origin/main outside `.planning`: only `apps/service/vitest.integration.config.ts` (unpublished comment-only fix f6dd737). |
| T-05-12 | Tampering | medium | mitigate | CLOSED | `git diff c64d79e origin/test/shared-fixtures-wip -- apps \| git patch-id --stable` = `git diff ac8ef34 a660d58 -- apps \| git patch-id --stable` = `4e14160077f92434539b1111d2fab446a0b88000` (equals ledger `pr-b-patch-id`); 41 non-.planning files on both sides. |
| T-05-13 | Denial of Service | medium | mitigate | CLOSED | Integration count 1190 (76 files) on main before PR B (39653516611), PR B head (39658694324) and every later run; PR B six green; owner squash a660d58. |
| T-05-14 | Information disclosure | high | mitigate | CLOSED | As T-05-02. Sync push targeted only `refs/heads/claude/eloquent-mayer-szjtjf` (`CI-SETUP-LEDGER.md:206-211`, `post-a-sync=claude`); `apply.sh` never reads a token (header comment, no token variable in script). |
| T-05-15 | Tampering | high | mitigate | CLOSED | Independent comparator over c64d79e..origin/main (all ts/tsx/js/mjs): 398 files token-equal AND react-jsx emit-equal; the 55 others are PR B test adoption (verified under T-05-05) and PR C title commits. PR C range a660d58..9fdc9c9: 416 files comment-only; with `describe/it/test` first-argument strings blanked, 449 equal, the other 2 (`jobs/log-autopay.test.ts`, `log-autopay.integration.test.ts`) differ only by one prettier trailing comma after a joined title (token diff shows only `CommaToken`). Directive-marker scan (eslint-disable/enable, @ts-*, v8/c8 ignore, istanbul, prettier-ignore, <reference, @vite-ignore, @vitest-, @jsx, __PURE__, sourceMappingURL, shebang, syntax=) over every added and removed line outside .planning/docs: zero hits. `eslint.config.js` and `commitlint.config.js` diffs are comment lines only. CI lint/typecheck/test green. |
| T-05-16 | Tampering | medium | mitigate | CLOSED | Per-site dispositions in `.planning/cleanup/text-sync/batch-*.tsv` (removed / rewritten / left:title / reported). Spot check of rewritten sites keeps the rule: "Nothing is sent for overdue chores", "Activity within 14 days keeps a postal code active", "The outbox's unique key makes a rerun a no-op", "Only quiet hours use the recipient's own timezone". |
| T-05-17 | Tampering | high | mitigate | CLOSED | `git diff --quiet c64d79e origin/main -- supabase/migrations` passes (also vs WB HEAD). PR #28 file list via REST (507 files, paged) has 0 `supabase/migrations/` paths; PR #26, #27, #29 also 0. 17 retired-spec citation lines remain in migrations at both refs (intended). |
| T-05-18 | Tampering | high | mitigate | CLOSED | Service files holding SQL templates and `privileged/*` are in the 398 token-equal set (template-literal leaves are compared). Fence rules intact at `eslint.config.js:97-127`. PR C head run 39707916284 six success (104 e2e passed, 1190 integration); main after C 39709025122 success. |
| T-05-19 | Tampering | medium | mitigate | CLOSED | Rewritten sites recorded as `rewritten` in the batch TSVs (service-domain 50, service-http 9, service-tests 38 ...). Diff of `privileged/notification-outbox.ts`, `scheduled-reminders.ts`, `services/deals/dormancy.ts`, `gotrue-admin.ts`, `service-role-db.ts`: citations removed, the rounding/dormancy/outbox/sanctioned-caller rules kept. |
| T-05-20 | Information disclosure | medium | mitigate | CLOSED | `docs/deploy.md:74-86` names every Kong route (auth-v1-verify, -token, -logout, -user, -otp, -admin-users, -denied, realtime-v1-ws, realtime-v1-rest) and the refusal of `/api/tenants` and `/api/openapi` (the two sub-routes match `kong.yml`); `:175-182` has `hearth-compose up -d --force-recreate kong`; `:163` PGPASSWORD matches `scripts/deploy.sh:90,97`. |
| T-05-21 | Repudiation | low | mitigate | CLOSED | `git ls-tree` docs: 7 files at origin/main and HEAD (architecture, branding, deploy, design, file-map, testing, use-cases); `git diff --diff-filter=A c64d79e origin/main -- docs` empty; no review/decision/adr/log name. PR #29 touches only those existing files. |
| T-05-22 | Tampering | medium | mitigate | CLOSED | Every web .tsx in the 398 set passes react-jsx emit equality (rendered children, text, attributes) and token equality with empty `{/* */}` containers and whitespace-only JSX text ignored. Web unit 728 = 728; `build` job and 104 e2e green on PR C head and on main. |
| T-05-23 | Tampering | low | mitigate | CLOSED | A11y-keyword mentions decreased in 7 web files (RotationEditor, RecipeCard, Sheet, RecipeForm, JoinHouseholdStep, ChangeEmailForm, ChangePasswordForm); in each only the citation label went (`Accessibility > Focus management`, `Design > 17`) and the why stayed (e.g. "focus moves into what replaced the control rather than falling back to the page", "`aria-hidden` ... the text carries the percentage"). |
| T-05-24 | Tampering | high | mitigate | CLOSED | Independent per-type checks: YAML parsed deep-equal for `docker/kong.yml`, `docker/docker-compose.yml`, `e2e/docker-compose.e2e.yml`, `.github/workflows/deploy.yml`; `supabase/config.toml` tomllib-equal; `apps/web/src/index.css` equal after stripping `/* */`; `bash -n scripts/deploy.sh` OK; every changed line in `.env.example`, `docker/Caddyfile`, `docker/caddy.Dockerfile`, `scripts/deploy.sh`, `supabase/seed/seed.sql`, `e2e/fixtures/e2e-seed.sql` is a full-line `#` or `--` comment. None of those files has a heredoc or multi-line string (grep count 0), so review WR-02 cannot apply. `# syntax=docker/dockerfile:1` untouched. |
| T-05-25 | Tampering | medium | mitigate | CLOSED | `docker/kong.yml` parsed equal to c64d79e; `TEXT-SYNC-LEDGER.md:330` `kong-yaml-equal=yes`; PR #28 body line 72: "parses to the same configuration, so no Kong recreate is needed". |
| T-05-26 | Tampering | medium | mitigate | CLOSED | ld+json block hash identical base vs head in all three fixtures; the added lines contain no `<`, so no markup or script was added; `extractRecipeJsonLd` output JSON-equal for dark, light and no-json-ld; the removed phrases are consumed nowhere (only unrelated comments match); e2e spec 13 passed light and dark on PR C head (104 passed). |
| T-05-27 | Repudiation | medium | mitigate | CLOSED | Title-blanked comparator: only the first string argument of `describe/it/test` changed (449 files equal, 2 differ by a trailing comma only); declaration count 1608 = 1608; no snapshots and no `--grep`/`-t` selectors in package scripts or workflows; `TEXT-SYNC-LEDGER.md:259` `title-consumers=none`, `:266` `titles-counts-equal=yes`. |
| T-05-28 | Tampering | high | mitigate | CLOSED | PR #28 changed-file list (REST, 507) minus `.planning` equals `git diff --name-only a660d58 9fdc9c9`; whole-range independent checks as T-05-15; PR C head 0ce37f6 run 39707916284 six success; main run 39709025122 success. |
| T-05-29 | Tampering | high | mitigate | CLOSED | As T-05-17: migrations byte-identical, 0 migration paths in PR #28, citation count 17 = 17. |
| T-05-30 | Denial of Service | medium | mitigate | CLOSED | Kong YAML equal (T-05-25); fixtures verified (T-05-26); PR C head e2e 104 passed and integration 1190; main CI after C and D success. |
| T-05-31 | Tampering | medium | mitigate | CLOSED | `.claude/CLAUDE.md` E2E section from line 549 (`## Running E2E in the Claude cloud sandbox`) is byte-identical to c64d79e (`cmp`, 1458 bytes). The six `## Project` constraints (Behavior, Evidence, Verification, Tech stack, Git, Docs) are present; the only change is the Git bullet gaining "(Phase 1, ... from d3da748)". GSD Workflow Enforcement and Developer Profile blocks retained. |
| T-05-32 | Information disclosure | medium | mitigate | CLOSED | `.claude/CLAUDE.md` and `.planning/codebase/*.md` mention only environment variable names (e.g. `.claude/CLAUDE.md:114,118`), no values; no long opaque token outside paths and URLs; secret scans under T-05-02 clean. |
| T-05-33 | Repudiation | low | mitigate | CLOSED | All seven maps carry `last_mapped_commit: 283f15dbb2b5ed8ded0ba14e04d5015e5d0d367c`; `git merge-base --is-ancestor 9fdc9c9 283f15d` = yes. |
| T-05-34 | Repudiation | low | mitigate | CLOSED | `REDUNDANCY-LEDGER.md` rows RED-01..RED-05 name PR, squash commit and ledger keys. Post-conditions re-run on final main: citation grep (`cit-rx.txt`) outside .planning/docs/migrations = 0, migrations identical, docs = 7, test counts equal (T-05-05). |
| T-05-35 | Denial of Service | low | mitigate | CLOSED | PR D head run 39716090446 (docs/sync-specs, attempt 1) six success; main after D run 39718363858 success. PR D changed no executable code (`.claude/CLAUDE.md`, `README.md`, one comment line in `docker/docker-compose.yml`, `docs/`). |
| T-05-36 | Tampering | medium | mitigate | CLOSED | Migrations identical; docs file count 7 on head and final main; PR #29 file list via REST (28 files): no migration path, no added docs file. |
| T-05-37 | Elevation of privilege | high | mitigate | CLOSED | One `workflow`-scope refusal (05-01, `CI-SETUP-LEDGER.md:79` `pr-a-push=fallback`), handled by the owner's own push through `apply.sh` (T-05-03). The later sync was an ordinary push to the WB ref only (`:206-211`). Across all remote branches, no Phase 5 branch carries `.github` changes vs c64d79e (`test/shared-fixtures-wip`: 0); PRs B, C, D touch no workflow file; the other branches with `.github` differences are pre-phase (dated 10-12 and 10-20). |
| T-05-38 | Tampering | medium | mitigate | CLOSED | No hand-off was needed for the sync (ordinary merge accepted), and the patches directory holds only `ci-setup-action/`, so the sync apply.sh path was never exercised. All four sync merges equal main outside `.planning` (T-05-11); the PR A hand-off is proven under T-05-03. |
| T-05-SC | Tampering | high | mitigate | CLOSED | Phase diff over manifests: only `apps/service/package.json:13` (`"typecheck": "tsc --noEmit"`); `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` byte-identical to c64d79e (also at WB HEAD); no new manifest or lockfile; `jscpd` absent from every manifest and the lock. Install steps are `pnpm install --frozen-lockfile` only (`.github/actions/setup/action.yml:14`; `05-13-frozen.log` `exit=0`). Third-party actions pinned exactly as before (`pnpm/action-setup@v6`, `actions/setup-node@v7`, `supabase/setup-cli@v3`, `docker/login-action@v4`, `actions/upload-artifact@v7`, `actions/checkout@v7`); only `./.github/actions/setup` is new. `ci.yml` secret references stay at 3, the composite has no inputs, env, secrets or tokens, and `permissions: contents: read` is unchanged. |

*Status: open | closed. Severity: critical > high > medium > low. Only open threats at or above block_on count toward threats_open.*

## Accepted Risks Log

None. Every Phase 5 threat has disposition `mitigate`.

Context only (not a risk acceptance):
- D-05 (owner) fixes the duplication baseline tool as jscpd 5.4.1 run through `pnpm dlx`, never installed. Verified: not in any manifest or lockfile.
- D-12 (owner) put three steps, not four, in the composite action because a local action cannot load before checkout. This is not a security exception.

## Unregistered Flags

None. All 13 SUMMARY `## Threat Flags` sections state "None".

## Non-blocking Observations (not counted in threats_open)

1. Proof-tool weaknesses (review WR-01 to WR-03): `comment-only-check --titles` blanks non-title first arguments, `nonts-comment-check` accepts a `#` line inside a heredoc, and the directive guard is one-way. No defect landed, because the independent comparator above found the same result. Harden before Phase 6 reuses the tools.
2. `f6dd737` (comment-only edit of `apps/service/vitest.integration.config.ts`) exists only on the working branch. Re-run a comment-only check when it ships.
3. Main CI at a5c4384 needed three attempts (notification e2e specs 17 and 19). PR D changed no executable code. Tracked for Phase 6.
4. Third-party actions are tag-pinned (`@v6`, `@v7`), not SHA-pinned, as before the phase and Dependabot-managed. Not a regression.
5. Earlier-phase test sentinel strings in `.planning` (`svc-sentinel-7d41b09e`, `TEST_JWT_SECRET` value) are fixtures, not credentials.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-22 | 39 | 39 | 0 | gsd-security-auditor |

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented (none)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-22
