# Phase 14: Barcode Scanning & Grocery List Integration - Context

**Gathered:** 2026-11-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Provide a responsive camera barcode scanner with manual numeric fallback within grocery lists, resolving product details via Open Food Facts (v3 API) to rapidly add new items and automatically mark existing list items as purchased (`bought`).

</domain>

<decisions>
## Implementation Decisions

### Scanner Entry Point & Viewport
- **D-01:** Dedicated button in list header toolbar — Positioned directly alongside "Add an item" in `ListDetailScreen.tsx` for immediate 1-tap access while shopping or building lists. — **Reversibility:** reversible — UI layout placement in `ListDetailScreen.tsx`.
- **D-02:** Segmented dual-mode toggle inside scanner — Provide explicit "Add to List" and "Shop & Check Off" tabs at the top of the scanner viewport, persisting the user's last selected mode in localStorage. — **Reversibility:** reversible — scanner dialog state management.
- **D-03:** Full-screen mobile dialog / sheet — Clean camera viewfinder with top navigation bar (mode toggle, close button, flashlight toggle when hardware permits) and a bottom tab for manual barcode numeric entry with a dedicated keypad. — **Reversibility:** reversible — modal styling and viewport component structure.
- **D-04:** Multi-sensory checkout confirmation with Undo — In "Shop & Check Off" mode, a detected and matched item produces a short audio chime, device vibration (`navigator.vibrate`), green reticle flash, and an interactive floating toast displaying `"[Item] marked bought"` with an `"Undo"` button, keeping the camera active for rapid subsequent scans. — **Reversibility:** reversible — toast notification and scan event handlers.

### Builder's Discretion
- **Barcode Lookup & Service Proxy:** Fastify service proxies barcode lookups to Open Food Facts API v3 using compliant `User-Agent` headers (identifying Hestia application and contact email) with caching in Postgres (`barcode_products` table) to minimize external network requests and prevent rate limits.
- **Item Matching & Disambiguation:** In "Shop & Check Off" mode, match items by barcode if recorded on `list_items`, or normalized product name comparison against unbought list items. If multiple matches or no exact match is found, present a quick pick-list or prompt to link the scanned barcode to an item.
- **Add Item Review:** In "Add to List" mode, resolving a barcode pre-populates item name and brand; open the `ItemSheet` pre-filled so the user can verify quantity and store before saving.
- **Detection Engine & WASM Polyfill:** Use native browser `BarcodeDetector` when available (Chrome Android, modern Safari); fall back to lightweight WASM/JS barcode detection (e.g. `@zxing/library` or `@undecaf/barcode-detector-polyfill`) for desktop and older browsers.
- **Debounce & Scan Pacing:** Enforce a 1.5–2.0 second debounce window after a successful barcode read before accepting the identical barcode again, preventing accidental duplicate writes while keeping the viewfinder live.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone & Phase Scope
- `.planning/ROADMAP.md` §Phase 14 — Scope, dependencies, and success criteria for Barcode Scanning & Grocery List Integration
- `.planning/REQUIREMENTS.md` §Barcode Scanning & Grocery List Management — Requirements SCAN-01, SCAN-02, SCAN-03, SCAN-04
- `.planning/phases/12-store-deal-image-delivery/12-CONTEXT.md` — Image origins and CSP rules for Open Food Facts

### Web UI & List Components
- `apps/web/src/screens/lists/ListDetailScreen.tsx` — Shopping list screen, header toolbar, item status mutation, and bought panel
- `apps/web/src/components/lists/ItemSheet.tsx` — Item creation/edit bottom sheet and store selection
- `apps/web/src/components/lists/ShoppingListRow.tsx` — Row presentation, strikethrough, and `onToggleBought` callback
- `apps/web/src/components/ui/Toast.tsx` — Floating toast notification system with action buttons
- `apps/web/src/lib/api/list-hooks.ts` — React Query mutations for adding, updating, and toggling items
- `apps/web/src/lib/offline/use-write-queue.ts` — Offline write queue and replay mechanism

### Backend Service & Storage
- `apps/service/src/routes/lists.ts` — Fastify routes for shopping lists and items
- `apps/service/src/services/lists.ts` — Service layer managing list items and status transitions
- `packages/shared/src/api/lists.ts` — Shared Zod schemas and TypeScript types for `ListItem`, `ListItemStatus`, and item requests

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/ui/Toast.tsx`: `useToast` hook for success and undo feedback.
- `apps/web/src/components/ui/Button.tsx`: Button component for list toolbar and dialog triggers.
- `apps/web/src/components/lists/ItemSheet.tsx`: Existing form schema for item name, quantity, price, and store assignment.
- `apps/web/src/lib/api/problem.ts`: Standard problem details handling for API responses.

### Established Patterns
- Optimistic mutations with rollback in `list-hooks.ts`.
- Offline write queue (`usePendingListWrites`) supporting offline item check-off and addition.
- Fastify route registration with Zod schemas and Postgres RLS transactions.

### Integration Points
- `apps/web/src/screens/lists/ListDetailScreen.tsx`: Add barcode scanner trigger button in list header toolbar.
- `apps/service/src/routes/barcodes.ts` (or `lists.ts`): Barcode lookup proxy endpoint to Open Food Facts v3 API.
- Database migration: Append-only migration to add `barcode_products` cache table and optional `barcode` column to `list_items`.

</code_context>

<specifics>
## Specific Ideas

- Scanner dialog features a clean reticle with rounded corners and an animated scanning laser line when active.
- Mode toggle switches between "Add to List" and "Shop & Check Off" seamlessly without reinitializing camera feed.
- Audio feedback uses a lightweight Web Audio API synth beep (short 800Hz / 1200Hz sine burst) so no external audio asset download is needed.
- Haptic feedback uses `navigator.vibrate([40])` wrapped in capability check.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-Barcode Scanning & Grocery List Integration*
*Context gathered: 2026-11-09*

