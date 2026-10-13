# Phase 1 Rewrite Proposal

Approval vehicle for the history rewrite and first publish. Local-only (`.planning/`, never committed, never in `docs/`). Product tip `b96ca32`, base `7da55e3` (`origin/main`). Prepared 2026-10-11 by plan 01-01.

## Summary

- 51 product commits (`e86c43c..b96ca32`) become 43 after 8 folds (`fixup`), plus 1 policy commit (`CONTRIBUTING.md`), 44 commits in total on top of `7da55e3`. 43 is slightly above D-01's "~35-40". Folding further is possible, but each extra fold needs its own conflict and tree-identity rehearsal, so the proposal stops at the 8 folds already rehearsed conflict-free and tree-identical to `b96ca32`.
- Original range under the repo's commitlint (`@commitlint/cli` 21.2.2): 13 of 51 commits fail, all on `body-max-line-length` (body lines over 100 characters), none on type, scope, or subject length. 2 of the 13 (`114cd99`, `95b0bd2`) disappear in folds, leaving 11 to reword. The 11 reworded messages below each pass `commitlint --edit` with no line over 100 characters.
- `bee9a62` (`test(shared,matching): enforce 90% coverage thresholds`) is the only multi-scope header. It passes: `commitlint --from bee9a62~1 --to bee9a62` exits 0, because commitlint checks each comma-separated scope against the closed list. A negative control, `test(shared,nope): negative control`, fails with `scope must be one of [web, service, shared, recurrence, matching, db, e2e, docker] [scope-enum]`, so the rule is active in the curation worktree. `bee9a62` stays a plain `pick`.
- Planning commits dropped (D-03, never replayed): the rebuild starts from `b96ca32`, so every planning commit above it is excluded, including any added later. They are the 14 commits `b96ca32..main` at this writing (CONTEXT counted 7 and RESEARCH saw 9; the research, plan and plan-check steps have since added 5 more):

  ```text
  3707ef2 docs: map existing codebase
  ab2f814 docs: initialize project
  224b93b chore: add project config
  99f8447 docs: add git history and PR workflow to project scope
  1cd79c0 docs: complete project research
  307ec55 docs: define v1 requirements
  f84077d docs: create roadmap (6 phases)
  d2d654f docs(01): capture phase context
  4bec3ce docs(state): record phase 1 context session
  ebeaa1b docs(01): add research and validation strategy
  dabdd77 docs(01): create phase plan
  e9aff12 fix(01): revise plans based on checker feedback
  b9c0a3e fix(01): address plan checker warnings
  38f3a88 docs(01): create phase plan
  ```

  Their only non-`.planning/` paths are `.claude/CLAUDE.md` and one `.gitignore` line (`.planning/research/.cache/`), both excluded with them.
- Nothing is pushed until Gates 2 and 3. `origin` still holds only `7da55e3`; a dry-run push of `b96ca32:refs/heads/main` showed `7da55e3..b96ca32`, a fast-forward, and sent nothing.
- Safety net in place: local branch `backup/pre-curation` (never pushed), `../hearth-aside/pre-curation.bundle` (verified), and a copy of `.planning/` and `.claude/` in `../hearth-aside/planning-copy/`.

## Commit map

One row per product commit, oldest first. `fixup` rows are applied after their target and their message is dropped; the order of the rebase todo is in `curation/todo.txt`.

| # | Old | Subject | Action |
| --- | --- | --- | --- |
| 1 | e86c43c | docs: add hearth specification documents | pick |
| 2 | 3ae2afd | build: scaffold pnpm monorepo with tooling, ci, service, and pwa | pick, reword body, .husky hooks to 100755 |
| 3 | 46d170e | docs: record flipp spike endpoints and raw 27514 fixtures | pick, reword body |
| 4 | 279b398 | feat(docker): add compose stack, caddy routing, backups, and deploy | pick, reword body |
| 5 | 8d2b6de | feat(web): add design system, navigation shell, and dashboard frame | pick, reword body |
| 6 | d257d7a | feat(db): add complete schema with rls, lifecycle functions, and seed | pick |
| 7 | 8d7730f | feat(service): add identity, household, invite, and system routes | pick |
| 8 | fbef4a6 | feat(web): add auth, onboarding, household switching, and settings | pick |
| 9 | 3d771d7 | feat(web): add magic-link screens behind the disabled flag | pick |
| 10 | a14ecea | fix(web): keep focus after the magic-link confirmation swap | fixup into 3d771d7 |
| 11 | 67b2d3b | test(e2e): add phase 1 journeys and the auth refusal smoke test | pick |
| 12 | 8f78827 | feat(service): add flipp wrapper, price parsers, and normalization | pick |
| 13 | 2b307d5 | feat(service): add shopping lists, pantry, subtotals, and repricing | pick |
| 14 | 05a2d5a | feat(service): add deal storage, deals api, and refresh jobs | pick |
| 15 | 1c8efe8 | feat(web): add deal search, flyer browse, and favorite stores | pick |
| 16 | c4198c9 | feat(web): add shopping list, pantry, and realtime screens with offline queue | pick, reword body |
| 17 | 77e642c | fix(service): coalesce in-flight fetches and fix the dormant-claim race | fixup into 05a2d5a |
| 18 | 96af7b7 | test(e2e): add phase 2 journeys and fix a stale-profile access bug | pick |
| 19 | bc1d75a | feat(matching): add fuzzy-matching benchmark, token containment, and overrides | pick |
| 20 | 13752d5 | feat(service): add recipe url parsing, ingredient parsing, and crud | pick |
| 21 | 1658f0e | feat(service): add readiness scoring, week planner, and add-missing-to-list | pick |
| 22 | 213a9b3 | feat(web): add week planner, recipe library, recipe detail, and suggestions | pick |
| 23 | 258f790 | test(e2e): add phase 3 recipe-import journey and fix a cache-flush race | pick |
| 24 | bafa74f | feat(recurrence): add anchored occurrence, rotation, and preview logic | pick, reword body |
| 25 | f2248a0 | feat(service): add bills, payment log, autopay job, and subscriptions | pick |
| 26 | d3b272e | feat(service): add chores, rotation, completions, and errands | pick |
| 27 | b2076b2 | fix(service): preserve a chore's turn across a rotation-order edit | fixup into d3b272e |
| 28 | f8a226d | feat(web): add chores, chore sheet, and errands screens | pick |
| 29 | 0ae57b4 | feat(web): add bills dashboard, bill detail, and subscriptions | pick, reword body |
| 30 | 114cd99 | fix(service): reject a rotation that repeats a member | fixup into d3b272e |
| 31 | 4365c07 | fix(e2e): give each run its own compose project, subnet, and ports | fixup into 258f790 |
| 32 | 2a410ac | test(web): wait on the observable pending mark in the write-queue test | fixup into c4198c9 |
| 33 | 1de9275 | fix(e2e): configure the rate limit per run and run removals last | pick |
| 34 | d274ca1 | test(e2e): pin a late bill payment to its anchor date | pick |
| 35 | 2af2414 | feat(service): add notification preference and push subscription API | pick |
| 36 | b1cd32c | feat(service): send due notifications through Web Push | pick, reword body |
| 37 | 38be55b | feat(service): enqueue and send the notification producers | pick |
| 38 | fd6a7bc | feat(web): add per-type push notification settings | pick |
| 39 | cf502ca | feat(web): queue chore completion and errand done offline | pick |
| 40 | 8691032 | fix(service): date every item in the household timezone | pick |
| 41 | afd5e61 | test(e2e): cover offline chores and notification delivery | pick |
| 42 | 91439fb | test(e2e): axe-check every screen state in both themes | pick |
| 43 | 8a7e756 | feat(service): add owner-only bill move and close small spec gaps | pick, reword body |
| 44 | 08936e7 | docs: replace the spec documents with as-built references | pick |
| 45 | c592695 | docs: cut self-referential narration from the new docs | fixup into 08936e7 |
| 46 | bee9a62 | test(shared,matching): enforce 90% coverage thresholds | pick |
| 47 | 801f9fd | test(web): close ten coverage gaps and add a coverage threshold | pick, reword body |
| 48 | ab50be0 | test(service): close coverage gaps, dedupe fixtures, enforce threshold | pick |
| 49 | 1030b35 | fix(shared): reject an empty PATCH /bills/:id instead of defaulting it | pick, reword body |
| 50 | 95b0bd2 | test(service): assert a legitimate PATCH /bills/:id persists end-to-end | fixup into 1030b35 |
| 51 | b96ca32 | chore: update dependencies within range and patch 3 of 4 audit CVEs | pick |

## Reworded messages

11 messages are reworded. Each file in `curation/msgs/` is exactly the text below.

### 3ae2afd build: scaffold pnpm monorepo with tooling, ci, service, and pwa

```text
build: scaffold pnpm monorepo with tooling, ci, service, and pwa

Sets up the Phase 0 skeleton described in Engineering Practices (Versions, Monorepo layout,
Tooling, Git and CI, PWA implementation): a pnpm 10 workspace with strict TypeScript, ESLint
(typescript-eslint strict, jsx-a11y), Prettier, commitlint, and Husky; empty
shared/recurrence/matching packages; a Fastify service with pino logging, Zod-validated env,
trusted-proxy client IPs, 300/min per-IP rate limiting, RFC 9457 errors, and GET /api/health; a
Vite React Tailwind PWA with manifest and prompt-based updates; a Playwright e2e package with
axe; CI on GitHub-hosted runners and a main-only self-hosted deploy gated on CI success
(deploy.sh is a refusing placeholder); weekly grouped Dependabot.

Spec updates: TypeScript pinned to the newest version typescript-eslint supports (6.0), the
manifest theme color named as the Dashboard slate, and Fastify trustProxy read from
HEARTH_TRUSTED_PROXIES.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Change: Body re-wrapped to at most 98 columns; subject, wording and trailer unchanged. `.husky/pre-commit` and `.husky/commit-msg` become 100755 in this commit (D-04).

### 46d170e docs: record flipp spike endpoints and raw 27514 fixtures

```text
docs: record flipp spike endpoints and raw 27514 fixtures

Add 23 unmodified Flipp captures for postal code 27514 under e2e/fixtures/flipp/raw/ and record
the Phase 0 spike in the specs: Technical Architecture Flipp wrapper Endpoints (paths, params,
fields, quirks), CSP img-src hosts, flyer-item fetch-once caching and item-detail pricing through
the rate-limited queue; PRD price-normalization rows for newly observed forms (skip rather than
fabricate); Seed Data fixture index and stable merchant ids; Handoff known unknowns.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Change: Body re-wrapped to at most 98 columns; subject, wording and trailer unchanged.

### 279b398 feat(docker): add compose stack, caddy routing, backups, and deploy

```text
feat(docker): add compose stack, caddy routing, backups, and deploy

Adds the seven-service production Compose stack (db, auth, realtime, kong, hearth-service, caddy,
backup) with pinned images, a fixed bridge subnet, and only Caddy published on 127.0.0.1:8080;
Caddy routing, security headers, signup/user-update refusals, and strict client-IP passthrough;
the NOINHERIT hearth_service role migration with its login set from .env; nightly and pre-deploy
backups with a documented restore; generate-secrets.sh; and the health-gated deploy.sh with
rollback. Technical Architecture (Deployment, Secrets, Backups) and Engineering Practices (Git
and CI) record the resulting layout.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Change: Body re-wrapped to at most 98 columns; subject, wording and trailer unchanged.

### 8d2b6de feat(web): add design system, navigation shell, and dashboard frame

```text
feat(web): add design system, navigation shell, and dashboard frame

Branding tokens as CSS variables for light and dark themes (system preference only) wired into
Tailwind 4 with its default palette, type scale, radii, and shadows removed; section color via
route context and data-section. Radix primitives from the Design Components table, lucide icons,
and react-router with lazy pillar routes. Shell per Design Layout shell: top bar with household
switcher and Settings, five-tab bar that becomes a left sidebar above 1024px, sub-tabs, offline
banner, and a prompt-style service-worker update strip. Coming-soon state for all four unshipped
pillars and a This Week dashboard whose four cards each handle placeholder, loading, empty,
error, and populated states independently (Handoff: shell and dashboard frame complete in v1.0).

Spec edits: Design staged-release coming-soon copy and placeholder behaviour; Branding section
ramps (Tailwind v3 palettes) and tab icons; Engineering Practices routing library and the
error-boundary class exception.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Change: Body re-wrapped to at most 98 columns; subject, wording and trailer unchanged.

### c4198c9 feat(web): add shopping list, pantry, and realtime screens with offline queue

```text
feat(web): add shopping list, pantry, and realtime screens with offline queue

Adds screens 7/8/9 (lists, list detail, pantry) with all six states, realtime sync over the
list:<listId> channel, and the offline write queue (TanStack paused mutations, idb-keyval
persistence, per-list scope ordering, idempotent replay). Reviewer verified two subtle offline
bugs by revert-testing: onlineManager defaulting online on reload (would have silently dropped a
genuinely-offline write, violating non-negotiable 9) and a durability gap where a queued write
could sit unflushed past a real browser restart. Also fixes an axe heading-order violation and
ports the focus-into-replacement a11y pattern to three earlier forms.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

Change: Body re-wrapped to at most 98 columns; subject, wording and trailer unchanged.

### bafa74f feat(recurrence): add anchored occurrence, rotation, and preview logic

```text
feat(recurrence): add anchored occurrence, rotation, and preview logic

Pure, dependency-free functions for bill and chore current-occurrence derivation, completion
placement, rotation turn/rebase math, and a next-N preview helper, computed fresh from the anchor
date and interval on every call (Handoff non-negotiable 5; PRD "Recurrence is anchored and
derived on read", "Rotation"). Month/year clamping recomputes from the original anchor day each
time, never from a previously clamped result. Reviewed adversarially: 31st/30th/Feb-29 clamping
across leap and non-leap years, out-of-order bill resolutions, stacked early chore completions,
missed-occurrence non-backfill, all three rotation-rebase cases plus the 2-member boundary, and
undo-completion composability for both occurrence and rotation state -- all independently
re-verified against the implementation and all passed. 71 package tests, 98.91%/92.72%/100%/100%
coverage. date-fns 4.4.0 and @date-fns/tz 1.5.0 are genuinely current stable and pinned exact per
convention; first use of either in the repo (Phases 2-3 rolled their own Date.UTC arithmetic
instead) -- judged acceptable as-is, not worth retrofitting.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

Change: Body re-wrapped to at most 98 columns; subject, wording and trailer unchanged.

### 0ae57b4 feat(web): add bills dashboard, bill detail, and subscriptions

```text
feat(web): add bills dashboard, bill detail, and subscriptions

Adds the Bills pillar: the dashboard with Overdue, This week, and Later groups and pay/skip
actions (Design 14), bill detail with edit, payment history, archive and delete (Design 15), and
the subscriptions view with monthly and annual figures and the 60-day usage prompt (Design 16).
Money is formatted from integer cents; totals and annualized figures come from the API. Adds the
Bills card to the dashboard and the journey 14 E2E. Design 14-16 gain the bill sheet fields and
visibility rule; PRD visibility-move question is flagged open for the owner.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

Change: Body re-wrapped to at most 98 columns; subject, wording and trailer unchanged.

### b1cd32c feat(service): send due notifications through Web Push

```text
feat(service): send due notifications through Web Push

The dispatch-notifications job (every 2 minutes) sends each due outbox row to every push
subscription of its recipient, as the Dispatch step of the Technical Architecture scheduled jobs.
Each row is claimed by stamping sent_at before any device is sent it, so no device is pushed the
same notification twice; the claim is released only when no device accepted it. Subscriptions the
push service reports gone are deleted; other failures keep the subscription. Rows past their
24-hour retry window are deleted unsent, and copy that fails validation is rejected unsent. The
cross-user reads and writes sit in privileged/notification-outbox.ts behind service_role. The
VAPID subject is derived in env.ts when unset, and the scheduler stop() waits for in-flight runs
so main.ts closes the pool only after them.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

Change: Body re-wrapped to at most 98 columns; subject, wording and trailer unchanged.

### 8a7e756 feat(service): add owner-only bill move and close small spec gaps

```text
feat(service): add owner-only bill move and close small spec gaps

Adds POST /bills/:id/move so a bill owner can move it between household and personal (PRD,
Bills), with its refusals and an untouched anchor and payment history.

Fixes the Flipp request queue to hold the minimum gap on a timer that wakes early, fixing the
intermittent rate-discipline failure.

Enforces the recurrence package coverage gate at 90%. Corrects the Design bill sheet and
Technical Architecture text to match the move endpoint and the dormancy claim behaviour.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

Change: The literal backslash-n sequences in the body become real line breaks and the text is re-flowed into three paragraphs; no word changed.

### 801f9fd test(web): close ten coverage gaps and add a coverage threshold

```text
test(web): close ten coverage gaps and add a coverage threshold

Adds direct tests for apps/web's ten worst-covered files (sw.ts, StaleNotice,
SubSectionComingSoon, supabase-realtime.ts, ArchivedListsScreen, ListNameSheet, JoinRoute,
DepartRoute, SystemHealthRoute, push-port.ts), raising coverage from 82.28/79.13/74.86/83.85 to
84.80/81.31/77.55/86.40. Adds a test:coverage script and an enforced threshold a few points under
the measured value, dedupes shell.test.tsx's local renderApp in favor of the shared harness, and
documents the component-test naming convention.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

Change: Body re-wrapped to at most 98 columns; subject, wording and trailer unchanged.

### 1030b35 fix(shared): reject an empty PATCH /bills/:id instead of defaulting it

```text
fix(shared): reject an empty PATCH /bills/:id instead of defaulting it

billFieldsSchema.partial()'s six defaulted fields (category, recurrenceUnit, interval,
reminderDaysBefore, autopay, isSubscription) fired their .default() even on an absent key, so
updateBillRequestSchema's "change at least one field" refine always saw non-undefined values and
could never reject an empty body. Worse, apps/service/src/services/bills.ts's per-field ===
undefined check saw those injected defaults as real caller input, so ANY partial PATCH /bills/:id
silently reset all six fields on the bill row to their create-time defaults. Confirmed
empirically end to end against pre-fix main: renaming a bill wiped its category back to null.

Builds the update schema from billFieldsSchema.shape with those six defaults unwrapped before
.partial(), so an absent key parses as undefined rather than its default, letting the refine and
the service tell a real omission from an explicit value (e.g. { autopay: false }).

Integration tests show that a PATCH changing only the name, or setting autopay to a non-default
value, leaves every other field on the bill untouched.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

Change: Body re-wrapped to at most 98 columns; one sentence appended summarizing the integration tests folded in from 95b0bd2 (no SHA cited in the message); subject and trailer unchanged.

## Hook modes and line endings

Per D-04, `.husky/pre-commit` and `.husky/commit-msg` become `100755` inside the rewritten `3ae2afd` (the commit that introduces them), with blob content unchanged. Every later commit inherits the mode, so the executable bit is correct at every commit, not only at the tip. The 5 shebang scripts (`scripts/*.sh`, `docker/*-entrypoint.sh`, `apps/service/bin/hearth-admin`) are already `100755` from the commit that adds each. `.gitattributes` keeps `* text=auto eol=lf`. This host has `core.filemode=false`, so modes are set through the index (`git update-index --chmod=+x`) and verified from git objects, not the Windows working tree. Plan 01-03 scans every commit in the rebuilt range for non-executable shebang files and CRLF.

## Policy commit

- Subject: `docs: add contributing guide with branch and pr policy` (type `docs`, no scope, so it passes `scope-enum`).
- Adds root `CONTRIBUTING.md` (D-07, not under `docs/`) and one row in `docs/file-map.md` so the repository-layout table still lists every root file.
- Rule (D-08), text only: changes that only touch docs, comments, formatting, lockfile or dependency version bumps, or mechanical renames go direct to `main`. Anything that changes behavior, tests, CI, migrations, or Docker goes through a pull request from a branch or worktree and is squash-merged; the squash message must satisfy the same commitlint type and scope lists.
- Also states, because `deploy.yml` line 35 only skips a deploy when the tip commit touches nothing outside `docs/`, that root `README.md` and `CONTRIBUTING.md` edits are not "docs-only" for deploy purposes.
- Branch protection, required checks and the squash-only merge setting are not configured by this phase; the file says so (owner follow-up, Phase 6).

## Decisions for Gate 1

a. **Author email.** All 65 local commits (51 product, 14 planning) are `Alex Tanton <actanton@ncsu.edu>` for author and committer. `7da55e3` and the personal GitHub account use `alex.c.tanton@gmail.com`. Whichever address is on the commits becomes public with the first push of any branch, including the staging branch, and cannot be changed afterwards without a force-push.
   - `approve-ncsu`: keep `actanton@ncsu.edu` on all 44 commits. No extra pass.
   - `approve-personal`: publish `alex.c.tanton@gmail.com`. One extra identity-rewrite pass over `curated-main` (trees, messages and dates unchanged), and repo-local `user.email` is set so later commits match. The policy commit is then created under that identity.

b. **Stale spec references in commit bodies.** 25 of the 51 original bodies cite `PRD`, `Handoff` or `Design N` (the spec set that `08936e7` later replaced); 22 of those survive the folds, 5 of which are already in the reword set. They are kept as written unless the owner asks to strip them. Stripping means rewording 17 more commits (each reword runs the typecheck hook, about 20 to 30 seconds), so it is a `revise` request.

c. **Further folds.** 43 product commits against D-01's "~35-40". More folds are possible, but each needs a conflict and tree-identity rehearsal; `1de9275`, `8691032`, `96af7b7`, `258f790` and `8a7e756` are deliberately kept separate because they are real behavior changes, not fixups.

d. **Dangling SHA references.** The only commit body that cites another commit by SHA is `95b0bd2` (cites `1030b35`), and it is folded into `1030b35`, so no published body contains a dead SHA. No other hit.

## What each push does

Items 1 and 2 have happened (Gate 2 and the staging push are under `## Owner approvals`; the PR results are under `## Staging CI results`). Item 3 has not. Each push needs its own gate line under `## Owner approvals`.

1. **Staging push of `curated-main`** (Gate 2, plan 01-04). Triggers no workflow: `ci.yml` runs on `pull_request` and on `push` to `main` only. It does publish the commit SHAs and author identity.
2. **Owner opens a pull request** `curated-main` to `main` at `https://github.com/alex-tanton/hearth/pull/new/curated-main` (`gh` is not installed). CI then runs its 6 jobs (lint, typecheck, test-unit, test-integration, test-e2e, build) on the `pull_request` event. Deploy never fires: `deploy.yml` is limited to `branches: [main]` (line 10) and to a CI run whose `head_branch` is `main` (line 24). Do not merge the PR with the button; a merge or squash commit would break the fast-forward.
3. **`main` push** (Gate 3, plan 01-05), a fast-forward of `7da55e3`, no force. CI runs again on `push`. The Deploy workflow is then created through `workflow_run`. If CI succeeded, the Deploy job waits for a `[self-hosted, hearth]` runner that does not exist, so it sits queued (GitHub documents a 24-hour queue timeout for jobs waiting on a self-hosted runner; the owner may cancel it earlier under Actions, Deploy, the run, Cancel workflow). If CI failed, the Deploy job is skipped. `deploy.yml` is left untouched (D-06; reviewed in Phase 6). GitHub marks the PR merged automatically once its commits reach `main`. Dependabot activates and may open up to three grouped PRs (npm, github-actions, docker), each running CI.
4. **Expected CI result (Gate 2 prediction, superseded by the measured results in `## Staging CI results`).** The repository has never run on GitHub. RESEARCH Pitfall 7 ran `pnpm test` once at `b96ca32` on Node 26 with the machine under load: service, shared, matching and recurrence passed, and the web suite had 2 failing test files and 3 failing tests (`src/App.test.tsx` x2, `src/lib/offline/write-queue.test.tsx` x1). The cause, date dependence versus CPU contention, was not isolated, so a red `test-unit` is plausible but is not established as the Phase 2 TIME-01 failure set. Any such failure would sit in content identical to `b96ca32`, which the tree-identity proof shows the rewrite did not change. The staging PR's actual job results are recorded under `## Staging CI results` (plan 01-04) and replace this prediction before Gate 3.

GitHub-side settings the owner must confirm before the staging push (they are not visible from the repo): the repository `alex-tanton/hearth` exists and its visibility is as intended, Actions is enabled, the default branch is `main`, and no protection rule or ruleset rejects a new branch or the later `main` fast-forward.

## Rollback

- Before any push: delete `curated-main` and remove the `../hearth-curate` worktree. The original history stays in `backup/pre-curation` and `../hearth-aside/pre-curation.bundle`; local `main` has not moved.
- After the staging push: the remote branch can be deleted (`git push origin --delete curated-main`); local `main` and the backup are untouched.
- After the `main` push: there is no rollback without a force-push, which is why Gate 3 exists and why the author email must be settled at Gate 1.

## Proof results

Produced by plan 01-03 on 2026-10-11, all proofs run over the finished range in `../hearth-curate`, reading git objects (not the Windows working tree). Raw logs: `../hearth-aside/logs/` (`typecheck-pass.log`, `typecheck-detail.log`, `mode-eol-scan.txt`, `secret-scan.txt`, `dry-run-final.txt`). Nothing was committed or pushed; `main` and `backup/pre-curation` still point at `38f3a88`.

- Curated tip: 83eae2c841ab8de096d52990f8f3be3f4379c448 (`curated-main`, `docs: add contributing guide with branch and pr policy`; product tip `9dd6668`). 44 commits in `7da55e3..curated-main` (43 curated product commits plus 1 policy commit). This is the only SHA plans 01-04 and 01-05 may push.
- **Tip change after Gate 2 (recorded 2026-10-12): the candidate tip is now `d3da748223fb85432fc06defaa25ac00ac4ed258`, superseding `83eae2c` above.** It is `83eae2c` plus one commit, `ci: retry registry pulls before the e2e job starts the stack` (author and committer `alex.c.tanton@gmail.com`), 45 commits in `7da55e3..d3da748`. `git diff --name-status 83eae2c d3da748` is exactly `M	.github/workflows/ci.yml` (+32 lines, a pre-pull of the compose images with backoff before `pnpm test:e2e`). It was added to answer the `toomanyrequests` e2e failure recorded below, was pushed fast-forward `83eae2c..d3da748` to `origin/curated-main` with the owner's approval, and is the only SHA plan 01-05 may push to `main`. The proofs below were run on `83eae2c`; the new commit changes no source, test, script or hook, so the typecheck, mode and EOL, planning-path and secret-scan results carry over (its diff contains no credential-shaped content). Re-proved on `d3da748` before the main push: `commitlint --from 83eae2c --to d3da748` exit 0; `ci.yml` is `100644`, `i/lf`; `git merge-base --is-ancestor origin/main d3da748` exit 0; the curation worktree is clean.
- Tree identity: `git diff --name-only b96ca32 83eae2c` lists exactly `.husky/commit-msg`, `.husky/pre-commit` (mode change only, 100644 to 100755), `CONTRIBUTING.md` and `docs/file-map.md`.
- commitlint: `commitlint --from 7da55e3 --to 83eae2c841ab8de096d52990f8f3be3f4379c448` over the 44 commits, exit 0.
- Typecheck, per commit: 43 PASS, 1 SKIP (`07db639`, formerly `e86c43c`, docs only, no `package.json`), 0 FAIL, via `git rebase --exec 'sh ../hearth-aside/bin/typecheck-commit.sh' 7da55e3` (frozen install, then `pnpm typecheck`, at each commit; about 10 min). The PASS/SKIP SHAs match `git rev-list --reverse 7da55e3..curated-main` one for one, git ended with `Successfully rebased and updated refs/heads/curated-main`, `curated-main` is still `83eae2c`, and the worktree was clean throughout (no hygiene finding). Node on this host is v26.10.0 against the repo's 24; typecheck only, test parity is Phase 2.
- Mode and EOL scan, all 44 commits: detector control proved first (a planted CRLF `bad.sh` was reported by `git grep -I -P '\r$'`). The 5 shebang files (`apps/service/bin/hearth-admin`, `docker/caddy-entrypoint.sh`, `docker/kong-entrypoint.sh`, `scripts/deploy.sh`, `scripts/generate-secrets.sh`) and both `.husky` hooks are 100755 wherever they exist, and no `*.sh`, hook, bin or entrypoint file has CRLF.

  ```text
  CONTROL crlf-detected bad.sh
  RESULT nonexec=0 crlf=0 husky_nonexec=0 commits=44
  ```

- Planning paths and config: commits touching `.planning` or `.claude` in `7da55e3..83eae2c`: 0 (neither path exists in the tip tree). `.gitignore` and `.github/` are byte-identical to `b96ca32` (`git diff --quiet` exit 0).
- Secret scan of every commit diff and message (private key, AKIA, GitHub token, Slack token, JWT, DSN with password, credential assignment): 133 pattern hits, all classified benign, none of the first four patterns hit at all.

  ```text
  RESULT unexpected=0 envfiles=0 commits=44
  ```

  - (1) Local development default, 13 hits: `postgres:postgres@127.0.0.1:54322` and `hearth_service:hearth@127.0.0.1:54322` in README, `docs/testing.md`, `apps/service/package.json`, the integration-db helper and the seed script.
  - (2) Public sample token, 0 hits.
  - (3) Test-only credential, 78 hits: `*.test.ts(x)`, `e2e/`, `supabase/seed/` and the test support modules `apps/service/src/test/` and `apps/web/src/test/` (imported only by tests; these two directories are outside the plan's literal path list, classified benign on that ground and not on the value). Includes the dummy seed password `hearth-seed-pass-2026`, `violet-teapot-harbor-17`, a dummy unit-test JWT secret, and two dummy JWTs (`{"sub":"1"}` and `{"sub":"1234567890","email":"a@b.co"}`).
  - (4) Variable name or expression without a real value, 42 hits: `${POSTGRES_PASSWORD}` and `${JWT_SECRET}` references in `docker/docker-compose.yml`, `$POSTGRES_PASSWORD` in README, and identifiers or schemas such as `JWT_SECRET: z.string().min(32)` and `password: newPasswordSchema`.
  - Tracked env files in the range: only `.env.example`; `.env` or `.env.*` otherwise 0.
- Published identity: one address for author and committer on all 44 commits, `alex.c.tanton@gmail.com`.
- Dry run (`git push --dry-run origin 83eae2c841ab8de096d52990f8f3be3f4379c448:refs/heads/main`, nothing sent): `7da55e3..83eae2c`, a fast-forward. `origin` still lists only `main` at `7da55e3`.

## Staging CI results

Pull request: https://github.com/alex-tanton/hearth/pull/1 (base `main`, head `curated-main`, tip `d3da748223fb85432fc06defaa25ac00ac4ed258`; opened by the orchestrator through the `gh` CLI with the owner's authorization; not merged). CI run for the current tip: https://github.com/alex-tanton/hearth/actions/runs/38206071791 (event `pull_request`, head SHA `d3da748223fb85432fc06defaa25ac00ac4ed258`, completed 2026-10-12). Earlier run at the superseded tip `83eae2c`: https://github.com/alex-tanton/hearth/actions/runs/38177721565 (recorded 2026-10-11, kept below). Re-checked 2026-10-12 before Gate 3: `origin/main` still `7da55e387f0a766c26c1913004f060608c5152f9`; `origin/curated-main` at `d3da748`.

These measured results replace the Gate 2 prediction in `## What each push does` item 4; Gate 3 decides on them. The six lines below are the current tip's.

- lint: success
- typecheck: success
- test-unit: failure - pre-existing: `pnpm test`, apps/web, 1 failed test file of 56 and 1 failed test of 715 (714 passed), `src/screens/deals/favorites.test.tsx > favorite stores > keeps the stale list with its as-of date rather than emptying`. TestingLibraryElementError: expected text `As of 09/24/2026, 4:00 AM`, rendered `As of 09/24/2026, 8:00 AM`. service (716), shared (148), matching (156) and recurrence (77) passed
- test-integration: success
- test-e2e: success - `pnpm test:e2e`, 102 passed (8.5m) on Linux, after the new pre-pull step ran
- build: success

### Earlier run at the superseded tip 83eae2c (run 38177721565, 2026-10-11)

Same results except `test-e2e`, which failed there: `docker compose ... up --detach --wait db auth realtime kong` exited 1 with `auth Error toomanyrequests: Rate exceeded` from the image registry after 1m13s; infrastructure and transient, no Playwright test ran. The `d3da748` commit (`ci.yml` only) adds the registry pre-pull with backoff; the later run passed all 102 tests, which is the measured evidence that the pre-pull cleared that failure (one run, not a repeat). The `test-unit` failure at `83eae2c` is the same single test with the same expected and rendered text.

### Analysis (the analyst's reading, not a verified root cause)

- **Neither failure is introduced by the rewrite.** (Written against `83eae2c`; `d3da748` adds only the `ci.yml` pre-pull, which does not touch `test-unit`.) The curated tip differs from `b96ca32` only in `.husky/commit-msg` and `.husky/pre-commit` (mode), `CONTRIBUTING.md` and `docs/file-map.md` (`git diff --name-status b96ca32 83eae2c`). `git diff --quiet b96ca32 83eae2c -- {path}` exits 0 for `apps/web/src/screens/deals`, `apps/web/src/screens/deals/favorites.test.tsx`, `docker`, `e2e`, `.github`, `package.json`, `pnpm-lock.yaml` and `apps/web/package.json`.
- **test-unit.** The test feeds `asOf: '2026-09-24T08:00:00.000Z'` (`favorites.test.tsx:116`) and expects `4:00 AM` (line 122), i.e. a UTC-4 local rendering. The runner rendered `8:00 AM`, a 4 hour offset, which fits a UTC runner against an America/New_York-style expectation. No timezone is pinned in `apps/web/vitest.config.ts`, `apps/web/vite.config.ts` or `.github/workflows/ci.yml`. This is the same class as the Phase 2 TIME-01 failures (date and timezone dependence), but it has not been re-run with `TZ` set, so it is a reading and not a proven cause. It is a different test from the 3 failures in RESEARCH Pitfall 7's local scratch run (`src/App.test.tsx` x2, `src/lib/offline/write-queue.test.tsx` x1), so the two runs together do not give a stable Phase 2 baseline. Non-failing noise in the same step: React Router `No route matches URL "/settings"` and `"/"`. Other workspaces (service, shared, matching, recurrence, e2e unit) passed.
- **test-e2e.** (At `83eae2c`.) The failing step was `docker compose up` pulling images, rejected by the registry with `toomanyrequests: Rate exceeded`; it failed after 1m13s with no Playwright test run, so it said nothing about the application. At `d3da748` the job passed 102 of 102.
- **Decision left for Gate 3.** One red job remains at the current tip: `test-unit` (`favorites.test.tsx`, classified pre-existing; content unchanged from `b96ca32`, and Phase 2 TIME-01 owns the date-dependent failure). No `introduced` failure was found, so it does not block Gate 3 under plan 01-04's rule, but because it is not green the approval option is `push-main-accept-red`.

## Owner approvals

- Gate 1 (rewrite proposal): approve-personal - 2026-10-11 - 43 product commits + 1 policy commit
- Gate 1 decisions: (a) published author and committer email `alex.c.tanton@gmail.com`; plan 01-02 Task 2 applies the identity-rewrite pass over `curated-main` (trees, messages and dates unchanged) and sets repo-local `user.email`, and the policy commit is created under that identity. (b) stale spec references kept as written. (c) no further folds. (d) no dangling SHA references to handle. The owner accepted 43 product commits, above D-01's ~35-40, knowingly.
- Gate 2 (staging push of 83eae2c841ab8de096d52990f8f3be3f4379c448): push-staging - 2026-10-11 - owner reply `approve-gate-2` to "approve pushing 83eae2c to origin/curated-main"; scope is that one SHA to `refs/heads/curated-main` only, Gate 3 not approved
- Staging push done: origin/curated-main = 83eae2c841ab8de096d52990f8f3be3f4379c448 - 2026-10-11. `origin/main` still 7da55e387f0a766c26c1913004f060608c5152f9. Pull-request URL printed by GitHub: https://github.com/alex-tanton/hearth/pull/new/curated-main (compare form: https://github.com/alex-tanton/hearth/compare/main...curated-main)
- Tip change after Gate 2 (2026-10-12): candidate tip is now d3da748223fb85432fc06defaa25ac00ac4ed258 (83eae2c plus `ci: retry registry pulls before the e2e job starts the stack`, `.github/workflows/ci.yml` only, +32 lines). Pushed fast-forward `83eae2c..d3da748` to `origin/curated-main` with the owner's approval; PR #1 now carries it. Measured CI for d3da748 (run 38206071791): lint, typecheck, test-integration, test-e2e (102 of 102) and build success; test-unit failure, the single known timezone-dependent web test. See `## Staging CI results`.
- Gate 3 (main push of d3da748223fb85432fc06defaa25ac00ac4ed258): push-main-accept-red - 2026-10-12 - exception to "full suite and CI must remain green" accepted for this push; red jobs: test-unit - owner reply `approve-gate-3` to "fast-forward origin/main from 7da55e3 to d3da748", having been told: no rollback without a force-push; the push runs CI on `push` with test-unit expected red; Deploy may queue for a non-existent self-hosted runner (owner can cancel); local main moves onto the curated tip without disturbing local-only planning files. Scope: one plain push of exactly this SHA to `refs/heads/main`, then moving local `main`; nothing else.

- Main push attempted, REJECTED, nothing changed - 2026-10-12: `git push origin d3da748223fb85432fc06defaa25ac00ac4ed258:refs/heads/main` (plain, no force) was declined by GitHub with GH013 "Repository rule violations found for refs/heads/main". Cited rules: "New changes require approval from someone other than the last pusher", "Code coverage checks require merging via API or UI", "Waiting for Code Scanning results". Cause: an active repository ruleset `Main PR Enforcement` (id 23693495, created 2026-09-19, target `~DEFAULT_BRANCH`, enforcement active, `bypass_actors: []`, `current_user_can_bypass: never`) with rules deletion, non_fast_forward, pull_request (1 approving review, last-push approval, thread resolution), required_status_checks (none listed, strict), copilot_code_review, code_coverage (min 80), code_quality, code_scanning (CodeQL). `origin` after the attempt (`../hearth-aside/logs/ls-remote-after-main.txt`): main `7da55e3`, curated-main `d3da748`. The ruleset was not read as "no ruleset will reject the push" when Gate 3 was approved; Gate 3 stays recorded for this SHA but the push has not happened. Local `main` not moved; plan 01-05 Tasks 2 (done line) and 3 not run.
- Gate 3 re-confirmed (main push of d3da748223fb85432fc06defaa25ac00ac4ed258): push-main-accept-red - 2026-10-12 - owner reply "A done, re-confirm gate 3", given after the first push was rejected with GH013. The owner changed the "Main PR Enforcement" ruleset (id 23693495) themselves (option A) so that a direct fast-forward push can land; scope unchanged: ONE plain non-force push of exactly this SHA to `refs/heads/main`, then moving local `main`; red job accepted for this push: test-unit. Executor note: the ruleset was changed by the owner, not by the executor; if it was only disabled, restoring it will make the red test-unit a required-check blocker for later PRs.
- Main push done: origin/main = d3da748223fb85432fc06defaa25ac00ac4ed258 (fast-forward from 7da55e3, plain push, no force) - 2026-10-12. `git push` printed `7da55e3..d3da748  d3da748... -> main`; `git ls-remote origin` afterwards: main, HEAD, curated-main and refs/pull/1/head all at d3da748223fb85432fc06defaa25ac00ac4ed258.
- Post-push state (2026-10-12): PR #1 MERGED by GitHub (merge commit oid = d3da748, mergedAt 2026-10-12T13:12:02Z). CI on `push` to main, run https://github.com/alex-tanton/hearth/actions/runs/38254024046: lint, typecheck, test-integration, test-e2e and build success; test-unit failure, the same single `favorites.test.tsx` as-of 4:00 AM vs 8:00 AM test, matching the prediction derived from staging. Deploy run https://github.com/alex-tanton/hearth/actions/runs/38255363334: its `deploy` job was skipped (CI conclusion not success), so nothing is queued and nothing was deployed. Nothing was cancelled or re-run.
