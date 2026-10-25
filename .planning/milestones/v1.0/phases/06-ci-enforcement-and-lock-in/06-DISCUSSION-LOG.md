# Phase 6: CI Enforcement and Lock-in - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-22
**Phase:** 6-CI Enforcement and Lock-in
**Areas discussed:** Gate wiring (knip, jscpd, audit), Drift and hygiene checks, Date/timezone matrix workflow, Coverage/timeouts/review/deploy proof

---

## Gate wiring: knip, jscpd, audit

| Question | Options | Selected |
|----------|---------|----------|
| Job layout | One new `hygiene` job; one job per check; fold into lint | One new `hygiene` job |
| knip modes | Default only at zero; default + production with committed baseline; both at zero with ignores | Default + production with a committed baseline |
| jscpd gate | Source-only percentage; test-inclusive percentage; clone-count cap | Test-inclusive percentage, limit 2% (free-text) |
| Audit allowance | Allowlist file with expiry; plain audit; non-blocking | Allowlist file with expiry date |

**Notes:** Owner chose a stricter knip (production mode too) and the test-inclusive jscpd figure, which departs from the roadmap's "source duplication" wording.

## Drift and hygiene checks

| Question | Options | Selected |
|----------|---------|----------|
| db:types drift | In test-integration; separate job; skip in CI | Inside test-integration |
| Migration append-only | Diff against base; hash manifest; diff plus label override | Diff against base |
| File checks | Tested Node script in hygiene; inline shell; script plus pre-commit | One tested Node script |
| Script scope | Shebang files plus *.sh; *.sh only; explicit list | Shebang files plus *.sh |

## Date/timezone matrix workflow

| Question | Options | Selected |
|----------|---------|----------|
| Home | New sweep.yml; job in ci.yml; also on PRs | New `sweep.yml` |
| Cells | 6 fixed; 6 fixed plus a "today" cell nightly; add integration sweep | Fixed 6 plus one "today" cell nightly |
| Failure handling | Red run plus logs; also tracking issue | Red run plus uploaded logs |
| Proof | workflow_dispatch plus local sweep; local only | workflow_dispatch on branch plus local sweep |

**Notes:** Rotation rule for the "today" cell was not specified; left to the planner.

## Coverage, timeouts, review, deploy proof

| Question | Options | Selected |
|----------|---------|----------|
| Web coverage | Enforce in test-unit; remove; enforce nightly only | Enforce in test-unit |
| Timeouts | Per-job sized to runs; uniform 30 min | Per-job sized to observed runs |
| Workflow review | Checklist ledger plus fixes; fix defects only | Checklist ledger in .planning/cleanup/ |
| Deploy proof | Observe real merge; static check; merge and revert | Observe the Deploy run on the real Phase 6 merge |

## Claude's Discretion

Baseline file format, script and file names, "today" cell rotation, PR split and order.

## Deferred Ideas

Integration sweep in CI, automatic Kong recreate, branch protection settings, nightly tracking issue, migration override label.
