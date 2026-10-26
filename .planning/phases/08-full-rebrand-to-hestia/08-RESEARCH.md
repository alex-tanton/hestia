# Phase 8: Full Rebrand to Hestia - Research

**Researched:** 2026-10-25
**Domain:** Monorepo-wide mechanical rename (packages, env, infra, DB role, CLI, UI copy, docs) under strict CI gates and a deploy-on-merge pipeline
**Confidence:** HIGH for the inventory, gate design and verification plan (read from the repo this session); MEDIUM for host and GitHub operational steps (tagged `[ASSUMED]`, owner-side)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Environment variables**
- **D-01:** Hard cutover from `HEARTH_*` to `HESTIA_*`. No fallback reads of `HEARTH_*` in `apps/service/src/env.ts`, `scripts/deploy*.sh`, Compose, CI, `generate-secrets.sh` or `.env.example`. A service started with only old names fails Zod validation at startup. — **Reversibility:** costly — every env file on every host must use the new names; undoing touches env.ts, Compose, scripts, workflows and docs.
- **D-02:** This overrides the "fallback compatibility where needed" wording in BRAND-05; the planner should update that requirement text to match. Build-time `VITE_*` names are not prefixed `HEARTH_` and stay as they are.

**Infrastructure and data-bearing names**
- **D-03:** Rename everything, including the data-bearing names: Compose project `name: hearth` to `hestia`, volumes, images (`hearth-service`, `hearth-caddy` to `hestia-*`), Compose service `hearth-service`, the host path `/srv/hearth` to `/srv/hestia`, the `HEARTH_SERVICE_DB_PASSWORD` variable and the login-role SQL file `docker/db/hearth-service-login.sql`. — **Reversibility:** one-way — renaming the Compose project re-prefixes volumes, so existing volumes are orphaned.
- **D-04:** There is no production data to preserve; a fresh deploy is acceptable. No volume-migration runbook is needed. `docs/deployment.md` must document the fresh-host setup with the new names, and the owner must create `/srv/hestia/.env` (HESTIA_* names) before the rename merges, because a merge to `main` auto-deploys.
- **D-05:** Database role `hearth_service` becomes `hestia_service` by editing the existing migrations in place (`supabase/migrations/20260919060000_hearth_service_role.sql`, references in `20260919070000_schema.sql`, other migrations that mention it), then regenerating `apps/service/src/db/types.ts` only if it changes. — **Reversibility:** one-way — any database that already ran the old migrations keeps `hearth_service` and will not re-run them; safe here only because no data is kept.
- **D-06:** CONFLICT TO RESOLVE IN PLANNING: `scripts/check-migrations-append-only.mjs` (a blocking CI gate) fails on any edit of an applied migration. Editing migrations in place needs a deliberate, narrow, documented exemption (for example an explicit one-time allow entry or an override tied to this rebrand commit) with a test in `scripts/check-migrations-append-only.test.mjs`, and the gate must go back to strict afterwards. Do not weaken the gate generally, and do not rewrite published git history.

**CLI and browser-persisted state**
- **D-07:** `hestia-admin` replaces `hearth-admin` as a clean break: rename `apps/service/bin/hearth-admin`, the `bin` entry in `apps/service/package.json`, the Dockerfile install path, `ForgotPasswordScreen` copy and every doc reference. No alias or deprecation shim.
- **D-08:** Browser-side keys are renamed with no migration of old data: `PERSIST_KEY` `'hearth-query-cache'` (`apps/web/src/lib/offline/persist.ts`), `NOTIFICATION_CLICK_MESSAGE` `'hearth:notification-click'` (`apps/web/src/lib/push/push-message.ts`), service-worker cache names and any other `hearth`-prefixed localStorage/IndexedDB/cache identifiers the planner finds. Accepted cost: one cold cache, and any offline writes queued on a device at upgrade time are dropped. Note this in the PR description.

**Packages and manifest**
- **D-09:** Workspace scopes `@hearth/*` to `@hestia/*` for shared, recurrence, matching, service, web, e2e and seed (`@hearth/seed` to `@hestia/seed`), including every import, `pnpm --filter` reference, tsconfig/knip/vitest config, Dockerfile and workflow. The lockfile is regenerated with the repo's pnpm, never hand-edited.
- **D-10:** Manifest `name` and `short_name` are `Hestia`; page title is `Hestia` and `${page} · Hestia` (AppShell); push fallback title is `Hestia`. Tailwind/theme tokens and icons are unchanged unless an icon contains the word "Hearth" as text (planner checks `apps/web/scripts/generate-icons.mjs`).

**Sweep scope**
- **D-11:** Rewrite Hearth to Hestia in all live files: source, comments, tests, `docs/*.md` (including the `docs/branding.md` title and name statements), `README.md`, `CONTRIBUTING.md`, workflows, scripts, `.env.example`, `.planning/PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md` where they describe current state.
- **D-12:** Rename the repository: update every in-repo URL, remote reference and name to the Hestia repo name, and give the owner a checklist step to rename the GitHub repository after the merge (GitHub redirects the old URL). The self-hosted runner's checkout path and Dependabot/workflow references are part of that checklist. The branch work continues under the current repo name until then.
- **D-13:** `.planning/milestones/v1.0/**` and git history stay untouched (historical record). Add a "no `hearth` left" guard to the hygiene checks with an explicit allowlist (the v1.0 archive, `pnpm-lock.yaml` entries only if unavoidable, any text that must quote the old name such as a rename note). Enforcement belongs in `scripts/check-repo-hygiene.mjs` or a sibling script with its own test, wired into the existing CI `hygiene` job.

### Claude's Discretion
- Exact regex and ordering of the mechanical rename, as long as each category (packages, env, infra, DB, CLI, UI copy, docs) lands as a reviewable commit.
- How the migration-gate exemption (D-06) is expressed, provided it is narrow, tested and removed or self-expiring.
- Casing of the display name in lowercase contexts (`hestia-service`, `hestia_service`, `/srv/hestia`) follows the existing hearth casing one-to-one.

### Deferred Ideas (OUT OF SCOPE)
- Origin change to `hestia.aberrance.app`, Cloudflare Tunnel, CSP/CORS — Phase 9.
- Magic links and SMTP — Phase 10.
- VAPID subject and edge hardening — Phase 11.
- Migrating queued offline writes across the browser-key rename — rejected for this phase (D-08).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRAND-01 | PWA UI text, titles (`<title>Hestia</title>`, `${page} · Hestia`), shell headers, onboarding copy, install prompts say Hestia | Copy inventory (Architecture Patterns, class 7); title sites `apps/web/index.html:13`, `AppShell.tsx:86`; tests that pin them (`shell.test.tsx:59,93,127`); repo-wide no-`hearth` guard proves no user-facing leftover |
| BRAND-02 | Manifest `name`/`short_name` `Hestia`, updated description | `apps/web/vite.config.ts:52-54`; no existing test pins the manifest, so extend `apps/web/scripts/check-build.mjs` (Validation Architecture, Wave 0) |
| BRAND-03 | CLI `hearth-admin` to `hestia-admin` (clean break per D-07) | `git mv` of `apps/service/bin/hearth-admin` (must stay mode 100755: hygiene gate), `package.json` `bin`, Dockerfile COPY and `ln -s`, `cli.ts` USAGE string, `e2e/support/db.ts` `hearthAdmin()` |
| BRAND-04 | `@hearth/*` to `@hestia/*` | Verified lockfile procedure (6 keys, no resolution change); regex-literal trap `noExternal: [/^@hearth\//]` in `tsup.config.ts:13` |
| BRAND-05 | `HEARTH_*` to `HESTIA_*`, Compose names; fallback wording superseded by D-01/D-02 | Full env-name taxonomy; silent-degradation trap for optional vars (Common Pitfalls 1); Compose network/subnet collision with the old stack (Pitfall 3) |
| BRAND-06 | All suites green under the new brand | Per-suite commands, Wave 0 gaps and sandbox notes (Validation Architecture) |
</phase_requirements>

## Summary

This is a large but almost entirely mechanical rename: 338 tracked text files outside `.planning/milestones/` and the lockfile contain "hearth" (1,013 matching lines outside `.planning/`), all text (no binary or icon contains the word). "hearth" and "hestia" are both six letters, so a case-preserving substitution (`hearth`/`Hearth`/`HEARTH` to `hestia`/`Hestia`/`HESTIA`) never changes line length, so Prettier output and Markdown table alignment are unaffected. The lockfile needs only six `importers` keys changed; I verified in a scratch copy that `pnpm install --lockfile-only` after renaming the `package.json` names produces a byte-identical result to a plain substitution, and `--frozen-lockfile` accepts it, so the lockfile ends with zero "hearth" and needs no allowlist entry.

The real planning risk is not the substitution; it is the five places where a naive rename breaks something silently or collides with a gate: (1) the migration append-only gate, which can be exempted narrowly and self-expiringly by pinning git blob SHAs; (2) optional env vars (`HEARTH_TRUSTED_PROXIES`, `HEARTH_OWNER_EMAIL`, rate limit, push transport) that default silently, so a half-renamed environment starts without error but with no trusted proxy; (3) the Compose network (fixed name and fixed subnet `172.16.238.0/24`) and published port `127.0.0.1:8080`, which collide with the still-running old `hearth` stack on the first deploy; (4) the self-hosted runner label `hearth` in `deploy.yml`, which strands the Deploy job if the runner is not relabelled before merge; (5) a blanket `sed` over `.planning/` and a few prose/path spots that would corrupt text that legitimately names the old name or a local filesystem path.

**Primary recommendation:** Do the rename as token-class commits, each produced by one reproducible `git grep -l | xargs sed` command (order: login-SQL/`hearth_service`/migration-file first, then `@hearth/`, `HEARTH_`, infra names, CLI, browser keys, UI copy, catch-all); make the migration exemption a content-pinned JSON file read by the gate (self-expiring because the pre-rebrand blob SHA stops matching once the change is on `main`); add the no-`hearth` guard as a fourth check inside `scripts/check-repo-hygiene.mjs` (already wired into CI and `test:harness`, and already a knip entry); and ship an owner checklist (runner label, `/srv/hestia/.env`, tear down the old stack, repo rename) as a planning artifact plus the PR body, not as a `docs/` file.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User-facing name (title, shell, onboarding, push fallback) | Browser / Client (`apps/web/src`) | CDN / Static (`index.html`, manifest emitted at build) | Copy lives in `*-copy.ts` and screens; manifest is a build output of `vite-plugin-pwa` |
| Browser-persisted keys (IndexedDB key, SW message type) | Browser / Client | — | Only the page and service worker read them; no server involvement |
| Env-var contract (`HESTIA_*`) | API / Backend (`apps/service/src/env.ts`) | Compose, scripts, CI | Zod schema is the single reader; Compose and scripts only pass names through, so they must match it exactly |
| Outbound User-Agent (`Hearth/1.0 (...)`) | API / Backend (`deals/flipp/request-queue.ts`) | — | Brand string sent to Flipp and recipe sites; behavior change visible to third parties |
| Login role `hestia_service` | Database / Storage (`supabase/migrations`, `docker/db`) | API (`DATABASE_URL`, `service-stack.ts`) | The role is created by migration and given LOGIN by a Compose-mounted SQL file |
| Image, service, project, network names | Infra (Compose, Dockerfiles, `deploy*.sh`) | CI (`ci-prepull-images.sh`, workflow filters) | Docker names drive deploy-gate's running-revision lookup and E2E teardown |
| "No old name left" and "migrations append-only" enforcement | CI gates (`scripts/*.mjs`) | Husky/lint-staged (not involved) | Blocking `hygiene` job steps |

## Standard Stack

No new runtime or build dependency is introduced. The rename uses tools already in the repo and on the host.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| pnpm | 10.34.5 (`packageManager`; present on PATH: `pnpm --version` printed `10.34.5`) | Regenerates the lockfile; workspace filters | D-09 requires pnpm, not hand edits. Verified: `pnpm install --lockfile-only` in a scratch copy reproduced the substituted lockfile exactly |
| GNU sed + `git grep -l` + `git mv` | host | Mechanical rename, one command per token class | Reproducible, reviewable; `git mv` preserves the 100755 mode the hygiene gate checks |
| `node --test` (root harness) | Node 24.21.0 | Tests for the two gate scripts | Existing pattern; both test files already in `test:harness` |
| Vitest | 5.0.1 | Unit/component/integration | Existing; renamed assertions only |
| Playwright | 1.63.0 | E2E | Existing; 104 expected passed (CLAUDE.md) |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `docker compose config` | Compose v5.6.1 (sandbox) | Validate the merged base + E2E overlay after the network/service rename | After the infra commit |
| `sh -n` / `bash -n` | host | Syntax-check `apps/service/bin/hestia-admin`, `deploy*.sh`, `caddy-entrypoint.sh` | After the CLI and infra commits |

### Alternatives Considered
None researched: D-01..D-13 lock the approach.

**Installation:** none. After the package rename run `pnpm install` once (relinks `node_modules/@hestia/*`; `apps/web/node_modules/@hearth/{recurrence,shared}` links exist today and become stale).

**Version verification:** `[VERIFIED: pnpm --version, node --version, docker --version, supabase --version run this session]`

## Package Legitimacy Audit

No external packages are added, removed or upgraded by this phase. `@hestia/*` are workspace packages (`workspace:*`), never fetched from a registry. Audit not applicable.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                       owner (before merge)                        CI on PR (blocking)
  /srv/hestia/.env  runner label +hestia  repo-rename plan        lint typecheck test-unit test-integration
        |                   |                                      test-e2e build hygiene
        v                   v                                              ^
  [token-class sed commits] --> branch --> PR --> required CI ------------+
   1 DB role+migration file                          |
   2 @hearth/ -> @hestia/ (+ pnpm lockfile regen)    |  hygiene job
   3 HEARTH_ -> HESTIA_                              |   - pnpm knip / baseline / jscpd / audit
   4 infra names (compose, images, paths, e2e)       |   - check-repo-hygiene  (+ NEW legacy-name guard)
   5 CLI   6 browser keys   7 UI copy   8 catch-all  |   - check-migrations-append-only (+ NEW pinned exemption)
   9 docs/README/CONTRIBUTING/CLAUDE.md/.planning    v
   10 gate commits: exemption JSON, guard             merge (squash) to main
                                                       |
                                    CI push run -> deploy.yml (runs-on [self-hosted, hestia])
                                       |  scripts/deploy-gate.sh : image hestia-service:current missing -> deploy=true
                                       v
                                    scripts/deploy.sh  (env_file default /srv/hestia/.env)
                                       build hestia-service/hestia-caddy -> compose up (project hestia, fresh volumes)
                                       -> supabase migration up -> apply docker/db/hestia-service-login.sql
                                       -> health check via Caddy :8080
                                       (old project `hearth` must be down: same subnet and port)
```

### Recommended Project Structure
Unchanged, except three renamed paths (`git mv`):
```
apps/service/bin/hestia-admin                                   # was hearth-admin  (mode 100755)
docker/db/hestia-service-login.sql                              # was hearth-service-login.sql
supabase/migrations/20260919060000_hestia_service_role.sql      # was ..._hearth_service_role.sql (same version prefix)
scripts/migration-exemptions.json                               # NEW, deleted in a later cleanup
```

### Pattern 1: Token-class rename commits (Claude's-discretion area)

**What:** One `git grep -I -l ... | xargs sed -i` per class, specific tokens before generic. Same-length names make this safe for formatting. Excluded from every pass: `.planning/` (hand-edited, see Pitfall 7), `pnpm-lock.yaml` (regenerated), `.git`.

```bash
# Source: derived from this session's token taxonomy (git grep -o over all tracked live files)
FILES() { git grep -I -l -i hearth -- . ':!.planning' ':!pnpm-lock.yaml'; }

# 0. renames first (git mv keeps modes)
git mv apps/service/bin/hearth-admin apps/service/bin/hestia-admin
git mv docker/db/hearth-service-login.sql docker/db/hestia-service-login.sql
git mv supabase/migrations/20260919060000_hearth_service_role.sql \
       supabase/migrations/20260919060000_hestia_service_role.sql

# 1. DB role (commit "db"): login SQL name must change BEFORE the generic hearth-service rule
FILES | xargs sed -i -E 's/hearth-service-login/hestia-service-login/g; s/hearth_service/hestia_service/g;
                          s/hearth-service-role/hestia-service-role/g; s/hearth\.seed_invite_token/hestia.seed_invite_token/g'
# 2. packages (commit "build"): handles both @hearth/ and the regex-literal @hearth\/
FILES | xargs sed -i -E 's#@hearth(\\?/)#@hestia\1#g'
sed -i 's/"name": "hearth"/"name": "hestia"/' package.json && pnpm install --lockfile-only
# 3. env (commit): HEARTH_ -> HESTIA_  (covers HEARTH_TEST_NOW, HEARTH_E2E_*, HEARTH_SEED_*, HEARTH_DEPLOY_*)
FILES | xargs sed -i 's/HEARTH_/HESTIA_/g'
# 4. infra names, 5. CLI, 6. browser keys, 7. UI copy, 8. catch-all: same pattern, narrower tokens first
FILES | xargs sed -i -E 's/hearth-(service|caddy|compose|restore|pnpm-store|e2e|built)/hestia-\1/g'
FILES | xargs sed -i -E 's/hearth-admin/hestia-admin/g; s/hearthAdmin/hestiaAdmin/g'
FILES | xargs sed -i "s/hearth-query-cache/hestia-query-cache/g; s/hearth:notification-click/hestia:notification-click/g"
# catch-all LAST, after reading the residual list
FILES | xargs sed -i 's/hearth/hestia/g; s/Hearth/Hestia/g; s/HEARTH/HESTIA/g'
git grep -n -i hearth -- . ':!.planning'   # must print nothing before the guard is added
```

**When to use:** always for this phase. Each command is re-runnable, which makes review and re-basing cheap. Commit subjects must satisfy commitlint: type from `feat|fix|docs|refactor|test|chore|perf|build|ci`, scope only from `web, service, shared, recurrence, matching, db, e2e, docker` or no scope, subject at most 71 characters, no trailing full stop `[VERIFIED: commitlint.config.js]`. A scope like `rebrand` is rejected by the commit-msg hook.

### Pattern 2: Content-pinned, self-expiring migration exemption (D-06)

**What:** The gate stays strict. A checked-in JSON lists the only edits allowed, each pinned to the exact pre-rebrand blob and exact post-rebrand blob. An entry applies only if the file at the merge base equals `fromBlob` and the file at HEAD equals `toBlob`. Once the PR is on `main`, the next comparison's merge base already holds `toBlob`, so the entry matches nothing and the gate is strict again with no further edit. Any other edit to those files, before or after, fails. A later cleanup deletes the file.

Pre-rebrand blob SHAs (read from `git rev-parse HEAD:<path>` this session; only two applied migrations mention the name):

| Path | Pre-rebrand blob |
|------|------------------|
| `supabase/migrations/20260919060000_hearth_service_role.sql` | `d331585a3c92a71a42bc16c7755f5ae187be4ef0` |
| `supabase/migrations/20260919070000_schema.sql` | `8f5c5cdc1249203c9410c5f86f148b77c044452b` (comment on line 1 only: "The complete Hearth schema") |

```jsonc
// scripts/migration-exemptions.json  (fill toBlob from `git rev-parse HEAD:<toPath>` AFTER the final content is committed)
[
  { "fromPath": "supabase/migrations/20260919060000_hearth_service_role.sql",
    "toPath":   "supabase/migrations/20260919060000_hestia_service_role.sql",
    "fromBlob": "d331585a3c92a71a42bc16c7755f5ae187be4ef0", "toBlob": "<sha>",
    "reason": "v2.0 rebrand: login role hearth_service -> hestia_service; no database is kept" },
  { "fromPath": "supabase/migrations/20260919070000_schema.sql",
    "toPath":   "supabase/migrations/20260919070000_schema.sql",
    "fromBlob": "8f5c5cdc1249203c9410c5f86f148b77c044452b", "toBlob": "<sha>",
    "reason": "v2.0 rebrand: comment only" }
]
```

Gate changes (`scripts/check-migrations-append-only.mjs`): keep `git diff --name-status --no-renames -z base...HEAD` (a rename is `D` + `A`, `[VERIFIED: script lines 103-111]`); add `--exemptions FILE` (default `scripts/migration-exemptions.json`, missing file means empty list, so deleting the file is the removal step); compute `mb = git merge-base base HEAD`; for each entry require `rev-parse mb:fromPath == fromBlob` and `rev-parse HEAD:toPath == toBlob` and the matching `D`/`A` (or `M` when paths are equal) in the change list; remove exactly those changes from `problems`; print `exempt: <path> (<reason>)`. Keep the existing summary line byte-identical when nothing is exempt (existing tests regex it: `^migrations: 1 added, nothing else changed$`); add `, N exempt` only when N > 0. Exit codes unchanged (0, 1, 2). A malformed exemptions file is exit 2, never a pass.

Tests to add to `scripts/check-migrations-append-only.test.mjs` (the file builds a temp repo per case with `repoWith(change)`; pass a temp exemptions file with `--exemptions`): edit exempted when both blobs match (exit 0); edit with wrong `toBlob` (fails, exit 1); edit when base blob is not `fromBlob`, i.e. the self-expiry case (fails); exempted edit plus an unrelated edited migration (fails, names only the unrelated one); exempted rename (`D`+`A`) passes, a rename to a different target fails; default file absent means strict; malformed JSON is exit 2.

### Pattern 3: Legacy-name guard inside `check-repo-hygiene.mjs` (D-13)

**What:** Add a fourth check. It reads the git index like the other three (`git grep --cached -I -l -i -F -z hearth`; exit status 1 means "no match", not a failure) plus `git ls-files` path names (three tracked paths contain the name today), skips any path under the allowlist, and reports `legacy name in <path>`. No new CI step and no new `test:harness` entry are needed: `node scripts/check-repo-hygiene.mjs` is already a `hygiene` job step, and `scripts/check-repo-hygiene.test.mjs` is already in `test:harness` `[VERIFIED: ci.yml hygiene step; package.json test:harness]`. A sibling script would also need adding to `knip.json` `entry` (existing scripts are listed there individually).

Recommended allowlist (explicit constant, each entry commented):

| Entry | Why it may quote the old name |
|-------|-------------------------------|
| `.planning/` | Planning state, requirements and phase documents describe the rename itself; D-13 already permits "text that must quote the old name". Includes `milestones/v1.0/**` |
| `scripts/check-repo-hygiene.mjs` and `scripts/check-repo-hygiene.test.mjs` | They hold the pattern |
| `scripts/migration-exemptions.json` | `fromPath` values are the old file name. Remove with the exemption |

Everything else must be clean, including `docs/`, `README.md`, `CONTRIBUTING.md`, `.claude/CLAUDE.md`, `.github/`, `pnpm-lock.yaml`. Keep the owner's old-stack teardown steps out of `docs/` (they must name the old Compose project) so `docs/` needs no allowlist entry. Tests (temp repos, as the existing cases do): a hit in a source file fails and names it; `Hearth` and `HEARTH` hit (case-insensitive); a hit only in an allowlisted path passes; a tracked path whose name contains the word fails; a binary file is skipped; the index is judged, not the working tree; a non-git directory is exit 2.

### Anti-Patterns to Avoid
- **Blanket `sed` over `.planning/`:** it would turn `.planning/REQUIREMENTS.md` BRAND-03 into "from `hestia-admin` to `hestia-admin`" and `PROJECT.md` line 97 "Goddess of the Hearth" into "Goddess of the Hestia". Hand-edit those files.
- **Editing the gate to skip `supabase/migrations/` or to allow `M` generally:** violates D-06.
- **Hand-editing `pnpm-lock.yaml`:** unnecessary and forbidden by D-09; run `pnpm install --lockfile-only`.
- **Renaming a local filesystem path that is not part of the repo:** `.planning/STATE.md:26` links `file:///c:/Users/actanton/Development/Aberrance/hearth/...`, a path on the owner's machine. Leave it unless the owner renames the local folder.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lockfile update | Manual YAML edits or a custom script | `pnpm install --lockfile-only` (repo pnpm) | Verified identical to the substitution, and CI uses `--frozen-lockfile` |
| Rename of tracked files | `mv` + `git add` | `git mv` | Keeps mode 100755 on `hestia-admin`; the hygiene gate fails a script at 100644 |
| Index scanning for the guard | A filesystem walk | `git grep --cached` / `git ls-files` (the gate's own approach) | Judges what a commit contains, ignores `node_modules`, `dist`, CRLF rewrites |
| Env-name consistency check | A second parser of Compose | The legacy-name guard plus `env.test.ts` and `docker compose config` | A leftover old name anywhere is caught by one rule |
| Post-build manifest assertion | A new test harness | Extend `apps/web/scripts/check-build.mjs` (already runs after `vite build` in `pnpm build`) | CI `build` job already runs it |

**Key insight:** every artifact here already has an enforcing gate or test; the work is keeping names consistent between writer and reader, so prefer rules that fail on any leftover old token over bespoke per-name checks.

## Runtime State Inventory

After every tracked file is updated, these still carry or hold the old name:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | (a) Production Compose volumes `hearth_db-data` and `hearth_db-config` (the compose file declares `db-data:` and `db-config:` under project `name: hearth`, so Docker prefixes them) `[VERIFIED: docker-compose.yml:291,298-299; docs/deployment.md:303,321]`; (b) any Postgres that already ran the old migrations keeps role `hearth_service` and its `supabase_migrations` history entry (applied-version tracking assumed by version, `[ASSUMED]`); (c) developers' local `supabase start` stacks (`supabase/config.toml:5` `project_id = "hearth"`, renamed to `hestia` by the sweep); (d) each installed browser's IndexedDB key `hearth-query-cache` and any queued offline writes; (e) `hearth.seed_invite_token` is a session-scoped `set_config(..., false)` GUC used by `supabase/seed/seed.sql:10,185`, nothing stored | (a) none by D-04: fresh volumes, owner may `docker volume rm` the old ones later; (b) none for fresh DBs, **developers must reset local DBs** (`supabase stop --no-backup` then `supabase start`, or `supabase db reset`) because the in-place edited role migration will not re-run; add this to `docs/development.md` without quoting the old name; (c) same as (b); (d) data loss accepted by D-08, mention in PR body; the orphaned old key stays in IndexedDB harmlessly; do **not** add cleanup code that names the old key (guard, D-08) |
| Live service config | GitHub: repository name `alex-tanton/hearth` (remote `origin` is `https://github.com/alex-tanton/hearth`); self-hosted runner label `hearth` (`deploy.yml:29` `runs-on: [self-hosted, hearth]`, also `CONTRIBUTING.md:35`, `docs/deployment.md:62`); runner registration URL, service unit and `_work/` directory carry the repo name `[ASSUMED]`; fine-grained PAT scoped to the repo for cloud sessions (`.planning/environment/CLOUD-ENVIRONMENT.md`) `[ASSUMED: survives a rename]`; branch protection required-check names are job ids (`lint`, `typecheck`, ...), unchanged. Tailscale Funnel target `127.0.0.1:8080` and the origin are unchanged this phase | Owner checklist (below). Code edit: `deploy.yml` label, `CONTRIBUTING.md`, `docs/deployment.md`, `.planning/environment/*` repo slug |
| OS-registered state | Host Docker objects of project `hearth`: containers, network `hearth` with fixed subnet `172.16.238.0/24`, published port `127.0.0.1:8080` (`docker-compose.yml:246,290-295`), images `hearth-service:*` and `hearth-caddy:*`, BuildKit cache id `hearth-pnpm-store` (5 Dockerfile uses); host dirs `/srv/hearth`, and `BACKUP_DIR` (example `/mnt/backup/hearth`, owner-chosen); runner systemd unit named after the repo `[ASSUMED]`. In this sandbox a container named `hearth-registry` is running (`docker ps`); it is not repo state and is not referenced by any tracked file | Owner: stop the old stack before the first renamed deploy (Pitfall 3), later remove old images and volumes, reconfigure the runner after the repo rename. No code can do this |
| Secrets/env vars | Host `/srv/hearth/.env` holds every key by old name `[VERIFIED: docs/deployment.md, .env.example]`; the env file path is read through `HEARTH_ENV_FILE` in `deploy.sh` and `generate-secrets.sh`. GitHub Actions: no repository secret or variable names contain the word (grep over `.github/`: only `HEARTH_DEPLOY_*` step env and one comment). Developer shells may export `HEARTH_*` for local runs | Owner creates `/srv/hestia/.env` with `HESTIA_*` names before merge. A keys-only conversion of the old file keeps the generated secrets (`sed 's/^HEARTH_/HESTIA_/'`), which is optional because the database is fresh. Code edit: env.ts, Compose, scripts, workflows, `.env.example`, docs |
| Build artifacts / installed packages | `node_modules/@hearth/*` workspace links (e.g. `apps/web/node_modules/@hearth/{recurrence,shared}`), `apps/*/dist` including `apps/service/dist/cli.js`, `apps/web/dist`, `*.tsbuildinfo`, coverage output, local images `hearth-service:*`, E2E state dir `$TMPDIR/hearth-e2e` and any leftover `hearth-e2e-*` Compose projects and networks | Run `pnpm install` after the package commit (relinks), `pnpm build` to refresh `dist`; E2E leftovers are removed by `pnpm test:e2e` teardown or `docker compose -p <name> down --volumes --remove-orphans`; nothing tracked |

**The canonical question answered:** after the repo is clean the host still has the old Compose project (blocks the new one), old images and volumes, an env file under the old path, a runner labelled and registered under the old name, and every browser holds an orphaned cache key. All are owner actions or accepted losses (D-04, D-08).

### Owner checklist (planning artifact `08-OWNER-CHECKLIST.md` plus PR body; not in `docs/`)

Before merge:
1. Create `/srv/hestia/.env` with `HESTIA_*` names (run `scripts/generate-secrets.sh` from the branch, or convert the old file's keys) and `BACKUP_DIR`.
2. Add the label `hestia` to the self-hosted runner (labels are additive, keep `hearth` until after merge).
Merge (squash; CI runs, then Deploy):
3. The first renamed deploy will fail safely at "Supabase services are not healthy; nothing restarted" if the old stack is still up (Pitfall 3). Stop it (`docker compose -p hearth down`, no `-v`), then re-run the Deploy run (attempt 2).
4. Confirm `GET /api/health`, sign up the owner again (fresh database), re-enable notifications on each device.
After:
5. Rename the GitHub repository; update the local `origin` remote, the runner registration URL and checkout path, and Dependabot-related settings; remove the `hearth` runner label.
6. Remove old images (`hearth-service:*`, `hearth-caddy:*`), old volumes after confidence, `/srv/hearth`.

## Common Pitfalls

### Pitfall 1: Half-renamed environment starts without error but unsafe
**What goes wrong:** `apps/service/src/env.ts` requires only `HEARTH_ORIGIN` among the prefixed names. The others default: `HEARTH_TRUSTED_PROXIES: trustedProxies` where `trustedProxies` is `.default('')` ("Empty means no proxy is trusted, so X-Forwarded-For is ignored."), `HEARTH_OWNER_EMAIL: z.string().trim().default('')` ("Unset means nobody is the server owner, so System health is closed to everyone."), `HEARTH_RATE_LIMIT_PER_MINUTE ... .default(DEFAULT_RATE_LIMIT_PER_MINUTE)`, `HEARTH_PUSH_TRANSPORT: z.enum(['web-push', 'test-double']).default('web-push')` `[VERIFIED: env.ts:31-43,90]`.
**Why it happens:** Compose, the E2E overlay and `env.ts` must all change together. If Compose passes `HEARTH_TRUSTED_PROXIES` while `env.ts` reads `HESTIA_TRUSTED_PROXIES`, the service boots, trusts no proxy, and every client appears as the Caddy address: one shared per-IP rate-limit bucket.
**How to avoid:** Apply the `HEARTH_` to `HESTIA_` substitution as one atomic class commit across all files; rely on the legacy-name guard to prove no old name remains; add an `env.test.ts` case that parsing an environment with only the old names throws (D-01, covers `HEARTH_ORIGIN`) and one that `HESTIA_TRUSTED_PROXIES` is honoured.
**Warning signs:** Rate-limit 429s for one household member affecting others; System health closed to the owner; E2E push specs finding no deliveries.

### Pitfall 2: Regex and escaped forms missed by a plain-string substitution
**What goes wrong:** `apps/service/tsup.config.ts:13` is `noExternal: [/^@hearth\//]`; `scripts/test-sweep.test.mjs:206` asserts `/@hearth\/shared/`; `e2e/support/run-identity.test.ts` asserts `/HEARTH_E2E_RUN_ID/`. A `s/@hearth\//` pattern misses the backslash form. If `noExternal` is left on the old scope, tsup externalizes the workspace packages and the container fails at runtime (`--prod` install in `docker/service.Dockerfile:24` has no source for them); only the Docker build/E2E shows it.
**How to avoid:** Use `s#@hearth(\\?/)#@hestia\1#g` (Pattern 1) and finish with `git grep -n -i hearth` returning nothing.

### Pitfall 3: The new Compose project collides with the running old one
**What goes wrong:** The base file fixes the network `name: hearth` with `subnet: *subnet` and `gateway: *gateway` (`172.16.238.0/24`, `172.16.238.1`), and Caddy publishes `127.0.0.1:8080:8080` `[VERIFIED: docker-compose.yml:244-251,289-295]`. A project named `hestia` creates a second network on the same subnet and wants the same host port while the old stack runs. `deploy.sh` brings up `db auth realtime kong backup` first (`compose up --detach --wait ...`) and aborts with "nothing restarted" on failure (a safe failure; the old stack keeps serving).
**How to avoid:** Owner checklist step 3; encode it in `docs/deployment.md` only as new-host instructions (no old names). Note `deploy.sh` has no rollback target on a first deploy ("previous: none (first deploy; there is nothing to roll back to)"), so downtime lasts from old-stack stop to first healthy deploy.
**Warning signs:** `Pool overlaps with other one on this address space` or `port is already allocated` in the Deploy log `[ASSUMED: wording]`.

### Pitfall 4: Compose base and E2E overlay network key must rename together
**What goes wrong:** The overlay redefines the base file's network key (`e2e/docker-compose.e2e.yml:75-79`, comment "The base file's network is named `hearth` with its own ipam" and key `hearth:` with `name: ${HEARTH_E2E_NETWORK:?}`). If only one side is renamed, Compose merges two networks; services stay on the fixed-subnet one and parallel E2E runs conflict.
**How to avoid:** Same commit; verify with `docker compose --env-file <tmp env> -f docker/docker-compose.yml -f e2e/docker-compose.e2e.yml config` showing one network.

### Pitfall 5: Runner label strands the Deploy job
**What goes wrong:** `deploy.yml:29` is `runs-on: [self-hosted, hearth]`. After the rename it needs a runner with label `hestia`; with none, the job queues forever ("Until such a runner is registered, a Deploy run waits in the queue and deploys nothing." `CONTRIBUTING.md:35`).
**How to avoid:** Owner adds the `hestia` label before merge (checklist step 2). Open Question 1 records the decision.

### Pitfall 6: Applied-migration edit does not take effect on existing databases
**What goes wrong:** The role migration is idempotent (`if not exists (... rolname = 'hearth_service') then create role hearth_service nologin noinherit`, `[VERIFIED: migration lines 14-15]`). Edited in place it creates `hestia_service` only where the migration has not been applied. Any existing local or CI-cached database keeps the old role and the service cannot log in as the new one. CI is safe (fresh `supabase start`); developers are not.
**How to avoid:** Development doc note (reset local database). Keep `apps/service/src/test/service-stack.ts:80` (`alter role ... with login password`) consistent; it fails loudly if the role is absent.

### Pitfall 7: Prose and decision text that must keep the old name
**What goes wrong:** `PROJECT.md:97` records "Goddess of the Hearth fits household management" (the English word, a decision rationale), REQUIREMENTS rows describe the rename, v1.0 and Phase 7 documents quote old names. A global substitution corrupts them.
**How to avoid:** `.planning/` is excluded from every substitution pass and from the guard; edit `PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md` by hand (D-11: describe current state; update BRAND-03/04/05 text per D-02/D-07/D-09; BRAND-04 should add `@hestia/seed`; BRAND-05 drops "providing fallback compatibility where needed").

### Pitfall 8: Coupled non-repo-root scripts that grep the root package name
**What goes wrong:** `.planning/environment/cloud-setup.sh:122` runs `grep -q '"name": *"hearth"' "$root/package.json"` to decide whether to run `pnpm install`. After the root `package.json` name becomes `hestia` it silently skips the install. `cloud-check.sh` probes `gh api repos/alex-tanton/hearth` and a probe directory `.hearth-write-check.XXXXXX`.
**How to avoid:** Update these in the same change as the root `package.json` rename; the repo slug there depends on the repository rename (Assumption A1).

### Pitfall 9: Mixed old/new service worker or page during upgrade
**What goes wrong:** `NOTIFICATION_CLICK_MESSAGE` is posted by the service worker and parsed by the page (`push-message.ts:68-71`: `if (type !== NOTIFICATION_CLICK_MESSAGE) return undefined;`). A notification click handled by an old worker against a new page, or the reverse, is ignored (the tap opens nothing special). Both ship precached together and the worker uses `registerType: 'prompt'`, so the window is small.
**How to avoid:** Accepted by D-08; mention in PR body. No shim.

### Pitfall 10: Caddy placeholder silently empty
**What goes wrong:** `docker/Caddyfile` uses `{$HEARTH_HOST}` in the CSP `connect-src 'self' wss://{$HEARTH_HOST}` and `{$HEARTH_HOST_GATEWAY}/32` in `trusted_proxies`. The entrypoint derives `HEARTH_HOST` from `HEARTH_ORIGIN` and exits 1 if the origin is not `https://...`. The E2E overlay sets `HEARTH_HOST` directly (`e2e-compose:69`). A missing variable expands to an empty string `[ASSUMED: Caddy behavior]`, which would block the realtime WebSocket without a startup error.
**How to avoid:** Rename entrypoint, Caddyfile and overlay in the same class commit; E2E realtime specs are the detector.

## Code Examples

### Manifest and title assertion for BRAND-02 (new, in `apps/web/scripts/check-build.mjs`)
```js
// Source: pattern of the existing checks in apps/web/scripts/check-build.mjs (reads dist/ text files)
// vite-plugin-pwa emits dist/manifest.webmanifest [ASSUMED name; confirm with `ls apps/web/dist` in Wave 0]
const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8'));
if (manifest.name !== 'Hestia') fail(`manifest name is ${JSON.stringify(manifest.name)}, expected "Hestia"`);
if (manifest.short_name !== 'Hestia') fail(`manifest short_name is ${JSON.stringify(manifest.short_name)}`);
if (!/<title>Hestia<\/title>/.test(html)) fail('index.html <title> is not Hestia');
```

### Values being renamed (verbatim, read this session)
- `apps/web/vite.config.ts:52-54`: `name: 'Hearth',` / `short_name: 'Hearth',` / `description: 'Deals, shopping lists, meals, bills, and chores for your household.',` (description has no brand word; BRAND-02 says "updated description", D-10 does not; leave unless the owner wants new wording). No manifest `id` key (lines 51-65), so installed-app identity follows `start_url: '/'`, which does not change.
- `apps/web/src/lib/offline/persist.ts:14`: `export const PERSIST_KEY = 'hearth-query-cache';`
- `apps/web/src/lib/push/push-message.ts:10,19`: `NOTIFICATION_CLICK_MESSAGE = 'hearth:notification-click'` and `FALLBACK_NOTIFICATION = { title: 'Hearth', body: 'You have a new notification.' }`
- `apps/web/src/components/shell/AppShell.tsx:86`: ``document.title = `${title} · Hearth`;``
- `apps/service/src/deals/flipp/request-queue.ts:85`: ``return `Hearth/1.0 (self-hosted household admin; +${origin})`;`` (outbound User-Agent; see Open Question 5)
- `apps/service/src/cli.ts:19`: `const USAGE = 'Usage: hearth-admin reset-password <email>';`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Edit applied migrations: forbidden by the gate | Pinned one-time exemption that self-expires | this phase | Gate stays strict; one reviewable JSON |
| `.planning` scratch text as the home of "no X left" rules | Rule in the existing hygiene script with a tested allowlist | this phase | No new CI wiring |

**Deprecated/outdated:** `.planning/research/DOMAIN-MIGRATION.md` section 4.1 lists container names "`hestia-service`, `hestia-caddy`, `hestia-db`". Compose has no `hearth-db`: the service is named `db` (`docker-compose.yml`, only `hearth-service` carries the name), so there is nothing to rename to `hestia-db`; do not invent it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The new GitHub repository name is `hestia` (`alex-tanton/hestia`) for in-repo slugs in `.planning/environment/*` | Pitfall 8, Owner checklist | Wrong slug in two environment scripts; trivial to fix, but confirm with the owner |
| A2 | Runner labels are additive, so `hestia` can be added alongside `hearth` before merge with no downtime | Owner checklist | If labels cannot coexist the Deploy job queues until the owner fixes the runner |
| A3 | iOS fixes the home-screen name at install time; Android updates the installed name later | Pitfalls (none), PR note | Users may still see "Hearth" on their home screen until reinstall; copy in PR body |
| A4 | GitHub redirects the old repository URL for git, web and API after rename; runner and PAT continue to work via the redirect until reconfigured | Runtime State Inventory | Runner offline or PAT 404 after rename; reconfigure |
| A5 | `supabase migration up` tracks applied migrations by version, not file name | Runtime State Inventory | Only matters for a non-fresh database (not in scope per D-04) |
| A6 | Docker "Pool overlaps" and "port is already allocated" are the failure messages for Pitfall 3 | Pitfall 3 | Different wording; behavior (safe abort) is read from `deploy.sh` |
| A7 | Caddy `{$VAR}` expands to an empty string when the variable is unset | Pitfall 10 | If Caddy errors instead, failure is louder (better) |
| A8 | `vite-plugin-pwa` writes `manifest.webmanifest` into `dist/` | Code Examples | Wave 0 `ls` corrects the filename in the check |
| A9 | Supabase images can be pulled in this sandbox for `test:integration` and E2E (scripts prefer the ghcr mirror) | Environment Availability | Integration/E2E can only be proven in CI |

## Open Questions (RESOLVED)

All six were resolved during planning. Each resolution is recorded in `08-05-PLAN.md` (context facts and the owner checklist's "Assumptions and choices" table) and carried out by the plan named in it.

1. **Runner label: rename or keep?** (RESOLVED)
   - What we know: D-03 says rename everything; `deploy.yml:29`, `CONTRIBUTING.md:35`, `docs/deployment.md:62` carry the label; D-12 names the runner in the owner checklist.
   - What's unclear: whether the owner will relabel the host runner.
   - Recommendation: rename to `hestia` in the repo and require the owner to add the label before merge (checklist step 2). If the owner declines, keep `hearth` as one more allowlist entry (`.github/workflows/deploy.yml`, docs lines) rather than weaken the guard globally.
   - **RESOLVED:** renamed to `hestia` per D-03. 08-03 Task 2 changes `deploy.yml` to `runs-on: [self-hosted, hestia]` and updates `CONTRIBUTING.md`, `docs/deployment.md` and `.claude/CLAUDE.md` to match. The owner adds the `hestia` label before merge and removes `hearth` after it (08-05 owner checklist steps 2 and 12). No allowlist entry is needed.

2. **Exact new repository name** (Assumption A1). Recommendation: `hestia`; confirm before the plan writes `.planning/environment/*`. (RESOLVED)
   - **RESOLVED:** `hestia` (`alex-tanton/hestia`), still recorded as assumption A1 for the owner to confirm. 08-05 Task 3 writes the slug into `.planning/environment/*`, and the owner renames the repository after merge (checklist step 10, `gh repo rename hestia --repo alex-tanton/hearth`).

3. **Guard allowlist breadth.** D-13 lists the v1.0 archive explicitly; the recommendation here is `.planning/` as a whole because phase 08 documents, REQUIREMENTS and PROJECT necessarily quote the old name. If the owner wants a tighter guard, allowlist `.planning/milestones/`, `.planning/phases/`, `.planning/research/` and scan `PROJECT.md`, `ROADMAP.md`, `STATE.md`, `.planning/environment/`. (RESOLVED)
   - **RESOLVED:** tighter than both options above. 08-06 Task 1 makes `LEGACY_NAME_ALLOWLIST` six whole-path entries: `.planning/milestones/` (the v1.0 archive D-13 names), `.planning/phases/` and `.planning/research/` (records of the rename and the research before it; this is the planner's reading of D-13's "text that must quote the old name" clause, not entries D-13 lists), the guard script and its test, and `scripts/migration-exemptions.json`. `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md` and `STATE.md` are scanned line by line, and the only old-name text allowed in them is the exact quotes pinned in `LEGACY_NAME_QUOTES`. `.planning/environment/` is scanned in full (08-05 Task 3 cleans it).

4. **Rename the role migration file or only edit its contents?** D-05 and D-03 imply renaming; the pinned exemption supports a rename as `D`+`A` (Pattern 2). Keeping the file name would leave the old word in a tracked path and need one more allowlist entry. Recommendation: rename (the Compose mount lines `docker-compose.yml:51-52` are the only references). (RESOLVED)
   - **RESOLVED:** renamed with `git mv` to `supabase/migrations/20260919060000_hestia_service_role.sql`, keeping the version prefix (08-01 Task 1). The gate accepts it through one rename entry in `scripts/migration-exemptions.json`, and the schema comment edit gets one equal-path entry.

5. **Outbound User-Agent changes (`Hearth/1.0` to `Hestia/1.0`).** It is a brand string sent to Flipp and recipe sites, so it is externally visible behavior; CLAUDE.md says behavior must not change except documented fixes. Recommendation: rename (D-11 sweeps source), list it in the PR body; tests `request-queue.test.ts:104` and `fetch-recipe.test.ts:118-136` assert it. (RESOLVED)
   - **RESOLVED:** renamed to `Hestia/1.0 (self-hosted household admin; +<origin>)` by the 08-05 Task 1 catch-all, asserted by that task's verify and by the two tests. It is listed in the owner checklist's PR body notes.

6. **Dev-only literals** (`hearth-seed-pass-2026`, test DB password `hearth`, `hearth@` in a knip test fixture, `project_id = "hearth"`): all renamed by the catch-all; they are dev/test values (`supabase/seed/seed-users.ts:24`, `e2e/support/env.ts:95`, `service-stack.ts:33`, docs). Check the new seed password still passes `@hestia/shared` password rules and the common-password list (`hestia-seed-pass-2026` is 21 characters, expected to pass; confirm by running the onboarding tests). (RESOLVED)
   - **RESOLVED:** renamed. `project_id = "hestia"` lands in 08-03 Task 2. The seed password `hestia-seed-pass-2026`, the E2E reset password `hestia-reset-pass-2026`, the test database password and the fixtures land in the 08-05 Task 1 catch-all. That task's verify checks that neither password is in `packages/shared/src/data/common-passwords.ts`, and `pnpm test` covers the onboarding tests.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | v24.21.0 | none |
| pnpm | lockfile, filters | yes | 10.34.5 | none |
| Docker engine + daemon | E2E, compose config, image build | yes (daemon answered `docker ps`) | 29.9.2 | none |
| Docker Compose plugin | compose config, E2E | yes | v5.6.1 | none |
| Supabase CLI | `test:integration`, E2E migrations | yes | 2.117.0 (matches CI pin) | CI |
| psql | `db:seed` | yes | 16.15 (stack is Postgres 17; client is enough) | none |
| gh CLI | repo rename and PR steps (owner side) | yes | 2.89.0 | none |
| Sandbox CA bundle for E2E image builds | E2E in this sandbox | yes `/root/.ccr/ca-bundle.crt` | n/a | apply the CLAUDE.md local-only TLS workaround, then revert |
| Supabase local stack running | `test:integration` | no (not started; only a `hearth-registry` container runs) | n/a | `supabase start`, or rely on CI |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** a running Supabase stack (start it); sandbox E2E needs the CA workaround and about nine minutes (104 passed expected).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.1 (workspaces), `node --test` (root harness, Node 24.21.0), Playwright 1.63.0 (E2E) |
| Config file | per-workspace `vitest.config.ts` (service also `vitest.integration.config.ts`, `vitest.coverage.config.ts`); `apps/web/vite.config.ts` test block; `e2e/playwright.config.ts`; harness file list in root `package.json` `test:harness` |
| Quick run command | `node --test scripts/check-repo-hygiene.test.mjs scripts/check-migrations-append-only.test.mjs` (44 tests passed in 2.4 s this session) |
| Full suite command | `pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && pnpm build && pnpm test:integration && pnpm test:e2e` plus `pnpm knip && node scripts/check-knip-baseline.mjs && pnpm jscpd && node scripts/check-repo-hygiene.mjs && node scripts/check-migrations-append-only.mjs --base origin/main` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRAND-01 | Titles, shell, onboarding, install and notification copy say Hestia | component + guard | `pnpm --filter @hestia/web test` (`shell.test.tsx:59,93,127`, onboarding/notification tests renamed in place); `node scripts/check-repo-hygiene.mjs` | yes (assertions change with the sweep); guard Wave 0 |
| BRAND-01 | Push fallback title and click message | unit | `pnpm --filter @hestia/web test` (`push-message`, `service-worker-handlers.test.ts:145`, `notification-target.test.tsx:88,105`) | yes |
| BRAND-02 | Built manifest `name`/`short_name` and `<title>` are Hestia | build check | `pnpm --filter @hestia/web build` (runs `check-build.mjs`) | no, Wave 0: add manifest + title checks |
| BRAND-03 | CLI usage string, wrapper, bin entry, container path | unit + e2e + gate | `pnpm --filter @hestia/service test` (`cli.test.ts`); `sh -n apps/service/bin/hestia-admin`; hygiene mode check; `pnpm test:e2e` (`06-owner-reset-password.spec.ts`, `17-accessibility-states.spec.ts` call `hestiaAdmin`) | yes |
| BRAND-04 | Packages resolve; no stale scope | install + static | `pnpm install --frozen-lockfile`; `pnpm typecheck`; `pnpm lint`; `pnpm build`; `pnpm test:harness` (`test-sweep.test.mjs:206`) | yes |
| BRAND-05 | Env schema, defaults and rejection of old names | unit | `pnpm --filter @hestia/service test -- env` (`env.test.ts`: 36 name sites) plus new cases: only-old-names throws; `HESTIA_TRUSTED_PROXIES` parsed | partly; add 2 cases (Wave 0) |
| BRAND-05 | Compose/overlay/scripts/Dockerfiles consistent | harness + config | `node --test scripts/deploy.test.mjs scripts/deploy-gate.test.mjs scripts/ci-prepull-images.test.mjs`; `docker compose --env-file <tmp> -f docker/docker-compose.yml -f e2e/docker-compose.e2e.yml config -q`; `bash -n scripts/*.sh docker/*.sh` | yes |
| BRAND-06 | Everything green under the new brand | full | full suite command above | yes |
| D-06 | Exemption narrow, tested, self-expiring | harness | `node --test scripts/check-migrations-append-only.test.mjs` | cases are Wave 0 |
| D-13 | No old name left, allowlist honoured | harness | `node --test scripts/check-repo-hygiene.test.mjs`; `node scripts/check-repo-hygiene.mjs` | cases are Wave 0 |

### Sampling Rate
- **Per task commit:** the quick run command plus `git grep -n -i hearth -- . ':!.planning' ':!pnpm-lock.yaml'` count (must be monotonically decreasing, zero at the end), and the touched workspace's `test`/`typecheck`.
- **Per wave merge:** `pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && pnpm build`.
- **Phase gate:** full suite, including `pnpm test:integration` and `pnpm test:e2e` (sandbox CA workaround, expect 104 passed), and `node scripts/check-migrations-append-only.mjs --base origin/main` green with the exemption file present. `pnpm test:sweep` is optional (sweep never gates).

### Wave 0 Gaps
- [ ] `scripts/check-repo-hygiene.mjs` + tests: legacy-name guard (Pattern 3) with allowlist cases
- [ ] `scripts/check-migrations-append-only.mjs` + tests + `scripts/migration-exemptions.json` (Pattern 2); `toBlob` values filled last
- [ ] `apps/web/scripts/check-build.mjs`: manifest and `<title>` assertion (BRAND-02)
- [ ] `apps/service/src/env.test.ts`: only-old-names rejected; `HESTIA_TRUSTED_PROXIES` honoured
- [ ] Owner checklist artifact `.planning/phases/08-full-rebrand-to-hestia/08-OWNER-CHECKLIST.md`
- [ ] Framework install: none

## Security Domain

`security_enforcement` is enabled (config.json, `security_asvs_level: 1`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no auth logic changes; GoTrue and sign-in screens only change copy) | existing |
| V3 Session Management | no (supabase-js default storage key derives from the unchanged origin; no `storageKey` override, `grep` over `apps/web/src` found none) | existing |
| V4 Access Control | yes (DB role and RLS isolation boundary) | RLS unchanged; `hestia_service` must stay `NOLOGIN NOINHERIT` until the login SQL runs and member of `anon, authenticated, service_role` only; the service-role ESLint fence is path-based on `privileged/` and unaffected |
| V5 Input Validation | yes (env validation) | Zod `envSchema` is the single reader; fail closed on invalid required names |
| V6 Cryptography | no | existing (JWT/VAPID keys unchanged; no key regeneration required) |
| V14 Configuration | yes | secrets stay in `/srv/hestia/.env` outside the checkout (`generate-secrets.sh` refuses to overwrite); `.env.example` documents names only; do not log or echo env values |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Misnamed optional env var silently drops `TRUSTED_PROXIES` (spoofable or shared client IP) | Spoofing / DoS | Atomic env rename, legacy-name guard, `env.test.ts` coverage (Pitfall 1) |
| Role-name mismatch leaves the service unable to connect, or tempts a fallback to a privileged role | Elevation of privilege | Keep `DATABASE_URL` user, `service-stack.ts`, login SQL and migration in one commit; never fall back to `service_role` (Anti-Patterns in CLAUDE.md) |
| Exemption mechanism abused to hide a real migration edit | Tampering | Content-pinned blobs, both ends, narrow paths, self-expiring, tested (Pattern 2) |
| Hostile `--base` or exemptions path reaching a shell | Tampering | Keep git runs as argument arrays (no shell), keep `--base` validation; treat `--exemptions` as a file path only, never interpolated |
| Deploy job running on a runner for a stale label | Tampering (job on production box) | Keep `workflow_run` push-to-`main` conditions in `deploy.yml` unchanged; only the label changes |
| Old and new env files both present on host leaking secrets | Information disclosure | Owner removes `/srv/hearth` after verification; file mode 700 directory per `docs/deployment.md` setup |

## Sources

### Primary (HIGH confidence)
- Repository files read this session with Read or cat/grep: `.planning/phases/08-full-rebrand-to-hestia/08-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/research/DOMAIN-MIGRATION.md`, `scripts/check-migrations-append-only.mjs` and `.test.mjs` (structure), `scripts/check-repo-hygiene.mjs` and `.test.mjs` (structure), `scripts/deploy.sh`, `scripts/deploy-gate.sh`, `scripts/generate-secrets.sh`, `scripts/ci-prepull-images.sh`, `.github/workflows/{ci,deploy}.yml`, `docker/*`, `e2e/docker-compose.e2e.yml`, `e2e/setup/stack.ts`, `e2e/support/*`, `apps/service/src/env.ts`, `apps/web/vite.config.ts`, `apps/web/scripts/{check-build,generate-icons}.mjs`, `commitlint.config.js`, `knip.json`, `.jscpd.json`, root `package.json`, `.claude/CLAUDE.md`, `docs/deployment.md`, `docs/branding.md`
- Executed this session: `git grep` taxonomy of every `hearth` token (338 files, 1,013 non-`.planning` lines); `pnpm install --lockfile-only` and `--frozen-lockfile` in a scratch copy (output identical to substitution, 6 keys); `node --test` on the two gate test files (44 pass); `pnpm/node/docker/supabase/psql/gh --version`

### Secondary (MEDIUM confidence)
- none (no external documentation was needed; no web search performed)

### Tertiary (LOW confidence)
- Host and GitHub operational behavior tagged `[ASSUMED]` above (A1-A9)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, nothing new; tooling versions read from the machine.
- Architecture (token classes, gate designs): HIGH for inventory and mechanics; the exemption and guard are designs, verified only against the existing scripts' structure, not yet implemented.
- Pitfalls: HIGH for 1, 2, 4, 5, 6, 7, 8 (read from source); MEDIUM for 3, 9, 10 (behavior inferred, wording assumed).

**Research date:** 2026-10-25
**Valid until:** 2026-11-25 (repo-local; invalidated by any new `hearth` token landing on `main` before the sweep, so re-run `git grep -n -i hearth` at execution start)
