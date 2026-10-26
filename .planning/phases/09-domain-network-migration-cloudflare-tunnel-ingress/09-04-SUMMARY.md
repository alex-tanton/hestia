---
phase: 09-domain-network-migration-cloudflare-tunnel-ingress
plan: 04
subsystem: docs
tags: [cloudflare-tunnel, runbook, owner-checklist, docs, requirements, net-01, net-05]

requires:
  - phase: 09-domain-network-migration-cloudflare-tunnel-ingress
    provides: 09-01 cloudflared service, no host port, spec 20/21; 09-02 prepare step, in-container health gate, caddy-entrypoint test; 09-03 fixtures on the new origin
provides:
  - docs/deployment.md rewritten for the tunnel ingress, with a Cloudflare Tunnel section and the pinned origin https://hestia.aberrance.app
  - the first deploy's network recreate documented (log lines, downtime, exact failure messages, hestia-compose down recovery)
  - 09-OWNER-CHECKLIST.md with the ordered owner steps, PR body notes and owner-visible choices
  - file map, testing guide, development seed command, architecture overview and CLAUDE.md aligned with the tunnel ingress
  - NET-03, NET-04 and Phase 9 success criteria 3 and 4 worded as D-05, D-06 and D-09 deliver them
affects: [09-05]

plan_head_before: a102c54e43c3a765232b8b4b10bf27c4b77ea2c1
plan_head_after: bea3f3ec9fecfd42154eeecf4dd15df56b31204a

actuals:
  tokens: 9188
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Doc counts derived from the lists they describe (root test:harness script and e2e/package.json test script), checked by a verify that recomputes both"
    - "Phase-local docs-claims allowlist concatenated with Phase 8's for the claims checker"

key-files:
  created:
    - .planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-OWNER-CHECKLIST.md
    - .planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-docs-claims-allow.tsv
  modified:
    - docs/deployment.md
    - docs/file-map.md
    - docs/testing.md
    - docs/development.md
    - docs/architecture.md
    - .claude/CLAUDE.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - "The first-deploy network recreate is documented in docs/deployment.md (its own subsection under Ongoing deploys plus a troubleshooting bullet) and in checklist step 7, not only in the checklist"
  - "Requirement and roadmap wording changed on exactly four lines; checkboxes and every other line untouched"

patterns-established:
  - "Commit type docs without a scope: commitlint's closed scope list rejects docs(09-0x)"

requirements-completed: [NET-01, NET-02, NET-03, NET-04, NET-05]

coverage:
  - id: D1
    description: "docs/deployment.md has the Cloudflare Tunnel section before First-time setup, the eight-service stack, no host port, in-container health checks, the pinned origin with its one-way warning, and no retired-ingress text"
    requirement: NET-01
    verification:
      - kind: other
        ref: "Task 1 verify: retired-ingress grep empty, required-fact greps, section order, no host-port curl, claims checker checked=62 misses=0, links broken=0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The first deploy's network recreate, its Network hestia Removing to Created lines, downtime, both failure messages and the hestia-compose down recovery (never -v) are in the runbook and the checklist"
    requirement: NET-01
    verification:
      - kind: other
        ref: "Task 1 verify: greps for each message, the prepare step and hestia-compose down in docs/deployment.md and 09-OWNER-CHECKLIST.md; no 'down -v'"
        status: pass
    human_judgment: false
  - id: D3
    description: "No doc, README, CONTRIBUTING or CLAUDE.md names the retired ingress or tells anyone to call a host-published port; development seed command uses Caddy's container address"
    requirement: NET-05
    verification:
      - kind: other
        ref: "Task 2 verify: recursive retired-ingress grep over docs, README.md, CONTRIBUTING.md and .claude/CLAUDE.md empty; CADDY_IP present"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/testing.md counts equal the lists they describe: fourteen harness tests, sixteen node --test files"
    requirement: NET-02
    verification:
      - kind: other
        ref: "Task 2 verify: node script recomputed harness=14 e2e/support=2 total=16 and matched the three phrases"
        status: pass
    human_judgment: false
  - id: D5
    description: "NET-03, NET-04 and success criteria 3 and 4 state D-05, D-06 and D-09; nothing else in either file changed"
    requirement: NET-03
    verification:
      - kind: other
        ref: "Task 3 verify (requirement wording check) exit 0; git show --numstat prints 2/2 for each file"
        status: pass
    human_judgment: false
  - id: D6
    description: "Whether the runbook works against the real Cloudflare dashboard, token and edge (route naming, DNS record, WebSockets, edge-set client IP) cannot be exercised without the owner's account"
    requirement: NET-02
    verification: []
    human_judgment: true
    rationale: "Needs the owner's Cloudflare account; checklist steps 1-10 and assumptions A1-A8 carry the checks"

duration: 14min
completed: 2026-10-26
status: complete
---

# Phase 09 Plan 04: Tunnel Runbook, Owner Checklist and Docs Alignment Summary

**`docs/deployment.md` now takes an owner from nothing to `https://hestia.aberrance.app` through a Cloudflare Tunnel (including what the first deploy's network recreate prints and how to recover), a phase owner checklist orders every outside step the merge depends on, the other guides and CLAUDE.md match the new stack with derived counts, and NET-03/NET-04 state what D-05, D-06 and D-09 deliver.**

## Performance

- **Duration:** about 14 min
- **Completed:** 2026-10-26T18:15Z
- **Tasks:** 3
- **Files:** 10 changed (2 new), 309 insertions, 99 deletions

## Task Commits

1. **Task 1 (tracer): runbook, checklist, allowlist** - `68414b0` `docs: run ingress through a Cloudflare Tunnel on hestia.aberrance.app`
2. **Task 2: guides and CLAUDE.md** - `9302f99` `docs: describe the tunnel ingress across guides and CLAUDE.md`
3. **Task 3: requirement wording** - `bea3f3e` `docs: align NET-03, NET-04 and Phase 9 criteria with D-05, D-06, D-09`

(The plan's subjects used scopes `deploy` and `planning`; commitlint's closed scope list and 71-character limit led to unscoped `docs:` subjects, see Deviations.)

## Accomplishments

- `docs/deployment.md`: overview and Pinned names rewritten around the origin (hostname `hestia`, zone `aberrance.app`, one-way warning); eight services with a `cloudflared` row; Cloudflare and port 7844 dependency; `cloudflared` and rewritten Caddy bullets (plain HTTP in, `CF-Connecting-IP` only from the Compose subnet, `HESTIA_TRUSTED_PROXIES` guard, trade-off that Cloudflare's edge sees clear text); `CLOUDFLARE_TUNNEL_TOKEN` row; new `## Cloudflare Tunnel` section (five steps plus Before you merge, After an origin change, Rotating the token) before First-time setup; deploy step 3 rewritten around the prepare step, step 8 in-container, a new "The first deploy on the tunnel ingress" subsection; restore and troubleshooting use the in-container health command; three new troubleshooting bullets (unreachable site, `172.16.238.x` in every log line, half-done recreate).
- `09-OWNER-CHECKLIST.md`: 14 numbered steps (1-6 gate the merge, 7-10 merge/first deploy/checks, 11-14 after merge), PR body notes, and an assumptions table (six owner-visible rows with how to overrule each, plus A1-A8 and how the first deploy confirms them). No secret value.
- `docs/file-map.md`, `docs/testing.md`, `docs/development.md`, `docs/architecture.md`, `.claude/CLAUDE.md`: `cloudflared` row, TLS sentence, deploy/entrypoint/pre-pull/generate-secrets rows, new harness and ingress-config bullets, E2E renumbering (spec 20 ingress, 21 removal) with a rewritten "Adding a new journey" and a client-address paragraph, `CADDY_IP` seed command, request flow through Cloudflare and `cloudflared`, CLAUDE.md platform, image, configuration and `107 passed` text.
- NET-03, NET-04 and success criteria 3 and 4 reworded; the checkbox lines kept their markers.

## Verification Evidence

- **Claims checker (Task 1, `docs/deployment.md`):** `checked=62 misses=0`.
- **Claims checker (Task 2, README, CONTRIBUTING, `docs/*.md`, CLAUDE.md):** `checked=1380 misses=4`; the four are the pre-existing `migration-exemptions.json` ones (CONTRIBUTING.md:68, file-map.md:166 and 167, testing.md:871); the awk step printed nothing else.
- **Link checker:** `doc-links: files=11 links=35 broken=0` (after each docs commit).
- **Counts computed by the Task 2 verify:** `harness=14 e2e/support=2 total=16`, so `docs/testing.md` says "fourteen harness tests", "sixteen `node --test` files" and "The other fourteen are the"; neither superseded count word remains.
- **TSV rows added** (`09-docs-claims-allow.tsv`, all `token<TAB>reason`): `cloudflare/cloudflared`, `cloudflare/cloudflared:2026.10.3`, `caddy:8080`, `cloudflare/`.
- **Task 3 verify** (requirement wording check): exit 0; `git show --numstat` prints `2 2` for `.planning/REQUIREMENTS.md` and `2 2` for `.planning/ROADMAP.md`.
- **Pre-commit hooks** ran on all three commits (lint-staged and the five workspace typechecks), not bypassed.

### NET-03 and NET-04 lines

| | Old | New |
| --- | --- | --- |
| NET-03 | Update `docker/Caddyfile` to trust Cloudflare proxy IP ranges and extract client IP from `CF-Connecting-IP`. | Update `docker/Caddyfile` to trust only the Compose subnet that `cloudflared` connects from and to take the client IP from `CF-Connecting-IP` alone, with no `X-Forwarded-For` fallback (D-05, D-06). |
| NET-04 | Update Content Security Policy (`connect-src wss://hestia.aberrance.app https://hestia.aberrance.app`), CORS allowed origins, and cookie security flags for `hestia.aberrance.app`. | Keep the Content Security Policy's `connect-src 'self' wss://hestia.aberrance.app` derived from `HESTIA_ORIGIN` (`'self'` covers `https://hestia.aberrance.app`), and pin with tests that no CORS or cookie surface exists to configure: the service sends no CORS headers and the app keeps its tokens in browser storage, not cookies (D-09). |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Commit subjects adapted to commitlint**
- **Found during:** all three commits (applied up front, as in 09-01 to 09-03)
- **Issue:** The plan's `docs(deploy): ...`, `docs: ...` (over 71 characters) and `docs(planning): ...` fall foul of the closed scope list (`web, service, shared, recurrence, matching, db, e2e, docker`) and the 71-character subject limit.
- **Fix:** Unscoped `docs:` subjects, listed above. Hooks were not bypassed.
- **Commits:** 68414b0, 9302f99, bea3f3e

**2. [Rule 1 - Bug] Phrase fix and allowlist rows found by the verify**
- **Found during:** Task 1 and Task 2 verify runs
- **Issue:** a line break split "port 7844" so the required-fact grep missed it; the claims checker flagged `caddy:8080` (Task 1) and `cloudflare/` (Task 2) as paths.
- **Fix:** reflowed the sentence; added both tokens to `09-docs-claims-allow.tsv` with reasons. I removed two rows I had first added (`hestia-compose` and the health command) because the checker did not need them.
- **Commits:** 68414b0, 9302f99

**Total deviations:** 2 auto-fixed (one Rule 3, one Rule 1). **Impact:** none on repository behavior.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. The plan's register (T-09-15 to T-09-19) is covered: no token value, token-shaped string or `down -v` in the docs, checklist or TSV (verify greps pass), and the GoTrue check prints only four URL variables.

## Next Phase Readiness

- 09-05 (hygiene guard and the full-suite and E2E proof) is unblocked. It owns the `check-repo-hygiene.*` rows and the hygiene bullets in `docs/testing.md`, `docs/file-map.md` and `CONTRIBUTING.md`, which this plan left untouched. Its Task 3 should confirm the E2E total against CLAUDE.md's `107 passed`.

## Reminder for the owner

Checklist steps 1-6 in `.planning/phases/09-domain-network-migration-cloudflare-tunnel-ingress/09-OWNER-CHECKLIST.md` gate the merge: the zone, the tunnel and token, the route to `http://caddy:8080`, the `.env` edit, a backup and the PR notes. Step 7 holds the first deploy's network-recreate log lines, downtime and the recovery for each failure message (`hestia-compose down`, never `-v`, then re-run the Deploy run), and step 8 is the one-time `hestia-compose up -d --wait` for GoTrue.

## Self-Check: PASSED

- Files exist: `docs/deployment.md`, `docs/file-map.md`, `docs/testing.md`, `docs/development.md`, `docs/architecture.md`, `.claude/CLAUDE.md`, `09-OWNER-CHECKLIST.md`, `09-docs-claims-allow.tsv`.
- Commits `68414b0`, `9302f99` and `bea3f3e` are ancestors of HEAD; `git rev-list --count a102c54..HEAD` before this SUMMARY commit: 3.
