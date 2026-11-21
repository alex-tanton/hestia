# Phase 18: Adaptive MD3 Navigation Shell & Route Chrome - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-14
**Phase:** 18-Adaptive MD3 Navigation Shell & Route Chrome
**Areas discussed:** Adaptive Shell Layout, Top App Bar & Single-<h1> Hierarchy, Household Switcher Gating, Pillar Tabs & Consolidated Meals Routing

---

## Adaptive Shell Layout

| Option | Description | Selected |
|--------|-------------|----------|
| MD3 Active Indicator Pill | Pill container (tonal secondary-container) behind the icon, filled={true} Material Symbol, and medium-weight label text. | ✓ |
| Icon-Only Highlight | Colored/filled icon without an indicator pill container background. | |
| Legacy Accent Bar | Accent indicator strip along the edge (top on mobile, left on rail) with colored icon. | |
| You decide | Agent chooses destination styling. | |

**User's choice:** MD3 Active Indicator Pill
**Notes:** Establishes unmistakable MD3 destination styling across both NavigationBar (<600px) and NavigationRail (>=600px).

| Option | Description | Selected |
|--------|-------------|----------|
| Top-aligned primary destinations + bottom-pinned Settings | Home, Lists, Meals, Bills, Chores grouped at the top; Settings anchored to the rail footer. | ✓ |
| Centered destinations + bottom-pinned Settings | 5 primary destinations centered vertically in the rail, Settings anchored at the bottom. | |
| Continuous list | All 6 items grouped together at the top of the rail without separating Settings. | |
| You decide | Agent chooses rail layout. | |

**User's choice:** Top-aligned primary destinations + bottom-pinned Settings
**Notes:** Matches MD3 canonical navigation rail anatomy.

| Option | Description | Selected |
|--------|-------------|----------|
| Tiered max-width | max-w-160 (<600px), max-w-240 (600–839px), and centered max-w-5xl (>=840px expanded). | |
| Uniform max-width (max-w-240) | Cap all viewports >=600px at ~960px centered (matching current shell container width). | |
| Fluid full-width | Let content expand fully across the viewport with fixed side margins only. | ✓ |
| You decide | Agent chooses main width scaling. | |

**User's choice:** Fluid full-width
**Notes:** User chose fluid full-width expansion across viewports with fixed side margins.

| Option | Description | Selected |
|--------|-------------|----------|
| Standard MD3 80dp NavigationBar | 80px container height with surfaceContainer fill extending down into env(safe-area-inset-bottom), content padded by calc(5rem + env(safe-area-inset-bottom)). | ✓ |
| Compact 64dp bar | Lower-profile 64px bar with tighter icon/label vertical spacing. | |
| Floating bottom bar | Elevated pill bar floating above screen bottom with rounded corners and margins. | |
| You decide | Agent chooses bottom bar height. | |

**User's choice:** Standard MD3 80dp NavigationBar
**Notes:** Provides proper MD3 touch targets and seamless safe-area integration on mobile PWA.

---

## Top App Bar & Single-`<h1>` Hierarchy

| Option | Description | Selected |
|--------|-------------|----------|
| MD3 Scroll-Aware Tonal Tint | At top (scrollY = 0), flat surface canvas; on scroll (scrollY > 0), tint smoothly to surfaceContainer with elevation level 2 (tonal color shift, no harsh 1px border). | ✓ |
| Constant subtle border | Keep a continuous subtle border (border-outlineVariant) at all times, with or without scroll. | |
| Drop shadow on scroll | Keep surface background and add an elevation box-shadow on scroll. | |
| You decide | Agent chooses scroll transition styling. | |

**User's choice:** MD3 Scroll-Aware Tonal Tint
**Notes:** Eliminates the static 1px border line in favor of modern MD3 tonal elevation.

| Option | Description | Selected |
|--------|-------------|----------|
| MD3 Standard Icon Button | Circular <md-icon-button> with arrow_back Material Symbol and aria-label="Back to [Section]" (clean MD3 pattern, uncluttered). | ✓ |
| Labeled Back Button | Arrow icon plus text label (e.g. "← Recipes" or "← Back") on all screen sizes. | |
| Responsive Hybrid | Icon-only on mobile (<600px), icon + section label on desktop (>=600px). | |
| You decide | Agent chooses back button affordance. | |

**User's choice:** MD3 Standard Icon Button
**Notes:** Uncluttered icon-only back button with explicit accessible name.

| Option | Description | Selected |
|--------|-------------|----------|
| Show on <600px only | Omit from Top App Bar on >=600px, since Settings is permanently anchored in the Navigation Rail footer. | ✓ |
| Always show in Top App Bar | Keep the Settings icon button in the Top App Bar across all screen sizes. | |
| Replace with user profile menu | Show a user avatar/profile menu in Top App Bar on desktop instead. | |
| You decide | Agent chooses Settings button placement. | |

**User's choice:** Show on <600px only
**Notes:** Eliminates redundant Settings triggers on desktop viewports.

| Option | Description | Selected |
|--------|-------------|----------|
| Top App Bar owns single <h1>; screen body headings demote to <h2> | Preserves valid document outline, passes axe-core accessibility audits, and useScreenChrome dynamically sets <h1>. | |
| Screen body owns <h1> | Top App Bar title renders as non-heading aria-label / visual text. | |
| Screen body omits title entirely | Title lives solely in the sticky Top App Bar. | |
| You decide | Top App Bar owns single <h1>; screen body headings demote to <h2>. | ✓ |

**User's choice:** You decide (Agent resolved to: Top App Bar owns single <h1>; screen body headings demote to <h2>).
**Notes:** Ensures clean single-`<h1>` document semantics and clears axe-core duplicate heading violations.

---

## Household Switcher Gating

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown with "No other households" | Display active household with dropdown chevron; clicking opens sheet stating "No other households" + "Join or create". | ✓ |
| Static text label | Render active household name as clean text with no chevron, button role, or sheet trigger. | |
| Disabled button | Keep button styling and chevron but disabled. | |
| Hidden entirely | Do not show household name at all when user only has one household. | |

**User's choice:** The Top App Bar should still display the active household with the dropdown, but the contents should say something to the effect of "No other households"
**Notes:** Direct user specification. Preserves access to create/join household from the top bar while cleanly handling the single-membership case.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep button element with dropdown chevron | switcher(page) matches page.getByRole('button', { name: /switch household$/ }) reliably across both single and multi-household users. | ✓ |
| Update E2E helper in e2e/support/app.ts | Let switcher(page) match either button or data-testid. | |
| You decide | Retain button element with accessible name. | |

**User's choice:** You decide (Agent resolved to: Retain button element with accessible name so E2E test helpers need zero changes).
**Notes:** Guarantees zero regression across existing 12+ Playwright specs.

| Option | Description | Selected |
|--------|-------------|----------|
| MD3 ModalBottomSheet | Migrate to Phase 17's ModalBottomSheet (<dialog>.showModal()) with active household checkmark and "Join or create" footer row. | ✓ |
| Anchored MD3 Menu | Use <md-menu> anchored directly below the Top App Bar trigger button. | |
| Centered MD3 Dialog | Open a centered <md-dialog> with a list of households. | |
| You decide | Agent chooses sheet surface. | |

**User's choice:** MD3 ModalBottomSheet
**Notes:** Migrates legacy Radix Sheet to the native dialog MD3 primitive.

| Option | Description | Selected |
|--------|-------------|----------|
| Tonal Skeleton Pill | A 112px × 20px surface-container-highest skeleton pill with role="status" and sr-only "Loading households". | ✓ |
| Subtle spinner | A small circular progress indicator next to "Loading...". | |
| Empty layout reservation | Reserve width invisibly without drawing skeleton bars. | |
| You decide | Agent chooses loading affordance. | |

**User's choice:** Tonal Skeleton Pill
**Notes:** Prevents layout shift during initial household query hydration.

---

## Pillar Tabs & Consolidated Meals Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Controlled md-tabs with activeTabIndex sync | Map activeTabIndex to current URL pathname and listen to onChange to call navigate(tab.path). | ✓ |
| Wrap tabs in NavLink | Wrap each tab item in a React Router <NavLink> to drive navigation natively. | |
| You decide | Agent chooses tab navigation sync. | |

**User's choice:** Controlled md-tabs with activeTabIndex sync
**Notes:** Smooth animated indicator transitions with clean React Router history integration.

| Option | Description | Selected |
|--------|-------------|----------|
| Filter Chip bar above recipe list | An <md-filter-chip label="On sale / Ready now"> that toggles to filter recipes by pantry readiness and active store deals. | ✓ |
| Inline segmented button | A 2-way segmented button ("All Recipes | On Sale / Ready") above the recipe grid. | |
| Search filter dropdown option | Place "On sale / Ready now" inside a filter menu next to the search input. | |
| You decide | Agent chooses suggestion filter UI. | |

**User's choice:** Filter Chip bar above recipe list
**Notes:** Clean progressive chip filtering following MD3 guidelines.

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to /meals/recipes?filter=ready | Redirect cleanly with replace: true and preserve user intent by activating the "On sale / Ready now" filter automatically. | ✓ |
| Redirect to /meals/recipes root | Redirect without setting any filter parameters. | |
| You decide | Agent chooses redirect target. | |

**User's choice:** Redirect to /meals/recipes?filter=ready
**Notes:** Preserves user intent from existing suggestions bookmarks.

| Option | Description | Selected |
|--------|-------------|----------|
| Direct clean route table | ListsRoute renders live screens for Lists, Deals, Flyers, Pantry, and Detail routes; delete SubSectionComingSoon and SectionProvider entirely. | ✓ |
| Keep SectionProvider as deprecated no-op pass-through | Retain SectionProvider until Phase 21 cleanup. | |
| You decide | Agent chooses route table restructuring. | |

**User's choice:** Direct clean route table
**Notes:** Deletes dead scaffolding immediately.

| Option | Description | Selected |
|--------|-------------|----------|
| Scrollable horizontal tabs | Allow <md-tabs> to scroll horizontally with no visible scrollbar, ensuring labels remain full and unclipped. | ✓ |
| Equal-width compressed tabs | Fit all tabs in the viewport width with text truncation if needed. | |
| You decide | Agent chooses tab overflow handling. | |

**User's choice:** Scrollable horizontal tabs
**Notes:** Prevents cramped and truncated labels on small mobile screens.

| Option | Description | Selected |
|--------|-------------|----------|
| Reset scroll to top (0) | Switching sub-tabs scrolls window to top so user begins at top of new list/grid. | ✓ |
| Preserve current scroll position | Keep window scroll wherever the user was. | |
| Per-subtab scroll memory | Remember scroll position for each sub-tab independently. | |
| You decide | Agent chooses sub-tab scroll behavior. | |

**User's choice:** Reset scroll to top (0)
**Notes:** Standard expectation when navigating between distinct sub-views.

| Option | Description | Selected |
|--------|-------------|----------|
| Tonal Empty State Card | Render a surfaceContainerLow card explaining no recipes currently match pantry items or active store sales, with a 'Clear filter' action button. | ✓ |
| Subtle text note | Show a simple one-line text notice above an empty space. | |
| You decide | Agent chooses empty state UI. | |

**User's choice:** Tonal Empty State Card
**Notes:** Provides actionable recovery when the filter returns zero matches.

| Option | Description | Selected |
|--------|-------------|----------|
| Atomic cleanup + knip baseline update | Remove dead fields, delete SubSectionComingSoon.tsx and SectionProvider, and update scripts/knip-production-baseline.txt in the same wave. | ✓ |
| Keep dead types with @deprecated annotations | Defer cleanup to Phase 21. | |
| You decide | Agent chooses cleanup timing. | |

**User's choice:** Atomic cleanup + knip baseline update
**Notes:** Maintains strict CI hygiene and prevents accumulation of dead code.

---

## the agent's Discretion

- Standardized 80dp NavigationRail geometry with centered 56dp × 32dp indicator pills.
- Scroll detection threshold of `scrollY > 4px` with CSS transitions on Top App Bar container color.
- Single-`<h1>` enforcement with Top App Bar owning the `<h1>` and sub-headings demoted to `<h2>`.

## Deferred Ideas

- None — discussion stayed within phase scope.

