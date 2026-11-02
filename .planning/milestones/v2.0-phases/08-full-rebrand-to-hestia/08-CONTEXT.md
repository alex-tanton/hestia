# Phase 8: Full Rebrand to Hestia - Context

**Gathered:** 2026-10-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Rebrand Hearth to Hestia everywhere in the live repository: user-facing PWA copy and titles, the Web App Manifest, the owner CLI, the `@hearth/*` workspace packages, `HEARTH_*` environment variables, Docker/Compose names, the `hearth_service` database role, host paths, in-repo URLs and live docs. All unit, component, integration and E2E suites must pass under the new brand (BRAND-01..06).

Out of scope: moving the origin to `hestia.aberrance.app`, Cloudflare Tunnel, CSP/CORS changes (Phase 9), magic links and SMTP (Phase 10), VAPID subject and edge hardening (Phase 11). The pinned public origin value is unchanged in this phase.

</domain>

<decisions>
## Implementation Decisions

### Environment variables
- **D-01:** Hard cutover from `HEARTH_*` to `HESTIA_*`. No fallback reads of `HEARTH_*` in `apps/service/src/env.ts`, `scripts/deploy*.sh`, Compose, CI, `generate-secrets.sh` or `.env.example`. A service started with only old names fails Zod validation at startup. — **Reversibility:** costly — every env file on every host must use the new names; undoing touches env.ts, Compose, scripts, workflows and docs.
- **D-02:** This overrides the "fallback compatibility where needed" wording in BRAND-05; the planner should update that requirement text to match. Build-time `VITE_*` names are not prefixed `HEARTH_` and stay as they are.

### Infrastructure and data-bearing names
- **D-03:** Rename everything, including the data-bearing names: Compose project `name: hearth` to `hestia`, volumes, images (`hearth-service`, `hearth-caddy` to `hestia-*`), Compose service `hearth-service`, the host path `/srv/hearth` to `/srv/hestia`, the `HEARTH_SERVICE_DB_PASSWORD` variable and the login-role SQL file `docker/db/hearth-service-login.sql`. — **Reversibility:** one-way — renaming the Compose project re-prefixes volumes, so existing volumes are orphaned.
- **D-04:** There is no production data to preserve; a fresh deploy is acceptable. No volume-migration runbook is needed. `docs/deployment.md` must document the fresh-host setup with the new names, and the owner must create `/srv/hestia/.env` (HESTIA_* names) before the rename merges, because a merge to `main` auto-deploys.
- **D-05:** Database role `hearth_service` becomes `hestia_service` by editing the existing migrations in place (`supabase/migrations/20260919060000_hearth_service_role.sql`, references in `20260919070000_schema.sql`, other migrations that mention it), then regenerating `apps/service/src/db/types.ts` only if it changes. — **Reversibility:** one-way — any database that already ran the old migrations keeps `hearth_service` and will not re-run them; safe here only because no data is kept.
- **D-06:** CONFLICT TO RESOLVE IN PLANNING: `scripts/check-migrations-append-only.mjs` (a blocking CI gate) fails on any edit of an applied migration. Editing migrations in place needs a deliberate, narrow, documented exemption (for example an explicit one-time allow entry or an override tied to this rebrand commit) with a test in `scripts/check-migrations-append-only.test.mjs`, and the gate must go back to strict afterwards. Do not weaken the gate generally, and do not rewrite published git history.

### CLI and browser-persisted state
- **D-07:** `hestia-admin` replaces `hearth-admin` as a clean break: rename `apps/service/bin/hearth-admin`, the `bin` entry in `apps/service/package.json`, the Dockerfile install path, `ForgotPasswordScreen` copy and every doc reference. No alias or deprecation shim.
- **D-08:** Browser-side keys are renamed with no migration of old data: `PERSIST_KEY` `'hearth-query-cache'` (`apps/web/src/lib/offline/persist.ts`), `NOTIFICATION_CLICK_MESSAGE` `'hearth:notification-click'` (`apps/web/src/lib/push/push-message.ts`), service-worker cache names and any other `hearth`-prefixed localStorage/IndexedDB/cache identifiers the planner finds. Accepted cost: one cold cache, and any offline writes queued on a device at upgrade time are dropped. Note this in the PR description.

### Packages and manifest
- **D-09:** Workspace scopes `@hearth/*` to `@hestia/*` for shared, recurrence, matching, service, web, e2e and seed (`@hearth/seed` to `@hestia/seed`), including every import, `pnpm --filter` reference, tsconfig/knip/vitest config, Dockerfile and workflow. The lockfile is regenerated with the repo's pnpm, never hand-edited.
- **D-10:** Manifest `name` and `short_name` are `Hestia`; page title is `Hestia` and `${page} · Hestia` (AppShell); push fallback title is `Hestia`. Tailwind/theme tokens and icons are unchanged unless an icon contains the word "Hearth" as text (planner checks `apps/web/scripts/generate-icons.mjs`).

### Sweep scope
- **D-11:** Rewrite Hearth to Hestia in all live files: source, comments, tests, `docs/*.md` (including the `docs/branding.md` title and name statements), `README.md`, `CONTRIBUTING.md`, workflows, scripts, `.env.example`, `.planning/PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md` where they describe current state.
- **D-12:** Rename the repository: update every in-repo URL, remote reference and name to the Hestia repo name, and give the owner a checklist step to rename the GitHub repository after the merge (GitHub redirects the old URL). The self-hosted runner's checkout path and Dependabot/workflow references are part of that checklist. The branch work continues under the current repo name until then.
- **D-13:** `.planning/milestones/v1.0/**` and git history stay untouched (historical record). Add a "no `hearth` left" guard to the hygiene checks with an explicit allowlist (the v1.0 archive, `pnpm-lock.yaml` entries only if unavoidable, any text that must quote the old name such as a rename note). Enforcement belongs in `scripts/check-repo-hygiene.mjs` or a sibling script with its own test, wired into the existing CI `hygiene` job.

### Claude's Discretion
- Exact regex and ordering of the mechanical rename, as long as each category (packages, env, infra, DB, CLI, UI copy, docs) lands as a reviewable commit.
- How the migration-gate exemption (D-06) is expressed, provided it is narrow, tested and removed or self-expiring.
- Casing of the display name in lowercase contexts (`hestia-service`, `hestia_service`, `/srv/hestia`) follows the existing hearth casing one-to-one.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` (Phase 8) — goal and 6 success criteria
- `.planning/REQUIREMENTS.md` (BRAND-01..BRAND-06) — acceptance criteria; BRAND-05 fallback wording superseded by D-01
- `.planning/PROJECT.md` — current-state prose to rebrand
- `.claude/CLAUDE.md` — conventions, constraints (curated `main`, deploy on push, no history rewrite, behavior must not change)

### Docs to rebrand and keep truthful
- `docs/branding.md` — product name and voice
- `docs/deployment.md` — host paths, env file, fresh-host setup, pinned names
- `docs/development.md`, `docs/testing.md`, `docs/architecture.md`, `docs/design.md`, `docs/file-map.md`, `docs/use-cases.md`, `README.md`, `CONTRIBUTING.md`

### Gates the rename must satisfy
- `scripts/check-migrations-append-only.mjs` and `.test.mjs` — blocks in-place migration edits (see D-06)
- `scripts/check-repo-hygiene.mjs` and `.test.mjs` — home of the new no-`hearth` guard (D-13)
- `scripts/check-knip-baseline.mjs`, `scripts/knip-production-baseline.txt`, `knip.json`, `.jscpd.json` — workspace names appear in baselines/config
- `scripts/deploy.sh`, `scripts/deploy-gate.sh`, `scripts/generate-secrets.sh`, `.github/workflows/{ci,deploy,sweep}.yml` — env names, paths, filters

### Code touchpoints
- `apps/service/src/env.ts` — env schema (D-01)
- `apps/service/bin/hearth-admin`, `apps/service/package.json`, `apps/service/src/cli.ts` — CLI (D-07)
- `docker/docker-compose.yml`, `docker/service.Dockerfile`, `docker/caddy.Dockerfile`, `docker/Caddyfile`, `docker/kong.yml`, `docker/db/hearth-service-login.sql`, `e2e/docker-compose.e2e.yml` — infra names
- `supabase/migrations/*.sql` — `hearth_service` role (D-05)
- `apps/web/src/lib/offline/persist.ts`, `apps/web/src/lib/push/push-message.ts`, `apps/web/src/sw.ts`, `apps/web/vite.config.ts`, `apps/web/index.html` — browser identifiers and manifest

</canonical_refs>

<code_context>
## Existing Code Insights

### Scale of the change
- 336 live files contain "hearth" (about 1,339 matches excluding `.planning/milestones` and the lockfile): `@hearth/` 322 lines, `HEARTH_` 365, `hearth-admin` 50, `hearth-service` 78, `hearth_service` 75, `hearth-caddy` 19, `/srv/hearth` 25, capitalised `Hearth` 106.

### Established Patterns
- Compose project is pinned by `name: hearth` (docker-compose.yml lines 11 and 291), so volume names are derived from it.
- Hand-written `sh` CLI wrapper `apps/service/bin/hearth-admin` is not a build output.
- Test-clock and sweep tooling reference package filters (`@hearth/...`); scripts' `.test.mjs` files assert on names.
- Web user copy lives in `*-copy.ts` files and a few screens (InstallStep, OnboardingLayout, AuthenticatedLayout, notification-copy, bills-copy).

### Integration Points
- A merge to `main` triggers CI then auto-deploy via the self-hosted runner, using `/srv/hearth/.env` today; the new host path and env names must exist before merge (D-04).
- `pnpm-lock.yaml` must be regenerated after package renames; CI uses `--frozen-lockfile`.
- Knip production baseline and jscpd config may contain old names.

</code_context>

<specifics>
## Specific Ideas

- Do the rename as separable commits (packages, env/infra, DB role, CLI/browser keys, UI copy, docs/URLs) so review can follow each category.
- E2E needs the sandbox TLS workaround from CLAUDE.md to run locally; expect 104 passed.

</specifics>

<deferred>
## Deferred Ideas

- Origin change to `hestia.aberrance.app`, Cloudflare Tunnel, CSP/CORS — Phase 9.
- Magic links and SMTP — Phase 10.
- VAPID subject and edge hardening — Phase 11.
- Migrating queued offline writes across the browser-key rename — rejected for this phase (D-08).

</deferred>

---

*Phase: 08-full-rebrand-to-hestia*
*Context gathered: 2026-10-25*
