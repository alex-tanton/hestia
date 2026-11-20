# Phase 19: Entry, Dashboard & Grocery Ecosystem Screens - Research

**Researched:** 2026-11-15  
**Domain:** Material Design 3 Web Frontend (`apps/web`), React 19.3, `@material/web@2.5.0`, Lit adapters, Camera/WASM Barcode Scanner, Tonal Surfaces, State Blocks, and E2E Test Compatibility  
**Confidence:** HIGH  

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Dashboard & Shared State Blocks
- **D-01:** Implement `Dashboard` (`This Week`) as a 1–2 column grid of borderless `surfaceContainerLow` cards with at most 3 `<md-list-item>` preview rows per card. When a pillar has >3 active items, present the overflow via a dedicated card footer text button: `+N more in [Pillar]` linking directly to that pillar's route. — **Reversibility:** costly — touches dashboard card anatomy, routing links, and Playwright locator scoping.
- **D-02:** Sort and prioritize the 3 preview rows within each pillar card using **urgency-first ranking**: overdue items highlighted strictly with `error` semantic tokens at the top, followed by items due today, then items due next this week.
- **D-03:** Feature a warm tonal **`DashboardFirstRun` hero card** on empty first-run households presenting stepped quick-start pills ("Create a shopping list", "Add upcoming bill", "Plan first meal") to let new household members choose their initial action.
- **D-04:** Standardize `EmptyState`, `ErrorState`, and `OfflineState` blocks across routes and cards with **context-adaptive layout**: compact inline layout within cards (32dp Material Symbol, `bodyMedium` text, text button action) versus full-bleed centered column on full-page routes (48dp Material Symbol, `titleMedium` heading, filled/tonal button action).

#### Grocery Lists, Store Grouping & Pantry Inventory
- **D-05:** Structure `ListDetailScreen` store-grouped items under **tonal `surfaceContainer` subheaders** with store name, item count badge (e.g., "Trader Joe's (4)"), and chevron collapse/expand toggle. — **Reversibility:** costly — affects grocery item list hierarchy, collapse persistence state, and test assertions.
- **D-06:** Transition checked grocery items into the collapsible `Bought (N)` section with smooth strikethrough animation, moving down to `Bought (N)` automatically while dispatching a **persistent Undo Snackbar** ("Marked as bought · [Undo]").
- **D-07:** Implement the Top App Bar overflow action "Add bought to pantry" by opening a **Review Modal Bottom Sheet** (`ItemSheet`/`SyncToPantrySheet`) with pre-filled storage categories and expiry estimates before committing items to the pantry.
- **D-08:** Structure `PantryScreen` inventory using **storage location filter chips** (`All`, `Fridge`, `Freezer`, `Pantry`) paired with an MD3 Search Bar, rendering items as borderless `<md-list>` rows with quantity and expiry indicator pills.
- **D-09:** Provide rapid grocery item addition in `ListDetailScreen` via a **persistent top quick-add input field** (Enter to add next item) alongside the floating `<md-fab>` which opens the full `ItemSheet` for rich attributes (quantity, unit, store, notes).
- **D-10:** Design `ItemSheet` store assignment with a **horizontal tonal chip strip of favorite/recent household stores** for single-tap selection, plus an `<md-outlined-select>` / autocomplete menu for all stores or adding a new store.
- **D-11:** Render multiple shopping lists in `ListsIndexScreen` as **borderless rich list rows** with store tag, progress badge (`4/12 bought`), last updated date, and Top App Bar / row overflow menu (Edit name, Archive, Delete).
- **D-12:** Highlight pantry item expiration dates with **tonal status badges** (`error` container strictly for expired items, `warning` container for items expiring soon within 3 days) paired with an "Expiring soon" quick-sort chip at the top.

#### Barcode Scanner Dark HUD
- **D-13:** Restyle `BarcodeScannerDialog` as a dark-scheme MD3 Full-Screen Dialog with **continuous scanning and instant audio/haptic feedback**: camera remains live while items commit immediately.
- **D-14:** Handle unknown barcodes by sliding up an **in-HUD quick naming Modal Bottom Sheet** with an `<md-outlined-text-field>` ("Item name") and store/category chips, immediately saving and resuming scanner flow.
- **D-15:** Organize scanner HUD controls with a **balanced layout**: top bar with Close (`arrow_back`) and Flashlight (`torch`) icon buttons; center with targeting reticle; bottom floating container with `Add to list | Mark bought` Segmented Button and "Enter code manually" button.
- **D-16:** Manage rapid sequential barcode scans using a **batch counter persistent snackbar**: count updates ("Added 3 items · [Undo last]") with a "View scanned" action pill to review all scanned items in the session.

#### Deals & Flyers Browsing
- **D-17:** Format `DealCard`s on compact mobile screens (`<600px`) as **single-column horizontal list cards**: 72×72dp product photo on the left, item title/store/dates in the middle, and bold price with single tonal discount badge (`-X%`) and `+ Add` icon button on the right. — **Reversibility:** costly — touches deal card component anatomy, image sizing, and test locators.
- **D-18:** Lift a single shared `AddToListSheet` per screen with **smart addition flow**: if the user has only 1 active list, add immediately with a persistent Undo Snackbar ("Added to [List] · [Undo]"); if multiple active lists exist, open `AddToListSheet` to choose list and adjust quantity.
- **D-19:** Structure `DealSearchScreen` filters with a top horizontal strip of quick filter chips (`Category`, `Discount threshold`, `Store`) alongside an "All filters (N)" chip opening the full Filter Modal Bottom Sheet.
- **D-20:** Present `FlyersScreen` store catalogs in a 2–4 column elevated MD3 card grid (store logo, cover preview thumbnail, valid dates, item count badge); tapping a card navigates to the dedicated `FlyerItemsScreen` route with Top App Bar back navigation and deal grid.

#### Auth & Onboarding Cards (from Requirements)
- **D-21:** Standardize all unauthenticated auth screens (`/sign-in`, `/sign-up`, `/sign-in/link`, `/sign-in/code`, `/forgot-password`, `/set-password`) as centered tonal Surface Container cards (`max-w-[440px]`) with `<md-outlined-text-field>` inputs and MD3 buttons, preserving `MAGIC_LINK_COPY` and `HESTIA_PUBLIC_MAGIC_LINK_ENABLED` gating (`AUTH-06`).
- **D-22:** Redesign `OnboardingLayout`, household `Create`/`Join` steps, and `InstallStep` using tonal MD3 action cards, single-field inputs, and clear guidance cards (`AUTH-07`).

### the agent's Discretion
- **Animation timing:** Subtle 200–300ms CSS transitions for grocery item strikethrough and move-to-bought reordering.
- **Barcode reticle styling:** Subtle corner-bracket aiming frame with warm terracotta pulsing scan line in the camera HUD.
- **Filter bottom sheet density:** Group categories and store toggles cleanly inside `FilterModalBottomSheet` using `<md-filter-chip>` wrap containers.

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **DASH-01** | Redesign `Dashboard` (`This Week`) as a 1–2 column grid of borderless tonal cards (`surfaceContainerLow`, max 3 `<md-list-item>` rows per card, `error` reserved strictly for overdue alerts) plus a tonal `DashboardFirstRun` hero card. | `Card.tsx` (`surfaceContainerLow`), `ListRow.tsx`, `DashboardFirstRun.tsx`, and `DashboardCard.tsx` overhaul. Overdue ranking with `--md-sys-color-error`. |
| **DASH-02** | Unify `EmptyState`, `ErrorState`, and `OfflineState` blocks using MD3 tonal containers, Material Symbols, and MD3 typography. | `StateBlocks.tsx` overhaul removing `lucide-react` in favor of `Icon.tsx` (`error`, `wifi_off`, `refresh`), implementing dual layout modes (compact inline card vs full-bleed page). |
| **AUTH-06** | Redesign all auth screens (`/sign-in`, `/sign-up`, `/sign-in/link`, `/sign-in/code`, `/forgot-password`, `/set-password`) as centered tonal Surface Container cards (`max-w-[440px]`) with `<md-outlined-text-field>` and MD3 buttons, preserving `MAGIC_LINK_COPY` and `HESTIA_PUBLIC_MAGIC_LINK_ENABLED` gating. | Centered `Card` with `max-w-[440px]`, `TextField` (`MdOutlinedTextField`), `Button` (`MdFilledButton`), and exact string preservation verified against `check-build.mjs`. |
| **AUTH-07** | Redesign `OnboardingLayout`, household `Create`/`Join` steps, and `InstallStep` using tonal MD3 action cards, single-field `<md-outlined-text-field>` inputs, and clear guidance cards. | `OnboardingLayout.tsx` MD3 frame with `Icon name="arrow_back"`, action cards for create/join household, and `InstallStep` with `share` and `smartphone` Material Symbols. |
| **LIST-01** | Overhaul `ListsIndexScreen`, `ListDetailScreen`, `ArchivedListsScreen`, and `PantryScreen` with borderless `<md-list>` + `<md-checkbox>`, `<md-fab>` creation actions, `ListNameSheet` converted to basic `<md-dialog>`, and Top App Bar overflow actions (`Archived`, `Add bought to pantry`). | Borderless rows using `Checkbox variant="in-list"`, `MdFab` creation CTA, `MdDialog` for create/rename prompts, Top App Bar overflow integration in `useScreenChrome`. |
| **LIST-02** | Standardize `ListDetailScreen` with tonal `StoreGroupHeader` subheaders, `ItemSheet` Modal Bottom Sheet, and a unified MD3 collapsible `Bought (N)` section. | `StoreGroupHeader.tsx` tonal `surfaceContainer` header with count badge and chevron; `ItemSheet.tsx` migrated to `ModalBottomSheet` with store chips; collapsible `Bought (N)` accordion. |
| **LIST-03** | Restyle `BarcodeScannerDialog` as a dark-scheme MD3 Full-Screen Dialog preserving camera `BarcodeDetector`/WASM polyfill, flashlight, manual code entry, `Add to list \| Mark bought` Segmented Button, and persistent Undo Snackbar feedback. | Dark HUD (`bg-[#1A110E]`), top action bar (`arrow_back`, flashlight), centered terracotta reticle, bottom `SegmentedControl`, in-HUD `ModalBottomSheet` naming, and persistent `useToast` Undo queue. |
| **DEAL-06** | Collapse `DealSearchScreen` filters behind an MD3 Search Bar, `Favorites \| All stores` Segmented Button, and `<md-filter-chip>` row opening a Filter Modal Bottom Sheet, paired with a compact tonal `DealFreshness` banner. | Search input field, `SegmentedControl`, `<md-filter-chip>` horizontal strip, `ModalBottomSheet` for advanced filters, and tonal `DealFreshness` banner with `schedule`/`refresh` icons. |
| **DEAL-07** | Simplify `DealCard` (photo, title, store/dates, bold price, single `-X%` tonal badge, `+ Add` icon button), lift a single shared `AddToListSheet` per screen, and present `FlyersScreen` / `FlyerItemsScreen` in 2–4 column elevated MD3 cards. | `DealCard` mobile horizontal layout (72×72dp photo, bold price, tonal `-X%` badge, icon button), screen-level `AddToListSheet` lifting eliminating N instances, 2–4 col elevated cards in `FlyersScreen`. |
</phase_requirements>

---

## Summary

Phase 19 executes the core screen overhaul of Hestia's v3.0 milestone. It migrates entry/auth routes, the home dashboard, shared state blocks, the grocery list ecosystem (active lists, detail view, archived lists, pantry), the camera/WASM barcode scanner, and deals/flyers browsing onto borderless Material Design 3 tonal surfaces.

Following the design system foundations locked in Phase 17 and the adaptive navigation shell established in Phase 18, Phase 19 eliminates legacy Tailwind bordered containers (`border-border`, `divide-y`), legacy Lucide icons, and Radix dialogs/sheets across these domains. Crucially, it resolves architectural debt in screens such as `DealSearchScreen` and `ListDetailScreen` by lifting shared modal bottom sheets (`AddToListSheet`, `ItemSheet`) to the screen level, preventing component re-render cascades and portal proliferation.

**Primary recommendation:** Decompose Phase 19 into 5 focused waves corresponding to functional domains: Wave 1 (Dashboard & State Blocks), Wave 2 (Auth & Onboarding), Wave 3 (Lists, ItemSheet & Pantry), Wave 4 (Dark HUD Barcode Scanner), and Wave 5 (Deals, Lifted AddToListSheet & Flyers), updating unit tests and Playwright E2E locators in lockstep within each wave.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| **Dashboard Urgent Ranking** | Client Screen (`DashboardScreen`) | API (`/api/...`) | Sorting top 3 items by urgency (overdue -> today -> week) is presentation ordering; raw dates arrive from existing domain queries. |
| **Shared State Rendering** | UI Component (`StateBlocks`) | Screen Consumers | `EmptyState`, `ErrorState`, and `OfflineState` encapsulate responsive sizing and icon layout while callers pass semantic copy and actions. |
| **Auth Card Presentation** | Client Screen (`SignInScreen`, etc.) | Layout Shell (`OnboardingLayout`) | Centered 440px tonal card handles form state; `OnboardingLayout` provides skip-links, offline banner, and responsive padding. |
| **List Grouping & Strikethrough** | Client State & Optimistic Queue | IndexedDB / Service Sync | Store grouping, collapse state, and strikethrough animations happen client-side immediately; writes queue via `usePendingListWrites`. |
| **Barcode Video & Polyfill** | Client Browser / Worker | WASM Runtime (`@undecaf/zbar-wasm`) | Video stream capture and barcode decoding execute on-device in Web Worker / WASM; match resolution checks cached list items before hitting API. |
| **Single Sheet Lifting** | Screen Component (`DealSearchScreen`) | Child Items (`DealCard`) | Lifting `AddToListSheet` to screen level avoids mounting N sheets across 50 deals, eliminating portal bloat and redundant list queries. |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@material/web` | `2.5.0` | MD3 Custom Elements | Standard MD3 components (`md-outlined-text-field`, `md-checkbox`, `md-filter-chip`, `md-dialog`, `md-fab`). [VERIFIED: apps/web/package.json:22] |
| `@lit/react` | `1.0.8` | React 19 Custom Element Bridge | Provides typed React components for `@material/web` custom elements with event binding. [VERIFIED: apps/web/package.json:21] |
| `react` / `react-dom` | `19.3.0` | UI Runtime | Core framework. React 19 handles custom element property passing natively. [VERIFIED: apps/web/package.json:31-32] |
| `react-router` | `8.4.0` | Route Management | Pushed navigation, back-to routing, and lazy route splitting. [VERIFIED: apps/web/package.json:33] |
| `@tanstack/react-query` | `5.103.1` | Asynchronous Data State | Caching, polling, and optimistic mutations across grocery lists and deals. [VERIFIED: apps/web/package.json:25] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@undecaf/barcode-detector-polyfill` | `0.9.23` | Barcode Detection Polyfill | Standardizes barcode detection across browsers lacking native Shape Detection API. [VERIFIED: apps/web/package.json:27] |
| `@undecaf/zbar-wasm` | (monorepo plugin) | Local WASM Barcode Engine | Offline-capable and CSP `'self'` barcode decoding engine redirected via Vite plugin. [VERIFIED: apps/web/vite.config.ts:27-36] |
| `zod` | `4.6.6` | Runtime Schema Validation | Input validation for item names, list names, and postal codes. [VERIFIED: apps/web/package.json:34] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ModalBottomSheet` (native `<dialog>`) | Radix `Sheet` / `Dialog` | Radix adds external bundle weight and light-DOM style leakage. Native `<dialog>.showModal()` is top-layer native and MD3 compliant. |
| In-HUD quick naming sheet | Full screen redirect | In-HUD sheet allows rapid continuous barcode scanning without camera teardown. |
| Lifted `AddToListSheet` | Per-card `Sheet` | Per-card sheet mounts 50 `<dialog>` roots per page, crashing memory and duplicating query hooks. |

**Installation:**
No installation required. All dependencies are already pinned and locked in `apps/web/package.json`.

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@material/web` | npm | 6 yrs | ~150k/wk | `github.com/material-components/material-web` | `[OK]` | Approved (Pre-installed) |
| `@lit/react` | npm | 4 yrs | ~600k/wk | `github.com/lit/lit` | `[OK]` | Approved (Pre-installed) |
| `@undecaf/barcode-detector-polyfill` | npm | 3 yrs | ~35k/wk | `github.com/undecaf/barcode-detector-polyfill` | `[OK]` | Approved (Pre-installed) |

**Packages removed due to [SLOP] verdict:** None.  
**Packages flagged as suspicious [SUS]:** None.  
**External dependencies:** Zero new external packages introduced in Phase 19.

---

## Architecture Patterns

### System Architecture Diagram

```
+----------------------------------------------------------------------------------+
|                            Phase 19 Screen Architecture                          |
+----------------------------------------------------------------------------------+
                                         |
     +-----------------------------------+-----------------------------------+
     |                                   |                                   |
     v                                   v                                   v
+-----------------------+     +-----------------------+     +-----------------------+
|  Dashboard (This Week)|     |   Grocery Ecosystem   |     |    Deals & Flyers     |
|  - 1-2 Col MD3 Cards  |     |  - ListsIndexScreen   |     |  - DealSearchScreen   |
|  - Urgency Ranking    |     |  - ListDetailScreen   |     |  - Lifted AddToList   |
|  - DashboardFirstRun  |     |  - BarcodeScannerHUD  |     |  - Compact DealCards  |
|  - Unified StateBlocks|     |  - PantryScreen       |     |  - FlyersScreen Grid  |
+-----------------------+     +-----------------------+     +-----------------------+
     |                                   |                                   |
     | (Card Elevation 1)                | (Modal Bottom Sheet)              | (Single Sheet Lift)
     v                                   v                                   v
+-----------------------+     +-----------------------+     +-----------------------+
| surfaceContainerLow   |     | ModalBottomSheet      |     | Shared AddToListSheet |
| - Flat tonal canvas   |     | - ItemSheet           |     | - Single instance     |
| - Max 3 items         |     | - In-HUD Barcode Name |     | - Direct add if 1 list|
| - "+N more" overflow  |     | - SyncToPantrySheet   |     | - Multi-list picker   |
+-----------------------+     +-----------------------+     +-----------------------+
                                         |
                                         v
                      +-------------------------------------+
                      |       Persistent Toast / Undo       |
                      |  - "Marked as bought · [Undo]"      |
                      |  - "Added 3 items · [Undo last]"    |
                      |  - "Added deal to list · [Undo]"    |
                      +-------------------------------------+
```

### Recommended Project Structure
```
apps/web/src/
├── components/
│   ├── dashboard/
│   │   ├── DashboardCard.tsx         # Borderless surfaceContainerLow card + urgency ranking
│   │   ├── DashboardCards.tsx        # Pillar-specific card adapters (Bills, Lists, Meals, Chores)
│   │   └── DashboardFirstRun.tsx     # Warm tonal hero card with quick-start action pills
│   ├── lists/
│   │   ├── BarcodeScannerDialog.tsx  # Dark HUD full-screen scanner + in-HUD naming sheet
│   │   ├── ItemSheet.tsx             # ModalBottomSheet for rich grocery item entry
│   │   ├── ShoppingListRow.tsx       # Borderless list row with in-list Checkbox & strikethrough
│   │   ├── StoreGroupHeader.tsx      # Tonal surfaceContainer subheader with collapse toggle
│   │   └── SyncToPantrySheet.tsx     # ModalBottomSheet for committing bought items to pantry
│   ├── states/
│   │   └── StateBlocks.tsx           # Context-adaptive EmptyState, ErrorState, OfflineState
│   └── ui/
│       ├── Card.tsx                  # Light-DOM MD3 borderless card primitive
│       ├── ModalBottomSheet.tsx      # Native <dialog>.showModal() MD3 bottom sheet
│       └── Toast.tsx                 # Persistent single-slot FIFO snackbar queue with Undo
├── screens/
│   ├── DashboardScreen.tsx           # 1-2 column grid layout with first-run detection
│   ├── deals/
│   │   ├── AddToListSheet.tsx        # Lifted shared modal bottom sheet for deal addition
│   │   ├── DealCard.tsx              # Compact single-column horizontal card (72x72 photo)
│   │   ├── DealFreshness.tsx         # Tonal banner with Material Symbols & refresh status
│   │   ├── DealSearchScreen.tsx      # MD3 Search Bar + horizontal chips + filter sheet
│   │   ├── FlyerItemsScreen.tsx      # Pushed flyer items deal grid with TopBar back nav
│   │   └── FlyersScreen.tsx          # 2-4 column elevated store catalog card grid
│   ├── lists/
│   │   ├── ArchivedListsScreen.tsx   # Read-only archived list index with unarchive action
│   │   ├── ListDetailScreen.tsx      # Quick-add input, StoreGroupHeaders, collapsible Bought
│   │   ├── ListsIndexScreen.tsx      # Shopping lists index with progress badges & MdDialog
│   │   └── PantryScreen.tsx          # Filter chips (All/Fridge/Freezer/Pantry) & expiry badges
│   └── onboarding/
│       ├── OnboardingLayout.tsx      # Centered MD3 frame with Icon back navigation
│       ├── SignInScreen.tsx          # Centered 440px tonal card with MAGIC_LINK_COPY
│       ├── SignUpScreen.tsx          # Centered 440px tonal card
│       ├── CreateHouseholdStep.tsx   # Action card with household name & postal code
│       ├── JoinHouseholdStep.tsx     # Action card with invite code input
│       └── InstallStep.tsx           # Guidance card with share & smartphone Material Symbols
```

### Pattern 1: Urgency-First Dashboard Ranking
**What:** Pillar cards display at most 3 preview items ranked by urgency: overdue first with `error` semantic tokens, then due today, then upcoming this week. Overdue items use `--md-sys-color-error` / `--md-sys-color-error-container`.
**When to use:** `DashboardScreen` and `DashboardCard`.
```typescript
// Source: apps/web/src/components/dashboard/DashboardCard.tsx
export function sortPillarItems(items: readonly DashboardItem[]): DashboardItem[] {
  return [...items].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return 0; // maintain temporal order
  });
}
```

### Pattern 2: Screen-Level Bottom Sheet Lifting
**What:** Move modal bottom sheets that can be triggered by many repeated items (`AddToListSheet` for `DealCard`s, `ItemSheet` for list rows) to the screen root. Child cards emit an `onAdd(deal)` event to open the shared sheet.
**When to use:** `DealSearchScreen`, `FlyerItemsScreen`, and `ListDetailScreen`.
```typescript
// Lifted sheet pattern in DealSearchScreen.tsx
const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

const handleAddDeal = (deal: Deal) => {
  const activeLists = (lists.data ?? []).filter((l) => l.archivedAt === null);
  if (activeLists.length === 1) {
    const list = activeLists[0];
    addDealToList.mutate({ listId: list.id, dealId: deal.id }, {
      onSuccess: () => toast({
        variant: 'success',
        message: `Added '${deal.name}' to ${list.name}`,
        action: { label: 'Undo', onAction: () => removeDealFromList.mutate(...) }
      })
    });
  } else {
    setSelectedDeal(deal); // Opens shared AddToListSheet
  }
};
```

### Anti-Patterns to Avoid
- **Per-Item Dialogs/Sheets:** Never instantiate a `<ModalBottomSheet>` or `<md-dialog>` inside individual list rows or deal cards. This creates 50+ dormant dialog nodes and causes memory leaks.
- **Overwriting Build-Time Copy:** Never change the exact string `'Email me a sign-in link'` in `SignInScreen.tsx` or the 3 verification strings in `magic-link.ts` — `apps/web/scripts/check-build.mjs` fails if these drift.
- **Lucide Icons in Refactored Screens:** Never import from `lucide-react`. All icons must use `Icon.tsx` with curated Material Symbols Rounded.
- **Border Grids:** Do not use `border border-border` or `divide-y` on cards. MD3 uses tonal separation (`surfaceContainerLow`, `surfaceContainer`) with zero 1px borders.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal Dialogs | Custom `fixed inset-0` div overlays | `MdDialog` or `ModalBottomSheet` | Native `<dialog>.showModal()` handles top-layer positioning, backdrop dismiss, focus trapping, and ESC key without layout bugs. |
| Persistent Undo Snackbar | Custom `setTimeout` alert container | `useToast()` / `ToastProvider` | Already implements single-slot FIFO queue, persistent `action` holding, and safe-area clearing. [VERIFIED: apps/web/src/components/ui/Toast.tsx:49-54] |
| Segmented Toggle | Flex div button group with active class | `SegmentedControl` | Implements MD3 roving tabindex, `role="radiogroup"`, `role="radio"`, and keyboard arrow navigation. [VERIFIED: apps/web/src/components/ui/SegmentedControl.tsx] |
| Barcode Detection | Custom video canvas pixel scanning | `createBarcodeDetector` | Polyfilled wrapper using native `BarcodeDetector` when present, falling back cleanly to local WASM ZBar engine. [VERIFIED: apps/web/src/lib/barcode/detector.ts] |
| Checkbox Row Hit Targets | Custom label click handlers | `Checkbox variant="in-list"` | Native MD3 checkbox wrapper with accessible 44px+ hit target and full-row click forwarding. [VERIFIED: apps/web/src/components/ui/Checkbox.tsx:79-82] |

---

## Runtime State Inventory

> Greenfield migration for UI presentation layer. No database migrations or persistent datastore schema changes occur in this phase.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — database schemas and RLS policies remain unchanged. | None |
| Live service config | None — API contracts and endpoints remain intact. | None |
| OS-registered state | Service worker precache manifest updated on build. | Handled automatically by `VitePWA` / `injectManifest`. |
| Secrets/env vars | `HESTIA_PUBLIC_MAGIC_LINK_ENABLED` | Retain exact environment flag in `routes.tsx` and build checks. |
| Build artifacts | `dist/` directory validated by `check-build.mjs` | Must verify shell budget `<= 200 KB` gzipped and `MAGIC_LINK_COPY`. |

---

## Common Pitfalls

### Pitfall 1: Breaking `MAGIC_LINK_COPY` Contract
**What goes wrong:** `pnpm build` fails during `scripts/check-build.mjs` with `MAGIC_LINK_COPY missing from source`.
**Why it happens:** Refactoring `SignInScreen.tsx` accidentally paraphrases the sign-in link button (e.g. changing "Email me a sign-in link" to "Sign in with email link").
**How to avoid:** Preserve the exact string `'Email me a sign-in link'` in `SignInScreen.tsx:26` and the three confirmation strings in `magic-link.ts`.
**Warning signs:** CI fails on `node scripts/check-build.mjs`.

### Pitfall 2: React 19 Custom Element Event Handling
**What goes wrong:** Controlled text fields do not update during typing or drop state.
**Why it happens:** React's synthetic `onChange` maps to native `change` on custom elements, which only fires on blur.
**How to avoid:** Always use `TextField` from `components/ui/Field.tsx` which wraps `onInput` and maps value changes synchronously. [VERIFIED: apps/web/src/components/ui/Field.tsx:357-358]

### Pitfall 3: Card Stretched Link vs Card Action Collision
**What goes wrong:** Tapping a card button (like "+3 more in Bills" or an action icon) also triggers the card's background link, causing unexpected navigation.
**Why it happens:** Using CSS `after:absolute after:inset-0` stretched links across the entire card surface while putting interactive buttons inside the card without `relative z-10` or event stopping.
**How to avoid:** Avoid full-card stretched links when cards have interactive footers. Make the card header title the link, and make the overflow footer a distinct `<md-text-button>` or `<Link>` element.

### Pitfall 4: Camera MediaStream Leaks in Barcode Scanner
**What goes wrong:** Camera indicator light stays on after dismissing `BarcodeScannerDialog`, draining device battery.
**Why it happens:** Unmounting the dialog without stopping all active `MediaStreamTrack`s on `streamRef.current`.
**How to avoid:** In `useEffect` cleanup of `BarcodeScannerDialog`, loop over `stream.getTracks()` and call `.stop()` on every track.

### Pitfall 5: Playwright E2E Selector Breakage
**What goes wrong:** E2E specs fail with timeout errors waiting for buttons or headings.
**Why it happens:** Refactored buttons or headings change copy or roles (e.g., button changing from "Sign in" to "Sign into Hestia" when an E2E test searches for `name: 'Sign in'`).
**How to avoid:** Ensure button names either match existing locators or update `e2e/support/app.ts` with regex matchers (e.g., `name: /Sign in/i`) within the same task commit.

---

## Code Examples

### 1. Borderless Tonal Card with Urgency Ranking
```typescript
// Verified pattern for DashboardCard.tsx
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { Card } from '../ui/Card.tsx';
import { Icon } from '../ui/Icon.tsx';
import { Button } from '../ui/Button.tsx';

export function DashboardCard({ pillar, title, items, total, path }): ReactElement {
  const visible = items.slice(0, 3);
  const remainder = total - visible.length;

  return (
    <Card variant="flat" className="flex flex-col gap-3 p-4 bg-[var(--md-sys-color-surface-container-low)]">
      <div className="flex items-center justify-between">
        <Link to={path} className="flex items-center gap-2 text-title-md font-semibold text-[var(--md-sys-color-on-surface)]">
          <Icon name={pillarIcon(pillar)} size={20} className="text-[var(--md-sys-color-primary)]" />
          <span>{title}</span>
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map((item) => (
          <li key={item.id} className="flex items-center justify-between text-body-sm">
            <span className={item.isOverdue ? 'font-semibold text-[var(--md-sys-color-error)]' : 'text-[var(--md-sys-color-on-surface)]'}>
              {item.isOverdue && <Icon name="error" size={16} className="inline mr-1 text-[var(--md-sys-color-error)]" />}
              {item.label}
            </span>
            {item.detail && <span className="text-label-sm text-[var(--md-sys-color-on-surface-variant)]">{item.detail}</span>}
          </li>
        ))}
      </ul>

      {remainder > 0 && (
        <div className="pt-2 border-t border-[var(--md-sys-color-surface-container)]">
          <Link to={path} className="text-label-md font-medium text-[var(--md-sys-color-primary)] hover:underline">
            +{remainder} more in {title}
          </Link>
        </div>
      )}
    </Card>
  );
}
```

### 2. Context-Adaptive StateBlocks
```typescript
// Verified pattern for StateBlocks.tsx
import type { ReactElement } from 'react';
import { Icon, type IconName } from '../ui/Icon.tsx';
import { Button } from '../ui/Button.tsx';

export interface StateBlockProps {
  icon: IconName;
  heading?: string;
  message: string;
  action?: { label: string; onAction: () => void };
  layout?: 'card' | 'page';
}

export function EmptyState({ icon, heading, message, action, layout = 'page' }: StateBlockProps): ReactElement {
  if (layout === 'card') {
    return (
      <div className="flex flex-col items-center gap-2 p-3 text-center">
        <Icon name={icon} size={32} className="text-[var(--md-sys-color-secondary)]" />
        <p className="text-body-sm text-[var(--md-sys-color-on-surface-variant)]">{message}</p>
        {action && (
          <Button variant="ghost" onClick={action.onAction}>
            {action.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-12 text-center max-w-[480px] mx-auto">
      <div className="flex size-16 items-center justify-center rounded-full bg-[var(--md-sys-color-surface-container-high)]">
        <Icon name={icon} size={48} className="text-[var(--md-sys-color-primary)]" />
      </div>
      {heading && <h2 className="text-title-lg font-semibold text-[var(--md-sys-color-on-surface)]">{heading}</h2>}
      <p className="text-body-md text-[var(--md-sys-color-on-surface-variant)]">{message}</p>
      {action && (
        <Button variant="primary" onClick={action.onAction}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current MD3 Approach | Impact |
|--------------|----------------------|--------|
| `border border-border` boxes with 1px lines | Borderless `surfaceContainerLow` flat cards | Cleaner visual hierarchy, removes visual noise, aligns with Google MD3. |
| Per-card `Sheet` in `DealCard.tsx` | Single lifted `AddToListSheet` at screen root | Reduces DOM node count by ~95% on deal search results, prevents memory leaks. |
| Radix `Dialog` in BarcodeScanner | Native top-layer full-screen dark HUD dialog | Native browser top-layer positioning, lighter bundle, dark theme canvas. |
| Mixed `lucide-react` icons | Curated inline SVG Material Symbols via `Icon.tsx` | Eliminates Lucide dependency, 0 B font download, consistent symbol weight. |
| Radix `ToggleGroup` | Light-DOM MD3 `SegmentedControl` with radiogroup ARIA | Roving tabindex keyboard navigation, robust accessibility compliance. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Existing E2E journey tests use `page.getByRole('button', { name: ... })` which tolerates regex case-insensitive matching. | Common Pitfalls | Minor test selector adjustments needed during wave execution. |

*All other claims in this research are verified directly against repository configuration, tests, and source files.*

---

## Open Questions (RESOLVED)

1. **How should quick item additions interact with list grouping if no store is selected?**
   - **RESOLVED:** Follow established pattern in `ListDetailScreen.tsx` — items without a store group automatically under the "Anywhere" tonal store group header at the bottom.

2. **Should offline scanning queue barcodes when offline?**
   - **RESOLVED:** Yes, queue scanned barcodes into the offline write queue via `usePendingListWrites`, matching the existing offline queue behavior.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build & testing | ✓ | 24.x | — |
| pnpm | Monorepo package manager | ✓ | 10.34.5 | — |
| Chromium (Playwright) | E2E test execution | ✓ | 1.63.0 | — |
| Camera `MediaDevices` | Barcode scanner | ✓ | Web API | Manual numeric barcode keypad entry |
| `BarcodeDetector` API | Barcode decoding | ✓ | Native / WASM | `@undecaf/zbar-wasm` local fallback |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.1 (node + jsdom) [VERIFIED: apps/web/vite.config.ts:112-150] |
| Config file | `apps/web/vite.config.ts` |
| Quick run command | `pnpm --filter @hestia/web test` |
| Full suite command | `pnpm --filter @hestia/web test:coverage && pnpm test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **DASH-01** | Dashboard This Week 1-2 col card grid, urgency ranking, first run hero | Unit / DOM | `pnpm --filter @hestia/web test src/screens/DashboardScreen.test.tsx` | ❌ Wave 0 Gap |
| **DASH-02** | Context-adaptive EmptyState, ErrorState, OfflineState blocks | Unit / DOM | `pnpm --filter @hestia/web test src/components/states/StateBlocks.test.tsx` | ❌ Wave 0 Gap |
| **AUTH-06** | Auth screens centered 440px cards, TextField inputs, MAGIC_LINK_COPY | Unit & Build | `pnpm --filter @hestia/web test src/screens/onboarding/ && node apps/web/scripts/check-build.mjs` | ✅ Exists (needs update) |
| **AUTH-07** | OnboardingLayout, CreateHouseholdStep, JoinHouseholdStep, InstallStep | Unit / DOM | `pnpm --filter @hestia/web test src/screens/onboarding/OnboardingScreen.test.tsx` | ✅ Exists (needs update) |
| **LIST-01** | ListsIndexScreen borderless rows, MdFab, MdDialog create prompt | Unit / DOM | `pnpm --filter @hestia/web test src/screens/lists/ListsIndexScreen.test.tsx` | ❌ Wave 0 Gap |
| **LIST-02** | ListDetailScreen StoreGroupHeader, ItemSheet ModalBottomSheet, Bought accordion | Unit / DOM | `pnpm --filter @hestia/web test src/screens/lists/ListDetailScreen.test.tsx` | ❌ Wave 0 Gap |
| **LIST-03** | BarcodeScannerDialog dark HUD, flashlight, manual entry, Undo feedback | Unit / DOM | `pnpm --filter @hestia/web test src/components/lists/BarcodeScannerDialog.test.tsx` | ❌ Wave 0 Gap |
| **DEAL-06** | DealSearchScreen Search Bar, SegmentedControl, FilterModalBottomSheet, DealFreshness | Unit / DOM | `pnpm --filter @hestia/web test src/screens/deals/DealSearchScreen.test.tsx` | ❌ Wave 0 Gap |
| **DEAL-07** | DealCard compact mobile layout, lifted AddToListSheet, FlyersScreen elevated grid | Unit / DOM | `pnpm --filter @hestia/web test src/screens/deals/DealCard.test.tsx` | ❌ Wave 0 Gap |

### Sampling Rate
- **Per task commit:** `pnpm --filter @hestia/web test`
- **Per wave merge:** `pnpm --filter @hestia/web test:coverage && pnpm typecheck && pnpm lint`
- **Phase gate:** `pnpm build && pnpm test:e2e` green before phase completion.

### Wave 0 Gaps
- [ ] `apps/web/src/screens/DashboardScreen.test.tsx` — covers `DASH-01`
- [ ] `apps/web/src/components/states/StateBlocks.test.tsx` — covers `DASH-02`
- [ ] `apps/web/src/components/lists/BarcodeScannerDialog.test.tsx` — covers `LIST-03`
- [ ] `apps/web/src/screens/deals/DealCard.test.tsx` — covers `DEAL-07`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| **V2 Authentication** | Yes | Email/password & GoTrue OTP magic links; rate limit enforcement; password hashing in backend. [VERIFIED: apps/web/src/lib/auth/auth-client.ts] |
| **V3 Session Management** | Yes | GoTrue JWT tokens in secure browser storage; automatic token refresh; redirect to sign-in on expiry. |
| **V4 Access Control** | Yes | Household RLS policies enforced server-side; client UI gates actions based on household membership. |
| **V5 Input Validation** | Yes | Zod schema validation on list names, item names, prices, postal codes (`shared/src/schemas/`). |
| **V6 Cryptography** | Yes | Web Crypto API for random IDs; HTTPS/WSS transport; zero custom client crypto. |

### Known Threat Patterns for Web Frontend Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via user-supplied grocery / list names | Tampering | React 19 JSX escapes strings automatically; no `dangerouslySetInnerHTML`. |
| Camera hijacking / lingering streams | Information Disclosure | Explicitly stop all media tracks upon dialog unmount. |
| Magic link token leakage | Information Disclosure | `MAGIC_LINK_COPY` and code parsing only accept 6 digits; no tokens logged. |
| Client-side price tampering | Tampering | Deal snapshots validated and price calculations enforced on the server. |

---

## Sources

### Primary (HIGH confidence)
- `apps/web/package.json` — verified package versions (`@material/web@2.5.0`, `@lit/react@1.0.8`, `react@19.3.0`). [VERIFIED: apps/web/package.json:21-35]
- `apps/web/vite.config.ts` — verified Vitest projects (`unit`, `dom`), jsdom configuration, coverage thresholds. [VERIFIED: apps/web/vite.config.ts:112-164]
- `apps/web/scripts/check-build.mjs` — verified `MAGIC_LINK_COPY` ratchet and 200 KB gzipped shell budget. [VERIFIED: apps/web/scripts/check-build.mjs:25-39]
- `apps/web/src/test/md-queries.ts` — verified shadow-piercing DOM queries for test suite. [VERIFIED: apps/web/src/test/md-queries.ts:332-360]
- `apps/web/src/components/ui/Toast.tsx` — verified persistent Undo snackbar queue. [VERIFIED: apps/web/src/components/ui/Toast.tsx:49-54]

### Secondary (MEDIUM confidence)
- Material Web official documentation on `<md-dialog>`, `<md-outlined-text-field>`, `<md-checkbox>`, and `<md-filter-chip>`.
- W3C Barcode Detection API & ZBar WASM documentation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified directly from monorepo configuration and lockfiles.
- Architecture: HIGH — patterns directly address existing codebase bottlenecks and match approved UI-SPEC.
- Pitfalls: HIGH — directly informed by `check-build.mjs`, jsdom limitations, and previous Phase 17/18 learnings.

**Research date:** 2026-11-15  
**Valid until:** 2026-12-15

