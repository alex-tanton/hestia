---
phase: 05-redundancy-reduction-and-text-sync
reviewed: 2026-10-22T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - .github/actions/setup/action.yml
  - .github/workflows/ci.yml
  - .github/workflows/deploy.yml
  - .github/dependabot.yml
  - apps/service/package.json
  - apps/service/src/test/stack-hooks.ts
  - apps/service/src/test/job-logger.ts
  - apps/service/src/jobs/scheduler.test.ts
  - apps/service/src/jobs/dispatch-notifications.test.ts
  - apps/service/src/jobs.integration.test.ts
  - apps/service/src/dispatch-notifications.integration.test.ts
  - apps/service/src/api.integration.test.ts
  - apps/service/vitest.integration.config.ts
  - apps/web/src/test/browser.ts
  - apps/web/src/test/harness.tsx
  - apps/web/src/test/deal-fixtures.ts
  - apps/web/src/screens/deals/deal-search.test.tsx
  - apps/web/src/screens/deals/flyers.test.tsx
  - apps/web/src/screens/deals/favorites.test.tsx
  - apps/web/src/screens/meals/recipe-detail.test.tsx
  - e2e/fixtures/recipes/full-json-ld-dark.html
  - e2e/fixtures/recipes/full-json-ld-light.html
  - e2e/fixtures/recipes/no-json-ld.html
  - .env.example
  - docker/Caddyfile
  - docker/caddy.Dockerfile
  - docker/docker-compose.yml
  - docker/kong.yml
  - scripts/deploy.sh
  - supabase/config.toml
  - supabase/seed/seed.sql
  - e2e/docker-compose.e2e.yml
  - e2e/fixtures/e2e-seed.sql
  - apps/web/src/index.css
  - .planning/cleanup/tools/comment-only-check.mjs
  - .planning/cleanup/tools/nonts-comment-check.mjs
  - .planning/cleanup/tools/docs-claims-check.mjs
  - .planning/cleanup/tools/citation-inventory.mjs
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-10-22
**Depth:** standard
**Reviewed ref:** `origin/main` a5c4384, compared with phase base c64d79e
**Files Reviewed:** 38 (behavior-bearing and tooling files; the ~430 comment-only TypeScript files were checked by tool, not line by line)

## Summary

No defect was found in shipped behavior. The four findings that matter are all in the proof tooling or in one stale comment, and none of them hid an actual change in this phase.

What I confirmed independently:

- `supabase/migrations` is byte-identical to c64d79e (`git diff --quiet` passes). Under `.github` only the four PR A files changed. `deploy.yml` and the e2e job in `ci.yml` changed comments only.
- PR A: all six `ci.yml` jobs call `./.github/actions/setup` right after `actions/checkout`. The composite action has `shell: bash` on its `run` step. `dependabot.yml` uses the valid `directories:` key. Dropping the seed `tsc` from `apps/service` loses nothing, because `@hearth/seed` has its own `typecheck` script and the root `pnpm -r --parallel typecheck` runs it. Workflows, action and compose files all parse with the `yaml` package.
- PR B: no `it`, `test` or `describe` line was removed, and no `expect` was removed other than the duplicated `expectStatus` bodies. Web test counts match the base (728 and 728). Service unit test counts match (757 and 757). `pnpm --filter @hearth/web test` passes, and so does the `test-sweep` for `sun-utc-mon-kiritimati` and `sat-utc-fri-la` on web. `eslint` over the whole repo, `prettier --check` on the 472 changed formattable files, and `tsc --noEmit` for web and service all pass. Integration tests need `supabase start` and were not run; I reviewed their diff statically.
- PR B state leakage: `registerStackHooks()` sits where the old hook trio sat. `stack` and `app` are live bindings that Vitest resets per file (default isolation, and `fileParallelism: false`). `recordingJobLogger(lines)` captures the array at build time, and every call site builds the logger after the `lines = []` reset. `emptyDealSearch` is shared, but `createFetchStub` JSON-serializes it, so nothing mutates it. In the TZ-pinned deal tests `vi.hoisted` still runs before the new imports.
- PR C: the changed lines in `.env.example`, `docker/*`, `deploy.sh`, `config.toml`, both SQL files, `index.css` and `e2e/docker-compose.e2e.yml` are all comments. I confirmed this by diffing the non-comment text. `bash -n scripts/deploy.sh` passes. The two title commits (96fb846, 33baf2d) were re-proved with a stricter comparator of my own (first argument ignored only when it is a string literal): 0 differences in 28 and 8 files. No test name is consumed by a grep, `-t`, snapshot or CI step.
- Running `comment-only-check.mjs --titles` from c64d79e to origin/main flags exactly the 41 PR B files (the shared helpers and their consumers) and nothing else. Every other changed `.ts`, `.tsx`, `.mjs` and `.js` file is comment-only by compiler print.
- PR D: I spot-checked well over 25 claims and all were accurate. They cover 43 package versions in `.claude/CLAUDE.md` against `package.json`, 8 migrations and their first and last names, the five `eslint-disable-next-line` locations and lines, `as unknown as` only in `storage.ts`, 119 `parse(` calls in the routes, container image tags, the backup retention numbers, the cron schedules, `major_version = 17`, the web and service coverage thresholds, the `test` script differences for the three packages, the Kong route names, the ghcr mirror, `d3da748` existing, `useAddDealToList` and `heldDealAddIds`, and the `pg_advisory_xact_lock` in `add-to-list.ts`. No `file:line` reference in the docs is stale. No retired-spec citation remains outside `supabase/migrations/` and `.planning/` (see IN-01).

## Warnings

### WR-01: `comment-only-check --titles` ignores the first argument of every `describe`/`it`/`test`-rooted call, not only titles

**File:** `.planning/cleanup/tools/comment-only-check.mjs:68-86` (`titleRoot`, `isTitleCall`)
**Issue:** In `--titles` mode the first argument of any call whose callee is rooted at `describe`, `it` or `test` is replaced by `'<title>'`. That includes calls whose first argument is code or configuration. I ran the tool's own `normalize` and these all compared SAME:
- `test.beforeEach(async () => { await a(); })` against a changed body
- `test.use({ locale: 'en-US' })` against `{ locale: 'fr-FR' }`
- `test.setTimeout(1000)` against `test.setTimeout(5)`
- `test.skip(isCI, 'x')` against `test.skip(false, 'x')`
- `test.describe.configure({ mode: 'serial' })` against `{ mode: 'parallel' }`
- `it.skipIf(a)('t', f)` against `it.skipIf(b)('t', f)`
- `describe(name, fn)` against `describe(other, fn)`

So a behavior change in a Playwright hook, a `test.use` option or a skip condition would pass the "titles only" proof. The two title commits were the only runs that used `--titles`, and my stricter re-check found no such change in them, so no defect slipped through here.
**Fix:** Only blank the first argument when it is a string literal, a no-substitution template, or a `+` concatenation of those. For example, in the title branch:
```js
const isStringLike = (n) =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ||
  (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken &&
    isStringLike(n.left) && isStringLike(n.right));
// in isTitleCall: return false unless isStringLike(call.arguments[0])
```

### WR-02: `nonts-comment-check` treats a `#` line inside a heredoc or multi-line string as a comment

**File:** `.planning/cleanup/tools/nonts-comment-check.mjs:87-91, 168`
**Issue:** The `#`-file rule drops every line that starts with `#` and then requires that only whole-line comments or blank lines changed. A line like `# keep` inside `cat <<EOF ... EOF` (data, not a comment) satisfies both tests. I reproduced it with a two-commit scratch repo: deleting the `# keep` heredoc line printed `OK a.sh (# comments)`. The same applies to `.toml` multi-line strings and Dockerfile heredocs, and a blank line inside a heredoc is also ignored. `scripts/generate-secrets.sh` already has a heredoc; it was not changed in this phase. The files that were changed (`deploy.sh`, the compose files, `config.toml`, the Dockerfile, `.env.example`) do not have the problem. I checked this by reading their diffs, and every changed line sits outside a heredoc or multi-line string.
**Fix:** For `.sh`, detect heredoc bodies (`<<-?'?WORD'?` through the matching terminator) and fail any changed line inside one. Or compare the shell AST (for example `shfmt --to-json`) instead of lines. For TOML, parse both versions and deep-compare, as is done for YAML.

### WR-03: The directive guard in `comment-only-check` is one-way and incomplete

**File:** `.planning/cleanup/tools/comment-only-check.mjs:21-23, 187-197`
**Issue:** Two gaps.
- Only removed lines are tested against `DIRECTIVE_GUARD`. Adding `// @ts-expect-error`, `// eslint-disable-next-line`, `/* v8 ignore next */` or `// prettier-ignore` passes as comment-only, although those change type checking, lint or the coverage numbers.
- The guard has no entry for comments that carry meaning: `@vitest-environment`, `@vite-ignore`, `@jsxImportSource`, `__PURE__` and `__NO_SIDE_EFFECTS__`. I confirmed that `import(/* @vite-ignore */ p)` against `import(p)` compares SAME.

I grepped the whole phase diff, added and removed lines outside `.planning/` and `docs/`, for these markers and found none, so nothing wrong landed.
**Fix:** Apply the guard to added lines as well, and extend the regex: `/eslint-|@ts-|v8 ignore|c8 ignore|istanbul|prettier-ignore|<reference|@vitest-|@vite-ignore|@jsx|__PURE__|__NO_SIDE_EFFECTS__|^#!|^#\s*syntax=/`.

### WR-04: Stale rollback claim in `vitest.integration.config.ts`, and the reflowed comment is unwrapped

**File:** `apps/service/vitest.integration.config.ts:3`
**Issue:** The phase rewrote this comment but left "Each test rolls back its own transaction." That is only true for the RLS tests that use `withTestDb`. `docs/testing.md:229` says the route-level tests "commit for real — there is no rollback", and `lists.integration.test.ts` says "these rows commit". The edit also joined two lines into one 138-character line, followed by short lines. The same unwrapped-edit pattern appears at `eslint.config.js:98` (107 characters) and `supabase/seed/seed.sql:283` (123 characters). `prettier` does not reflow comments, so CI did not catch it.
**Fix:**
```ts
// Runs against the `supabase start` Postgres, migrated from supabase/migrations/. Route-level tests
// commit their rows and isolate by unique keys; only the RLS tests roll back. Files run one at a
// time: fixtures share natural keys (a postal code's refresh row), and concurrent uncommitted
// inserts of the same key would wait on each other. ...
```
Rewrap the other two comments to 100 columns.

## Info

### IN-01: Retired-spec citations remain in `supabase/migrations`

**File:** `supabase/migrations/20260919070000_schema.sql:1-2,115,235,340,419,423` (17 lines across all 8 migration files)
**Issue:** The migrations still cite "Requirements, …", "Technical Architecture, …" and "Handoff non-negotiable 8". This is the intended trade-off, because the phase constraint is that migrations stay byte-identical, and `citation-inventory.mjs` skips the folder on purpose. Anyone reading "no retired-spec citation remains" should read it as "outside migrations".
**Fix:** None needed. Say it in the phase summary, or sweep these in a dedicated change if the owner wants a clean grep.

### IN-02: The PR B helper consolidation is not finished

**File:** `apps/web/src/screens/deals/flyers.test.tsx:50-55`, `apps/web/src/screens/deals/deal-search.test.tsx:64-66`, `apps/web/src/screens/chores/chores.test.tsx:128`, `apps/web/src/screens/chores/errands.test.tsx:66`
**Issue:** `flyers.test.tsx` still inlines the coarse-pointer `matchMedia` stub that `stubCoarsePointer()` now provides. `deal-search.test.tsx` keeps a local `setOnline` that does only half of what `browser.ts#setOnline` does. `chores.test.tsx` and `errands.test.tsx` keep a local `openMenu(user, trigger: HTMLElement)` whose name collides with the shared `openMenu(user, triggerName: string)`, which invites a wrong import. These are behavior-preserving leftovers, not bugs.
**Fix:** Use `stubCoarsePointer()` in `flyers.test.tsx`. Rename the two local helpers (for example `openMenuFrom`) or fold them into `browser.ts`.

### IN-03: `.claude/CLAUDE.md` still has hollow sections

**File:** `.claude/CLAUDE.md:292-296, 390-405, 515`
**Issue:** `System Overview` holds an empty `text` fence. Six `Data Flow` subsections (Primary Request Path, Error Path, Offline Write Path, Realtime Sync Path, Scheduled Job Path, Notification Pipeline) are headings with no body, and `Cross-Cutting Concerns` is empty. Two `## Error Handling` headings also appear. This matches c64d79e, so the phase did not introduce it, but the phase regenerated and "restored" the file and kept the empty headings. An agent that reads them gets structure with no content.
**Fix:** Fill the sections from the code, or drop the empty headings from the managed blocks.

### IN-04: Generated jscpd reports are committed

**File:** `.planning/cleanup/jscpd/*/jscpd-report.json` (14 tracked files, about 1.6 MB, roughly 35k added lines)
**Issue:** The project's stated goal is a base with no stray generated files. These are raw tool output, and the comparison summaries in the ledgers carry the conclusions.
**Fix:** Keep one before/after pair, or gitignore the folder like `.planning/cleanup/logs/`.

### IN-05: `registerStackHooks`'s `afterAll` hides the root cause when the stack fails to start

**File:** `apps/service/src/test/stack-hooks.ts:27-29`
**Issue:** If `startStack()` throws in `beforeAll`, `stack` is still `undefined`, and `afterAll` then throws `TypeError: Cannot read properties of undefined (reading 'close')`, which sits next to the real error. The behavior is unchanged from the hand-written hooks it replaced, but it is now in one place.
**Fix:** `await stack?.close();` (declare `let stack: Stack | undefined` internally or guard with a flag).

### IN-06: `docs-claims-check` only checks paths and script names

**File:** `.planning/cleanup/tools/docs-claims-check.mjs:107-108, 120-135`
**Issue:** The check cannot catch a wrong count, version, behavior statement or stale `file:NN` reference. It strips the `:NN` suffix before matching, and a unique path-suffix match accepts a wrong directory prefix. My manual spot-check found no such error, but the tool's pass is weaker evidence than the phase summary implies. Run over `CONTRIBUTING.md` it also reports `i/lf` (git `--eol` notation), which is not in the allowlist. `CONTRIBUTING.md` was not changed in this phase.
**Fix:** State the tool's scope in the ledger. Optionally verify `file:NN` references by checking that the line exists.

---

_Reviewed: 2026-10-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
