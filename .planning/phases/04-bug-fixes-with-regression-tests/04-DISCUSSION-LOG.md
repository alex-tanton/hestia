# Phase 4: Bug Fixes With Regression Tests - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-20
**Phase:** 4-Bug Fixes With Regression Tests
**Areas discussed:** Offline replay duplicates (FIX-01, FIX-02), RotationEditor drag vs keyboard (FIX-04), Kong allowlist and deploy secret (FIX-06, FIX-07), Landing and red-first evidence

---

## Offline replay duplicates (FIX-01, FIX-02)

### Source of the stable id for deal add

| Option | Description | Selected |
|--------|-------------|----------|
| Hold id until success | Mint once per attempt, reuse on re-tap after an error, fresh only after success. No server change. | ✓ |
| Deterministic id per list+deal | UUIDv5 of listId+dealId; survives reload but blocks adding the same deal twice. | |
| Route through the write queue | Make deal-add offline-queueable; new capability, out of scope. | |

**User's choice:** Hold id until success (Recommended)
**Notes:** Scout finding framed the question: mutations use `retry: false` and the button is disabled offline, so the duplicate is a manual re-tap after a lost response.

### Treatment of recipe add-to-list

| Option | Description | Selected |
|--------|-------------|----------|
| Prove it, fix only the leak | Service-level replay test; keep it as the guard if already a no-op; fix only a real edge case. | ✓ |
| Add a request idempotency key | Client key plus server memory; needs a migration and contract change. | |
| Treat bought-in-between as intended | Guard only the still-on-list replay; document the bought case. | |

**User's choice:** Prove it, fix only the leak (Recommended)
**Notes:** `addMissingIngredientsToList` already skips ingredients whose normalized name is on the list as needed or in cart.

---

## RotationEditor drag vs keyboard (FIX-04)

### Drag-and-drop once the suppression goes

| Option | Description | Selected |
|--------|-------------|----------|
| Keep drag, restructure | Grip becomes a draggable button; drop handlers move to a role="presentation" wrapper in the li. | ✓ |
| Remove drag entirely | Simplest, but departs from Design › 17 and needs a spec edit. | |
| Attach drag via ref in an effect | Silences the rule without fixing semantics. | |

**User's choice:** Keep drag, restructure (Recommended)
**Notes:** Lifting the suppression confirmed the rule fires on the drag handlers on the `<li>`. The component has no test file today.

### Scope of the keyboard test

| Option | Description | Selected |
|--------|-------------|----------|
| Existing buttons, no mouse | Tab order, Enter and Space, edge buttons disabled, focus follows the member. | ✓ |
| Also arrow keys on the grip | New interaction behavior beyond the bug fix. | |

**User's choice:** Existing buttons, no mouse (Recommended)

---

## Kong allowlist and deploy secret (FIX-06, FIX-07)

### Shape of Kong enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlist browser paths | Explicit routes and methods for what supabase-js needs; refuse the rest. | ✓ |
| Denylist the dangerous paths | Keep the catch-all and terminate known-bad paths; new paths reachable by default. | |
| Mirror Caddy only | Refuse just signup and user PUT; leaves admin and the rest reachable. | |

**User's choice:** Allowlist browser paths (Recommended)
**Notes:** `hearth-service` calls GoTrue directly on `auth:9999`, never through Kong.

### How to prove the Kong fix

| Option | Description | Selected |
|--------|-------------|----------|
| Static test plus E2E | Unit test parses kong.yml for the exact route set; E2E probes and existing positive flows in PR CI. | ✓ |
| E2E probes only | Closer to real behavior but cannot run until PR CI. | |

**User's choice:** Static test plus E2E (Recommended)

### How deploy.sh hides the password

| Option | Description | Selected |
|--------|-------------|----------|
| PGPASSWORD env, scoped | Set only for the one supabase command; CLI uses pgx. | ✓ |
| Temporary PGPASSFILE | 0600 file in mktemp with a trap cleanup. | |
| Run the CLI in a container | Cleanest isolation but changes how deploys run. | |

**User's choice:** PGPASSWORD env, scoped (Recommended)
**Notes:** Planning must confirm the CLI honors PGPASSWORD; the cloud box has no Docker.

### How to test "password never on argv"

| Option | Description | Selected |
|--------|-------------|----------|
| Stub binaries, run real script | Node test with stub docker, supabase, curl, git on PATH; sentinel password; asserts argv. | ✓ |
| Extract the migrate step | Easier to test but restructures the script. | |

**User's choice:** Stub binaries, run real script (Recommended)

---

## Landing and red-first evidence

### PR grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Three PRs by risk domain | Web fixes; guard tests; infra (merged last). | ✓ |
| One PR per fix (7) | Smallest revert unit but seven CI runs and deploys. | |
| One PR for the phase | One CI run but a Kong mistake reverts everything. | |

**User's choice:** Three PRs by risk domain (Recommended)

### Proof that each test failed before the fix

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-fix run, logged in ledger | Run against unfixed source, record failing then passing output under .planning/cleanup/; Docker checks use PR CI runs. | ✓ |
| Two commits per PR, CI both | Real CI evidence but red runs on the branch and extra E2E cost. | |
| Reasoned only for lint and contract tests | Negative control is the proof for FIX-03 and FIX-05. | |

**User's choice:** Pre-fix run, logged in ledger (Recommended)

---

## Claude's Discretion

- FIX-03: how PATCH/update schemas are discovered and the exact assertion.
- FIX-05: the service-role usage audit and the lint-API negative control; whether the audit finds a real violation.
- Ledger file names, test placement, commit grouping, order within each PR.

## Deferred Ideas

- Offline-queueable deal or recipe add (new capability).
- Server-side idempotency key for add-to-list (only if a leak cannot be closed otherwise).
- Arrow-key reordering on the drag handle.
- SEC-01, CIX-01, TEST-01 (v2 requirements).
- Permanent CI checks beyond the tests added here: Phase 6.
