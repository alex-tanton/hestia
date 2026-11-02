# Phase 7: Planning Cleanup & Documentation Restructure - Context

**Gathered:** 2026-10-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Archive the v1.0 planning artifacts out of the active `.planning/` tree, and restructure documentation so the root `README.md` is a concise landing page (<150 lines) with the detailed runbooks living in `docs/development.md`, `docs/deployment.md`, and `docs/testing.md` with no operational knowledge lost. Requirements: CLEAN-01, DOC-01, DOC-02. No application code, branding, or infrastructure changes (Phases 8-11).

</domain>

<decisions>
## Implementation Decisions

### Archive scope in `.planning/`
- **D-01:** Archive into `.planning/milestones/v1.0/`: `phases/` (all six v1.0 phase dirs), `cleanup/` (ledgers and tools), and `quick/` (two finished v1.0 quick tasks). The v1.0 phase dirs land under `milestones/v1.0/phases/` as CLEAN-01 requires.
- **D-02:** Also move the two existing flat files `milestones/v1.0-ROADMAP.md` and `milestones/v1.0-REQUIREMENTS.md` into `milestones/v1.0/`, and update the link in `.planning/ROADMAP.md` (and any other reference) so it still resolves.
- **D-03:** Use `git mv` so history follows the files; the move is a rename-only commit with no content edits to the moved files.
- **D-04:** After the move, drop *regenerable* artifacts from the archived `cleanup/` tree in a separate commit (raw generated outputs such as knip/jscpd reports and patch files). Ledgers, summaries, and anything a ledger or the knip production baseline cites as evidence are kept. If an artifact is ambiguous (not clearly regenerable, or cited), keep it and list it for the owner. — **Reversibility:** reversible — deleted files remain in git history.
- **D-05:** `.planning/codebase/` (stale maps of the Hearth code) is deleted, not archived. — **Reversibility:** reversible — history keeps them, and `/gsd-map-codebase` regenerates them after the Phase 8 rebrand.
- **D-06:** `.planning/environment/` (cloud setup/check scripts and `CLOUD-ENVIRONMENT.md`) stays in place. `.planning/research/` (v2.0 input, including `DOMAIN-MIGRATION.md`), `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `state.json` stay in place.

### docs/ layout and names
- **D-07:** `git mv docs/deploy.md docs/deployment.md` (the existing 292-line guide becomes the required `docs/deployment.md`); fix every inbound reference to `deploy.md` (README, `docs/file-map.md` index, `docs/use-cases.md`, `.claude/CLAUDE.md`, code comments, any test). — **Reversibility:** costly — several call sites link to the old path.
- **D-08:** README's Deployment and Backups content overlaps `deploy.md` (Pinned names, Backups, Restore, restore test). Reconcile by merging: diff each README section against `deployment.md`, keep the more complete wording, fold in only facts that exist solely in the README, then delete the README copy.
- **D-09:** Create `docs/development.md` from the README's Development material: install, dev servers, command table, coverage note, running the service locally, Database section, commit-hook note. It also absorbs CONTRIBUTING.md's "Scripts" and "Checks before pushing" content (user chose to fold these in), de-duplicated against the README command table.
- **D-10:** README's "End-to-end tests" section is merged into the existing E2E section of `docs/testing.md` (no E2E text in `development.md`); keep the more complete text, no loss of README-only facts (per-run Compose project, `HEARTH_E2E_REUSE_STACK`, `HEARTH_E2E_RUN_ID`).
- **D-11:** CONTRIBUTING.md otherwise stays as the contributor-policy doc (branches, CI, commit messages, deploy gate). Where it duplicates content moved into `development.md`, replace the duplicate with a link; update its links to moved docs.

### README shape (<150 lines)
- **D-12:** Keep the name "Hearth" and current command/package names (`@hearth/*`, `hearth-admin`) in the README and new docs; Phase 8 renames docs and code together.
- **D-13:** README contents: one-paragraph overview, prerequisites, quickstart (install, the two dev servers, and 4-5 key commands such as lint, typecheck, test), a short architecture paragraph plus the repo Layout table linking to `docs/architecture.md`, and a docs index. Full command table, local-service steps, database, E2E details, deployment, backups, restore, and pinned names move to the docs.
- **D-14:** The docs index is a table listing every file in `docs/` (development, deployment, testing, architecture, design, file-map, use-cases, branding) plus `CONTRIBUTING.md`, each with a one-line purpose. Every link must resolve.

### Claude's Discretion
- **Proof of zero knowledge loss** (area not selected for discussion): the planner chooses the verification, expected to include a README-section to destination map in the plan, `wc -l README.md` < 150, and an all-links-resolve check across README/docs/CONTRIBUTING. No docs-side decision-log or ADR files may be added (project constraint).
- Exact section ordering inside `development.md` and `deployment.md`, wording of merged passages, and which `cleanup/` artifacts qualify as regenerable (per D-04's evidence rule).
- Updating `.claude/CLAUDE.md` and `docs/file-map.md` for moved/renamed paths and the removed `.planning/codebase/`, `.planning/cleanup/`, and `.planning/phases/` references.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` §Phase 7 — goal and the three success criteria
- `.planning/REQUIREMENTS.md` §Phase 7 — CLEAN-01, DOC-01, DOC-02 and their acceptance criteria
- `.planning/PROJECT.md` — v2.0 constraints: documentation integrity (no operational knowledge discarded), append-only migrations

### Documentation to restructure
- `README.md` — 313 lines; sections Prerequisites, Layout, Development (incl. End-to-end tests, Running the service locally, Database), Deployment (Pinned names, Host prerequisites, First start, Deploy), Backups (Restore test, Restore production)
- `docs/deploy.md` — becomes `docs/deployment.md`; already has Overview, System requirements, Pinned names, Environment variables, First-time setup, Ongoing deploys, Manual rollback, Backups, Restore, Troubleshooting
- `docs/testing.md` — 829 lines; E2E section at line ~371 receives the README E2E content
- `CONTRIBUTING.md` — Scripts / Checks before pushing sections fold into `docs/development.md`
- `docs/file-map.md` — doc index (lines ~23, ~180-181) and Tailscale/README reference (line ~124) need updating
- `docs/architecture.md`, `docs/design.md`, `docs/use-cases.md`, `docs/branding.md` — linked from the new README docs index; `docs/use-cases.md` line ~27 references `docs/deploy.md`
- `.claude/CLAUDE.md` — references `docs/` paths and planning paths; update where paths move

### Planning files to archive
- `.planning/phases/` (6 dirs), `.planning/cleanup/`, `.planning/quick/`, `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`
- `.planning/codebase/` — to delete
- `scripts/knip-production-baseline.txt`, `knip.json` — the live knip baseline; confirm nothing reads `.planning/cleanup/knip/` before removing regenerable files

### Path-sensitive config (verify unaffected by the move)
- `.dockerignore`, `.prettierignore`, `knip.json` (`ignore: .planning/**`), `.gitignore` (`.planning/research/.cache/`, `.planning/cleanup/logs/`), `.github/workflows/deploy.yml`, `.github/workflows/sweep.yml`, `scripts/deploy-gate.sh` and `scripts/deploy-gate.test.mjs` (docs/ and .planning/ changes skip deploy)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/deploy.md` and `docs/testing.md`: already contain most operational text the README duplicates, so the work is a merge, not a rewrite.
- `scripts/deploy-gate.sh`: treats `docs/*` and `.planning/*` as non-deployable, so this phase's pushes do not trigger a deploy.

### Established Patterns
- Specs in `docs/` are the only source of truth; no review, decision-log, or ADR files go in `docs/`.
- Comments and docs state the rule itself, not retired spec sections.
- Prettier formats Markdown in `docs/`/root (`.prettierignore` excludes `.planning/`), so new/edited docs must pass `pnpm format:check`.
- `main` is curated; changes land through branches and pull requests per `CONTRIBUTING.md`.

### Integration Points
- Source comments cite `docs/testing.md` (`test/global-tz.mjs`, `test/clock-setup.mjs`, `scripts/test-sweep.mjs`, `test/eslint-service-role-fence.test.mjs`, `apps/service/vitest.integration.config.ts`): keep `docs/testing.md` anchors intact.
- `scripts/check-repo-hygiene.test.mjs` and related tests reference README/docs: re-run after the restructure.

</code_context>

<specifics>
## Specific Ideas

- README target: under 150 lines, no dense deployment or low-level test configuration scripts.
- Archive layout exactly: `.planning/milestones/v1.0/{phases,cleanup,quick,ROADMAP.md,REQUIREMENTS.md}` (file names inside may drop the `v1.0-` prefix or keep it; planner decides, links must resolve).

</specifics>

<deferred>
## Deferred Ideas

- Regenerate `.planning/codebase/` maps with `/gsd-map-codebase` after the Phase 8 rebrand.
- Rewrite docs for the Hestia name and for the Cloudflare Tunnel (replacing Tailscale Funnel) in Phases 8 and 9; this phase documents the system as it is today.

</deferred>

---

*Phase: 7-Planning Cleanup & Documentation Restructure*
*Context gathered: 2026-10-25*
