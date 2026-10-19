---
phase: "03"
slug: "evidence-gated-removal"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-19"
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `03-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.1 (web: jsdom; service and packages: node), `node --test` for the root harness, Playwright for E2E (CI only) |
| **Config file** | `apps/*/vitest.config.ts`, `apps/web/vite.config.ts`, `apps/service/vitest.integration.config.ts`, `e2e/playwright.config.ts`, `knip.json` |
| **Quick run command** | `pnpm typecheck && pnpm lint && pnpm format:check` (about 70 s) plus `pnpm --filter <touched-pkg> test` and knip |
| **Full suite command** | `pnpm test` (about 97 s) and `pnpm --filter @hearth/web build`; integration, E2E and Docker builds run in PR CI only |
| **Estimated runtime** | ~70 s quick, ~110 s full local |

---

## Sampling Rate

- **After every task commit:** `pnpm typecheck && pnpm lint && pnpm format:check`, `pnpm --filter <pkg> test` for the touched package, and knip with the committed config and the throwaway `node: false` config
- **After every plan wave:** `pnpm test` and `pnpm --filter @hearth/web build`
- **Before `/gsd-verify-work`:** All three PRs green in CI (six jobs), final knip summaries diffed and archived
- **Max feedback latency:** ~110 seconds locally

---

## Per-Task Verification Map

Task IDs are filled in by the planner from the PLAN.md files.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-XX-XX | — | — | DEAD-01 | — | N/A | knip | `pnpm knip` and `pnpm knip:production` piped through `node scripts/knip-summary.mjs`, `grep -P '^files\t'`; default shows none, production shows only `normalized-fixtures.ts` | ❌ W0 | ⬜ pending |
| 03-XX-XX | — | — | DEAD-02 | — | N/A | knip + git grep + suite | per item: `--trace-export` shows `(no imports found)`, `git grep -n -I -w -F -e NAME -- . ':!pnpm-lock.yaml' ':!.planning' ':!.claude'` shows the definition only, then `pnpm typecheck && pnpm lint && pnpm test` and the web build | ❌ W0 | ⬜ pending |
| 03-XX-XX | — | — | DEAD-03 | — | N/A | install + typecheck | `pnpm install --frozen-lockfile`, `grep -c fuse pnpm-lock.yaml` equals 0, `pnpm --filter @hearth/service typecheck`, `pnpm --filter @hearth/service exec tsx --version` | ✅ | ⬜ pending |
| 03-XX-XX | — | — | DEAD-04 | — | N/A | git grep + format | `git grep -n -I BUILD_PROMPT -- . ':!.planning' ':!.claude'` empty, path-existence sweep, `pnpm format:check` | ✅ | ⬜ pending |
| 03-XX-XX | — | — | DEAD-05 | — | N/A | git + CI | `git ls-files -ci --exclude-standard` empty, tracked-file pattern audit lists only `.env.example`, throwaway CI step shows `run1 == run2 == committed` for `db/types.ts` | ✅ (CI step ❌ W0) | ⬜ pending |
| 03-XX-XX | — | — | DEAD-06 | — | N/A | text + git | every remaining knip finding appears by name in `OWNER-CANDIDATES.md` or the ledger; `git diff --name-status origin/main...HEAD` shows no `D` on a D-10 standing-list path | ✅ | ⬜ pending |
| 03-XX-XX | — | — | Phase gate | — | N/A | git + CI | `git diff --stat origin/main...<tip> -- supabase/migrations` prints nothing; six CI jobs green per PR; `pnpm test:sweep` on the final tree | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/knip-summary.mjs` — copy verbatim from `/home/user/hearth-aside/bin/knip-summary.mjs` (100755) plus a root `knip:summary` script, needed by every later evidence step (DEAD-01, DEAD-02)
- [ ] Throwaway knip config generator (a copy of `knip.json` with top-level `"node": false`, passed via `--config`, never committed) — restores the three hidden `meal-fixtures.ts` findings (DEAD-02)
- [ ] `.planning/cleanup/REMOVAL-LEDGER.md` skeleton — columns: item, kind, tool evidence, text-search evidence, build/test evidence, commit, PR (DEAD-02, DEAD-06)
- [ ] Throwaway draft-PR CI step that runs `pnpm db:types` twice after `supabase start` and diffs both runs against the committed file (DEAD-05)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `pnpm db:seed` end to end after the `tsx` removal | DEAD-03 | Needs a Docker host and no CI job covers it | Owner runs `pnpm db:seed` against a local Supabase stack; local proof is the `tsx` resolution from `apps/service` plus the seed typecheck |
| Both Docker image builds | Phase gate | No Docker on the cloud box | Read the `test-e2e` job in PR CI; re-run on an ECR `toomanyrequests` pre-pull failure rather than revert |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 110s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
