---
phase: "20"
slug: "meals-bills-chores-settings-screens"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-15"
---

# Phase 20 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| User Input → Recipe Management | Client-side recipe creation and editing with title, ingredient notes, and import URL inputs | Recipe titles, ingredients, notes, import URLs |
| User Input → Meal Planner | Meal placement and scheduling across household weekly calendar | Meal IDs, date strings, meal slot keys |
| User Input → Bill Management & Payments | Bill amount, due date, category, and payment record creation/editing | Dollar amounts, payment timestamps, bill metadata |
| User Input → Chore Management & Rotations | Chore title, frequency, due date, assignment, and rotation turn order editing | Chore descriptions, cadence, member rotation IDs |
| Offline Mutation Queue → Server Sync | Offline write queue storing and replaying mutations upon network reconnection | Optimistic mutation payloads, idempotency keys, JWT |
| User Action → Household Settings | Destructive household departure or household deletion operations | Household IDs, confirmation verification strings |
| System Diagnostics → Diagnostics UI | System health telemetry, latency metrics, and service status inspection | Health status booleans, ping latencies, build hashes |
| Browser Push API → Push Service | Browser push notification permission subscription tokens and preferences | Push subscription endpoints, auth keys, topic toggles |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-20-01 | Tampering | RecipeForm & MealPlacementSheet | medium | mitigate | Sanitize and escape all user text values through React JSX text node bindings and enforce Zod schema validation prior to mutation. | closed |
| T-20-02 | Tampering | RecipeForm URL Import | low | mitigate | Validate imported URL strings strictly against http: and https: protocols before dispatching to scrape/import endpoints. | closed |
| T-20-03 | Elevation of Privilege | BillRow & PaymentHistory | medium | mitigate | Ensure bill mutation handlers require authenticated session context and reject cross-household entity modifications on backend. | closed |
| T-20-04 | Tampering | BillForm & PaymentEditSheet | low | mitigate | Enforce strict positive integer cents validation in form state before dispatching payment or bill mutations. | closed |
| T-20-05 | Spoofing | ChoreListRow & OfflineQueue | medium | mitigate | Ensure offline write queue binds mutations to authenticated household membership session and validates idempotent mutation IDs on replay. | closed |
| T-20-06 | Tampering | RotationEditor & ChoreFormScreen | low | mitigate | Validate rotation member arrays for unique member IDs and positive integer indices prior to dispatching chore update mutation. | closed |
| T-20-07 | Repudiation | DepartureScreen & ConfirmDialog | high | mitigate | Enforce error-styled destructive ConfirmDialog requiring explicit confirmation or typed household name verification before issuing departure or deletion API requests. | closed |
| T-20-08 | Information Disclosure | SystemHealthScreen | low | mitigate | Ensure system health telemetry presents only sanitized boolean statuses, latency stats, and public version metadata without exposing connection strings, auth tokens, or internal IP addresses. | closed |
| T-20-09 | Elevation of Privilege | NotificationTypes & PushService | medium | mitigate | Validate browser-generated PushSubscription object against standard schema before sending subscription token to backend endpoints. | closed |
| T-20-SC | Tampering | npm/lit dependencies | high | mitigate | Package legitimacy audit verified; only in-repo and verified @material/web 2.5.0 and @lit/react 1.0.8 packages utilized. | closed |

*Status: closed*
*Severity: critical > high > medium > low*
*Disposition: mitigate*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-15 | 10 | 10 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-15
