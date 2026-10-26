---
status: complete
phase: 06-ci-enforcement-and-lock-in
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md, 06-05-SUMMARY.md, 06-06-SUMMARY.md, 06-07-SUMMARY.md, 06-08-SUMMARY.md, 06-09-SUMMARY.md, 06-10-SUMMARY.md, 06-11-SUMMARY.md, 06-12-SUMMARY.md, 06-13-SUMMARY.md, 06-14-SUMMARY.md, 06-15-SUMMARY.md, 06-16-SUMMARY.md]
started: 2026-10-24T13:24:16Z
updated: 2026-10-25T05:25:00Z
---

## Current Test

[testing complete]


## Tests

### 1. Whether the gates behave as the owner wants on CI (day-dependent behavior, wording of fail
expected: Whether the gates behave as the owner wants on CI (day-dependent behavior, wording of failures) is judged when PR 2 wires them into workflows
result: pass

### 2. Whether the day-dependent audit gate (a new advisory turns CI red and holds back deploys) 
expected: Whether the day-dependent audit gate (a new advisory turns CI red and holds back deploys) is the behavior the owner wants, and when to merge the fix branch
result: pass

### 3. Whether the deploy gate's fail-open choices (unknown, diverged or uncomparable running rev
expected: Whether the deploy gate's fail-open choices (unknown, diverged or uncomparable running revision deploys) and its re-run redeploy match the owner's appetite on the production box
result: pass
note: "Resolved by G-06-3 (PR #44, commit ddd69fd). Equal-to-HEAD CI push run outputs deploy=false; manual re-run of Deploy workflow run deliberately redeploys (OD-7). Approved by owner in UAT re-test 2026-10-25."

### 4. audit-prod.mjs is green on the real dependency tree of ci/gate-scripts
expected: audit-prod.mjs is green on the real dependency tree of ci/gate-scripts
result: pass

### 5. main's CI on the dependency fixes has the gates running; hygiene (all six steps) is green
expected: main's CI on the dependency fixes has the gates running; hygiene (all six steps) is green
result: pass
note: "Resolved by G-06-5 (PR #45, commit c5b74e4). Root causes of all 5 flaky specs (F-01..F-05) identified and resolved without retries or weakened assertions; proved by 6 consecutive cloud CI passes (Run 40153943310, attempts 1-6), 30/30 local stress runs, and 36/36 local sweep on main. CI-08 locked in. Approved by owner in UAT re-test 2026-10-25."

### 6. CI still triggers Deploy and the guard accepts a green run
expected: CI still triggers Deploy and the guard accepts a green run
result: pass
note: Deploy runner not provisioned yet; owner will set up the deployment machine as a next task.

### 7. After PR 3's squash merge, CI concludes success and a Deploy workflow_run exists for the s
expected: After PR 3's squash merge, CI concludes success and a Deploy workflow_run exists for the same SHA
result: pass
note: Deploy runner not provisioned yet; owner will set up the deployment machine as a next task.

### 8. knip config gives 0 default findings and production findings byte-equal to the 28-row Phas
expected: knip config gives 0 default findings and production findings byte-equal to the 28-row Phase 3 summary; a planted dead file fails both modes and the apps/web/src/test blind spot is closed
result: pass
source: automated
coverage_id: 06-01 D1

### 9. Repository hygiene gate (tracked-ignored, script modes, index line endings), clean on the 
expected: Repository hygiene gate (tracked-ignored, script modes, index line endings), clean on the real tree and failing on the pre-fix tree with exactly the three .planning scripts
result: pass
source: automated
coverage_id: 06-01 D2

### 10. Migration append-only gate with a validated --base
expected: Migration append-only gate with a validated --base
result: pass
source: automated
coverage_id: 06-01 D3

### 11. The audit gate fails closed on a registry outage, honors and expires allowances (braces ad
expected: The audit gate fails closed on a registry outage, honors and expires allowances (braces advisory as the fixture), and the shipped allowlist is empty
result: pass
source: automated
coverage_id: 06-02 D1

### 12. The duplication gate at 2% with a deterministic test-inclusive figure of 1.11%, proven to 
expected: The duplication gate at 2% with a deterministic test-inclusive figure of 1.11%, proven to fail above its limit
result: pass
source: automated
coverage_id: 06-02 D2

### 13. The sweep adds a real-date today cell with a zone that rotates by UTC day, prints now= and
expected: The sweep adds a real-date today cell with a zone that rotates by UTC day, prints now= and tz= for reproduction, and leaves the matrix and output unchanged without the flag
result: pass
source: automated
coverage_id: 06-03 D1

### 14. The deploy gate skips a commit older than the running revision and a docs/ and .planning/ 
expected: The deploy gate skips a commit older than the running revision and a docs/ and .planning/ only change, deploys everything else, and refuses a hostile HEARTH_DEPLOY_SHA before a shell sees it
result: pass
source: automated
coverage_id: 06-03 D2

### 15. docs/testing.md and docs/file-map.md match the tree PR 1 delivers and claim no CI wiring t
expected: docs/testing.md and docs/file-map.md match the tree PR 1 delivers and claim no CI wiring that only PR 2 adds
result: pass
source: automated
coverage_id: 06-04 D1

### 16. Every local gate is green on the final head of ci/gate-scripts
expected: Every local gate is green on the final head of ci/gate-scripts
result: pass
source: automated
coverage_id: 06-04 D2

### 17. PR 1 opened at the proven head with the six CI jobs green and the thirteen harness files r
expected: PR 1 opened at the proven head with the six CI jobs green and the thirteen harness files run on CI
result: pass
source: automated
coverage_id: 06-05 D1

### 18. PR 1 merged by the owner; main's CI on the squash commit is green; Deploy run recorded; WB
expected: PR 1 merged by the owner; main's CI on the squash commit is green; Deploy run recorded; WB synced
result: pass
source: automated
coverage_id: 06-05 D2

### 19. ci.yml keeps the name CI and its six job ids and gains a hygiene job whose six steps run f
expected: ci.yml keeps the name CI and its six job ids and gains a hygiene job whose six steps run from the YAML
result: pass
source: automated
coverage_id: 06-06 D1

### 20. Web coverage thresholds and the db:types drift step rest on local measurements
expected: Web coverage thresholds and the db:types drift step rest on local measurements
result: pass
source: automated
coverage_id: 06-06 D2

### 21. sweep.yml and deploy.yml are complete and the deploy gate wiring was smoke-tested
expected: sweep.yml and deploy.yml are complete and the deploy gate wiring was smoke-tested
result: pass
source: automated
coverage_id: 06-06 D3

### 22. The four doc files state what PR 2 makes true and no stale sentence remains
expected: The four doc files state what PR 2 makes true and no stale sentence remains
result: pass
source: automated
coverage_id: 06-07 D1

### 23. CI-05 review covers three workflows and the setup action, with 21 dispositions
expected: CI-05 review covers three workflows and the setup action, with 21 dispositions
result: pass
source: automated
coverage_id: 06-07 D2

### 24. ci/enforce-gates reached origin at the proven tree
expected: ci/enforce-gates reached origin at the proven tree
result: pass
source: automated
coverage_id: 06-07 D3

### 25. PR 2 is open with the deploy-behavior changes flagged and all seven jobs green on the push
expected: PR 2 is open with the deploy-behavior changes flagged and all seven jobs green on the pushed head
result: pass
source: automated
coverage_id: 06-08 D1

### 26. The new gates pass on the runner: six hygiene steps, db:types drift, web coverage threshol
expected: The new gates pass on the runner: six hygiene steps, db:types drift, web coverage thresholds
result: pass
source: automated
coverage_id: 06-08 D2

### 27. Every gate fails on the problem it exists to catch (ROADMAP success criteria 1 and 2)
expected: Every gate fails on the problem it exists to catch (ROADMAP success criteria 1 and 2)
result: pass
source: automated
coverage_id: 06-08 D3

### 28. PR 2 merged and the canary closed by the owner
expected: PR 2 merged and the canary closed by the owner
result: pass
source: automated
coverage_id: 06-08 D4

### 29. Sweep's first push run passed the date and time-zone matrix on main
expected: Sweep's first push run passed the date and time-zone matrix on main
result: pass
source: automated
coverage_id: 06-09 D2

### 30. PR 3 carries the landing rules, CLAUDE.md and maps that match the gates; no stale claims; 
expected: PR 3 carries the landing rules, CLAUDE.md and maps that match the gates; no stale claims; all seven jobs green
result: pass
source: automated
coverage_id: 06-09 D4

### 31. Sweep passes on the merge push, by hand with the today cell, and on its first scheduled ru
expected: Sweep passes on the merge push, by hand with the today cell, and on its first scheduled run
result: pass
source: automated
coverage_id: 06-10 D2

### 32. Requirements CI-01 to CI-07 and TIME-06 are complete with the CI-02 and CI-04 wording note
expected: Requirements CI-01 to CI-07 and TIME-06 are complete with the CI-02 and CI-04 wording notes, and the ledger maps the five ROADMAP criteria to evidence
result: pass
source: automated
coverage_id: 06-10 D3

## Summary

total: 32
passed: 32
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-06-3
  truth: "The deploy gate does not redeploy a commit that is already running"
  status: resolved
  reason: "User reported: The deploy gate should not redeploy the same commit, but I still don't understand why that would happen."
  severity: major
  test: 3
  root_cause: "scripts/deploy-gate.sh deliberately prints deploy=true when HEAD equals the running revision ('a re-run; deploying again'), kept from the old behavior where a re-run of a CI run always redeployed. Every green CI run on main triggers Deploy, so re-running a CI run (for example after a flaky test) redeploys the commit that is already running."
  artifacts:
    - path: "scripts/deploy-gate.sh"
      issue: "equal-to-HEAD branch decides deploy=true"
    - path: "scripts/deploy-gate.test.mjs"
      issue: "test cases assert the re-run redeploys"
    - path: "docs/deploy.md"
      issue: "documents that a re-run of the running commit redeploys"
  missing:
    - "Decide equal-to-HEAD as deploy=false with its own test, and keep an explicit way to force a redeploy (for example a manual dispatch or a failed-deploy retry path)"
  resolution: "PR #44 merged as ddd69fd; deploy gate outputs deploy=false when commit equals running revision; Deploy re-run retains intentional redeployment path. Confirmed passed by owner 2026-10-25."
  debug_session: ""

- gap_id: G-06-5
  truth: "CI is reliable: no test in CI fails intermittently"
  status: resolved
  reason: "User reported: before considering the CI milestone complete, all flakiness in tests must be resolved; review all flaky tests in CI history and fix them so CI can be reliable again."
  severity: blocker
  test: 5
  root_cause: "Five flaky specs identified across CI history (F-01..F-05) in notification and accessibility suites caused by a product query race on active household switch and DOM timing/event wait races."
  artifacts:
    - path: "apps/web/src/hooks/useHouseholdSwitch.ts"
      issue: "queries not cancelled on switch"
    - path: "e2e/tests/17-accessibility-states.spec.ts"
      issue: "timing race with focus/aria states"
    - path: "e2e/tests/19-notifications.spec.ts"
      issue: "badge update timing race"
  missing:
    - "Inventory every flaky test failure in CI history (this phase saw 17-accessibility-states:497 and :526 and 19-notifications:140 across PR 2, PR 43 and main, plus earlier history), find root causes, fix them, and prove the fixes with repeated runs"
  resolution: "PR #45 merged as c5b74e4; 6 consecutive all-green cloud CI runs on head 2211010; 30/30 local stress passes; CI-08 locked in. Confirmed passed by owner 2026-10-25."
  debug_session: ""
