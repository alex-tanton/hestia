---
phase: "18"
slug: "adaptive-md3-navigation-shell-route-chrome"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-15T04:37:00Z"
---

# Phase 18 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client URL / History -> TopBar Back Link | ScreenChrome backTo paths originate from internal application route strings. Untrusted input must not control the back navigation destination. | Application route strings |
| Screen Chrome Title -> DOM <h1> | Dynamic titles supplied by screens or database entities (recipes, chores) render inside the TopBar <h1>. Untrusted text must not execute arbitrary scripts. | Display text strings |
| Household Switcher -> Active Household Selection | Switching household changes tenant context for downstream API queries. Switching must only permit valid membership IDs. | Household UUID |
| Search Parameters -> Query State | URL query string (?filter=ready) parsed by client router. Must be safely handled as a known enum/string without arbitrary code execution. | URL search parameters |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-18-01 | Spoofing | TopBar back link (backTo) | medium | mitigate | Restrict backTo to relative application paths registered via useScreenChrome, never arbitrary external URLs. | closed |
| T-18-02 | Tampering | TopBar screen title (<h1>) | high | mitigate | Render title exclusively via React text interpolation ({title}), never dangerouslySetInnerHTML. | closed |
| T-18-03 | Elevation of Privilege | HouseholdSwitcher onSelect callback | high | mitigate | HouseholdSwitcher only invokes onSelect with IDs from the authenticated user's verified households array. API RLS enforces access control on all household queries. | closed |
| T-18-04 | Input Manipulation | RecipeLibraryScreen searchParams (?filter=ready) | low | mitigate | Strictly check searchParams.get('filter') === 'ready' boolean predicate, discarding any unexpected or malformed query values. | closed |
| T-18-SC | Tampering | npm packages | high | mitigate | Zero new dependencies introduced. All imports verified against pinned packages in package.json. | closed |

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-15 | 5 | 5 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-15
