---
phase: "19"
slug: "entry-dashboard-grocery-ecosystem-screens"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-15"
---

# Phase 19 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client State → Dashboard Cards | Untrusted data from API query hooks rendered inside dashboard preview items | Dashboard previews, list names, chores, meal titles |
| Household Data → Dashboard Cards | Unauthenticated or cross-household leakage in multi-user environments | Household metadata, member activity |
| User Input → Auth API | Untrusted credentials and tokens submitted across auth forms | Email addresses, passwords, verification codes |
| Client State → Household Creation | Unauthenticated creation or joining of household groups | Household name, invite tokens, JWT |
| User Input → Shopping List Items | Untrusted text input in item names, notes, and list titles | Item names, quantity notes, prices |
| Household State → Shopping Lists | List deletion and item mutation across household boundaries | List IDs, item IDs, household session |
| Device Camera Hardware → Web App | Video stream frames processed in browser worker or WASM engine | Camera feed frames, video tracks |
| Scanned Barcode Payload → List Writes | Numeric and alphanumeric strings parsed from physical barcodes | Barcode numbers, product codes |
| External Flipp Feed → Deal Cards | External third-party circular prices, images, and merchant URLs | Merchant names, flyer images, item thumbnails |
| Client State → Shopping List Insertions | Deal items added to household shopping lists | Deal IDs, snapshot prices, list IDs |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-19-01 | Tampering | StateBlocks.tsx | medium | mitigate | Sanitize user-provided error messages through userMessage problem utility; never render raw exception strings or unescaped HTML. | closed |
| T-19-02 | Information Disclosure | DashboardCard.tsx | medium | mitigate | Guard dashboard items behind authenticated session context and active household membership check; empty states show generic guidance without leaking household metadata. | closed |
| T-19-03 | Information Disclosure | SignInScreen.tsx / magic-link.ts | high | mitigate | Magic link tokens and verification codes are never rendered in unmasked DOM elements, logged to console, or passed in error messages; check-build.mjs ratchets exact contract strings. | closed |
| T-19-04 | Elevation of Privilege | OnboardingScreen.tsx | medium | mitigate | Enforce server-side household session checks; client UI restricts household creation and invite code joining to authenticated users with valid JWT. | closed |
| T-19-05 | Tampering | ItemSheet.tsx / ShoppingListRow.tsx | medium | mitigate | Validate item names and quantities against Zod schemas (itemNameSchema); React 19 JSX escapes strings automatically to prevent XSS. | closed |
| T-19-06 | Elevation of Privilege | ListsIndexScreen.tsx / ListDetailScreen.tsx | medium | mitigate | List IDs are validated server-side against the user's active household session; destructive list and item deletion requires explicit confirmation dialogs or persistent undo snackbars. | closed |
| T-19-07 | Information Disclosure | BarcodeScannerDialog.tsx | high | mitigate | Stop all MediaStream video tracks immediately on dialog close, route change, or tab switch; verify streamRef.current is cleared to prevent camera indicator persistence. | closed |
| T-19-08 | Tampering | BarcodeScannerDialog.tsx / detector.ts | medium | mitigate | Sanitize scanned barcode strings against UPC/EAN character formats (digits only for standard barcodes); escape item names before committing to lists. | closed |
| T-19-09 | Tampering | AddToListSheet.tsx / DealCard.tsx | medium | mitigate | Deal snapshots and prices are validated server-side during insertion; client only sends dealId and listId, preventing price tampering. | closed |
| T-19-10 | Information Disclosure | DealImage.tsx / FlyersScreen.tsx | low | mitigate | External product images use strict CSP img-src rules; flyer navigation uses sanitized internal route paths without open external redirects. | closed |
| T-19-SC | Tampering | npm dependencies | high | mitigate | Zero new dependencies introduced. Native HTML elements and existing @material/web custom elements used exclusively; check-build.mjs budget enforced. | closed |

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
| 2026-11-15 | 11 | 11 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-15
