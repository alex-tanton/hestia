# Phase 18: Adaptive MD3 Navigation Shell & Route Chrome - Research
**Researched:** 2026-11-15
**Domain:** Material Design 3 Navigation Shell, Responsive Window Size Classes, React Router 8 Route Chrome, Accessibility Hierarchy
**Confidence:** HIGH

## Summary

Phase 18 replaces Hestia's legacy responsive navigation chrome (which suffered from a 1025px layout cliff, segmented sub-tabs, and duplicate `<h1>` heading violations) with a modern Material Design 3 adaptive shell. The new shell strictly adopts MD3 Window Size Classes: viewports under 600px render a 5-destination bottom `NavigationBar` (80dp height, `surfaceContainer` fill, safe-area inset padding) with Settings located in the Top App Bar; viewports at or above 600px render an 80dp left `NavigationRail` with top-aligned primary destinations and a bottom-pinned Settings destination. The main canvas (`<main id="main">`) expands fluidly to multi-column desktop widths, clearing the rail without legacy max-width constraints.

The shell enforces a single-`<h1>` accessibility architecture: the 64px Small Top App Bar owns the page's single `<h1>` across all routes, utilizing an MD3 scroll-aware tonal tint (flat `surface` when `scrollY = 0`, smoothly tinting to `surfaceContainer` elevation tier 2 on scroll without 1px dividers). Pushed routes synchronize via `useScreenChrome`, while internal screen headings in `RecipeDetailScreen`, `ChoreDetailScreen`, and `ChoreFormScreen` are demoted to `<h2>` to eliminate duplicate `<h1>` axe-core violations.

Pillar sub-tabs migrate from `SegmentedControl` to MD3 Primary Tabs (`<md-tabs>` / `<md-primary-tab>`) with scroll position reset on sub-tab switch. `HouseholdSwitcher` transitions to `ModalBottomSheet` while maintaining 100% selector compatibility with Playwright E2E helpers (`switcher(page)`). Meals routes are consolidated by folding suggestions into an `<md-filter-chip label="On sale / Ready now">` on `RecipeLibraryScreen` with `/meals/suggestions` redirecting cleanly. Finally, `SectionProvider` and dead `SubSectionComingSoon` routes are deleted atomically.

**Primary recommendation:** Implement the adaptive shell as two explicit layout components (`NavigationBar` for `<600px` and `NavigationRail` for `>=600px`) sharing the MD3 Active Indicator Pill (`secondaryContainer` capsule with filled Material Symbol); demote internal body headings in detail screens to `<h2>` while Top App Bar hosts the single `<h1>`; and wrap `@material/web/chips/filter-chip.js` as `MdFilterChip` for recipe readiness filtering.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Adaptive Shell Layout & Window Size Classes
- **D-01:** Standardize navigation active destinations on the **MD3 Active Indicator Pill**: a tonal `secondaryContainer` pill container behind the icon, active `filled={true}` Material Symbol (`Icon.tsx`), and medium-weight label text across both `NavigationBar` (`<600px`) and `NavigationRail` (`>=600px`).
- **D-02:** Structure the `80dp` `NavigationRail` (`>=600px`) with **top-aligned primary destinations** (Home, Lists, Meals, Bills, Chores) and **bottom-pinned Settings** anchored in the rail footer region.
- **D-03:** Scale `<main id="main">` with **fluid full-width expansion** across all viewports with fixed horizontal side margins (clearing the `80dp` rail on `>=600px`), allowing dashboard and planner multi-column views to utilize available desktop canvas.
- **D-04:** Implement the mobile `NavigationBar` (`<600px`) as a **standard MD3 80dp container** (`min-h-[80px]`) with `surfaceContainer` fill extending down through `env(safe-area-inset-bottom)`, and pad main content by `calc(5rem + env(safe-area-inset-bottom))` to clear navigation and PWA safe areas cleanly.

#### Scroll-Aware Top App Bar & Single-`<h1>` Architecture
- **D-05:** Implement the Small Top App Bar (`64px` height) with **MD3 Scroll-Aware Tonal Tint**: flat `surface` canvas at top (`scrollY = 0`), smoothly tinting to `surfaceContainer` (elevation tier 2) on scroll (`scrollY > 0`) without harsh 1px borders.
- **D-06:** Standardize back navigation on pushed routes to a **circular `<md-icon-button>` with `arrow_back` Material Symbol** and accessible label (`aria-label={chrome.backLabel ? \`Back to ${chrome.backLabel}\` : 'Back'}`).
- **D-07:** Surface the Settings icon button in the Top App Bar on **compact `<600px` viewports only**; omit from the Top App Bar on `>=600px` where Settings is permanently accessible in the Navigation Rail footer.
- **D-08:** Enforce the **single-`<h1>` hierarchy** by establishing that the Top App Bar owns the page's single `<h1>` across all routes (dynamically synchronized via `useScreenChrome`); demote internal screen body headings in `RecipeDetailScreen`, `ChoreDetailScreen`, and `ChoreFormScreen` to `<h2>` (or section headings) to eliminate duplicate `<h1>` axe-core accessibility violations.

#### Household Switcher Gating & Single-Household Affordance
- **D-09:** Retain the **Top App Bar dropdown button with chevron and `, switch household` accessible label across all users**. When clicked for a single-household user (`households.length === 1`), the sheet opens indicating the current household is active, displaying helper copy stating "No other households", and providing the "Join or create a household" action.
- **D-10:** Maintain full **E2E helper compatibility** with `e2e/support/app.ts` `switcher(page)` (`page.getByRole('button', { name: /switch household$/ })`) so all existing Playwright journeys (including single-household journeys like signup and first household) pass without fragile selector forks.
- **D-11:** Migrate the switcher surface from legacy Radix `Sheet` to **MD3 `ModalBottomSheet` (`<dialog>.showModal()`)**, displaying checkmark indicators on the active household and a clean MD3 action row for joining/creating households.
- **D-12:** Represent loading household state with a **tonal skeleton pill** (`surfaceContainerHighest`, `112px × 20px`, `role="status"`, `sr-only` "Loading households") to prevent layout shift.

#### Pillar SubTabs & Consolidated Meals Routing
- **D-13:** Migrate `SubTabs.tsx` from `SegmentedControl` to **MD3 Primary Tabs (`<md-tabs>` / `<md-primary-tab>`)** with controlled `activeTabIndex` synchronized with React Router `location.pathname` and `onChange` dispatching `navigate(tab.path)`, ensuring animated indicator sliding and clean history navigation.
- **D-14:** Support **scrollable horizontal tabs** on narrow viewports (`<375px`) without visible scrollbars or clipped labels so multi-tab pillars like Lists (`Lists`, `Deals`, `Flyers`, `Pantry`) stay fully legible.
- **D-15:** **Reset window scroll to top (`0`)** whenever the user switches between sub-tabs within a pillar so the user begins at the top of the newly selected list or view.
- **D-16:** Consolidate `Meals` sub-tabs from 3 to 2 (`Planner | Recipes`), folding suggestions into an **`<md-filter-chip label="On sale / Ready now">`** on `RecipeLibraryScreen`. When active, it filters recipes by current pantry inventory and active store deals, rendering a `surfaceContainerLow` empty state card with a "Clear filter" action if no recipes match.
- **D-17:** Redirect `/meals/suggestions` cleanly to **`/meals/recipes?filter=ready` with `replace: true`**, preserving existing bookmarks and links while automatically engaging the "On sale / Ready now" filter.
- **D-18:** Perform **atomic cleanup of dead scaffold code**: delete `SectionProvider` (`apps/web/src/lib/section-context.tsx`), delete `SubSectionComingSoon.tsx`, remove dead `comingSoon` strings from `Pillar` definitions in `sections.ts`, and update `scripts/knip-production-baseline.txt` in the same wave to keep CI hygiene green.

### the agent's Discretion
- **Rail Width & Icon Centering:** Standardize on exact 80dp rail width with center-aligned 56dp × 32dp indicator pills and 12sp typography per MD3 Navigation Rail guidelines.
- **Scroll Detection Threshold:** Implement scroll detection using a passive scroll listener (or IntersectionObserver) triggering the Top App Bar `surfaceContainer` tint when `scrollY > 4px` with CSS transitions on `background-color`.
- **Primary vs Secondary Tab Styling in SubTabs:** Use `<md-tabs>` with `<md-primary-tab>` elements styled with Warm Terracotta `--md-sys-color-primary` active indicator and surface-blended background.

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAV-01 | Replace the `1025px` layout cliff with MD3 Window Size Classes: 5-destination `NavigationBar` (`<600px`, Settings in Top App Bar), `80dp` `NavigationRail` (`>=600px`, bottom-anchored Settings), and `>=840px` expanded content grids. | Section "Adaptive Shell Layout & Window Size Classes" details CSS geometry, safe-area offsets, and media queries (`min-width: 600px`). |
| NAV-02 | Enforce a scroll-aware Small Top App Bar owning the screen's single `<h1>` and `useScreenChrome` across all pushed routes (fixing missing `useScreenChrome` in `RecipeDetailScreen` and duplicate `<h1>`s in `RecipeDetailScreen`, `ChoreDetailScreen`, and `ChoreFormScreen`). | Section "Scroll-Aware Top App Bar & Single-`<h1>` Architecture" maps exact code changes in `RecipeDetailScreen.tsx`, `ChoreDetailScreen.tsx`, and `ChoreFormScreen.tsx`. |
| NAV-03 | Migrate `SubTabs` from `SegmentedControl` to MD3 Primary Tabs (`<md-tabs>` / `<md-primary-tab>`), gate `HouseholdSwitcher` sheet access to `households.length > 1`, and delete `SectionProvider` plus dead `SubSectionComingSoon` routes in `ListsRoute.tsx`. | Section "Pillar SubTabs & Household Switcher" provides Lit component configuration, keyboard navigation, and atomic file deletion inventory. |
| NAV-04 | Consolidate `Meals` sub-tabs from 3 (`Planner \| Recipes \| Suggestions`) to 2 (`Planner \| Recipes`) by folding `SuggestionsScreen` into an `"On sale / Ready now"` `<md-filter-chip>` on `Recipes`, keeping `/meals/suggestions` redirecting to `/meals/recipes`. | Section "Consolidated Meals Routing & Recipe Readiness Filter" details route redirection, query parameter handling (`?filter=ready`), and `MdFilterChip` integration. |
</phase_requirements>

## Project Constraints (from CLAUDE.md & Build System)

- **Bundle Budget Ratchet:** `apps/web/scripts/check-build.mjs` enforces `SHELL_BUDGET_BYTES = 200 * 1024` (200 KB gzipped) for entry assets [VERIFIED: apps/web/scripts/check-build.mjs:19]. Never import `@material/web/all.js`. Only import explicit component subpaths (`@material/web/tabs/tabs.js`, `@material/web/tabs/primary-tab.js`, `@material/web/chips/filter-chip.js`).
- **Strict TypeScript & React 19:** `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, explicit return types on exported functions, named exports only, ESM imports with explicit `.ts`/`.tsx` extensions [VERIFIED: tsconfig.base.json].
- **Clean CI Hygiene:** `pnpm knip` must report zero unexpected unused files/exports; production baseline in `scripts/knip-production-baseline.txt` must match [VERIFIED: scripts/knip-production-baseline.txt]. `pnpm jscpd` enforces <= 2% duplication threshold. LF line endings strictly required [VERIFIED: scripts/check-repo-hygiene.mjs].
- **Accessibility Standards:** WCAG 2.1 AA contrast across all `surfaceContainer` tiers. Exactly one `<h1>` per rendered route. All icon buttons must provide explicit `aria-label` or accessible names. Landmarks must carry unambiguous labels (`aria-label="Main"`, `aria-label="<Pillar> sections"`).
- **Playwright E2E Locator Invariants:** `e2e/support/app.ts` relies on `page.getByRole('button', { name: /switch household$/ })`, `page.getByRole('heading', { name: 'This Week', level: 1 })`, and `page.getByRole('link', { name: 'Settings' })` [VERIFIED: e2e/support/app.ts:5-13, 41].

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Adaptive Shell Breakpoints | Browser / CSS | Client Component (`AppShell`) | Media queries (`@media (min-width: 600px)`) toggle layout CSS classes without hydration mismatch or window listener overhead. |
| Scroll Awareness & Tonal Tint | Browser / Client | TopBar | Passive scroll listener tracking `window.scrollY > 4` toggles `surfaceContainer` class on the sticky header. |
| Screen Title & Back Navigation | Client Component (`screen-chrome.tsx`) | TopBar | React Context synchronizes `title`, `backTo`, and `backLabel` with unmount cleanup to guarantee single `<h1>` ownership. |
| Sub-Tab Navigation | Client Component (`SubTabs.tsx`) | React Router | MD3 Primary Tabs dispatch router navigation; router pathname drives controlled active tab index. |
| Household Switching | Client Component (`HouseholdSwitcher`) | Native `<dialog>` (`ModalBottomSheet`) | Native top-layer modal bottom sheet ensures modal trap, backdrop dismissal, and accessible selection. |
| Recipe Filter Chip Gating | Client Component (`RecipeLibraryScreen`) | React Router SearchParams | Search parameter `?filter=ready` preserves deep links and back navigation across filtered states. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@material/web` | `2.5.0` [VERIFIED: apps/web/package.json:22] | MD3 web components (`tabs`, `primary-tab`, `filter-chip`, `icon-button`) | Official Google MD3 web component library; subpath imports preserve strict 200 KB shell budget. |
| `@lit/react` | `1.0.8` [VERIFIED: apps/web/package.json:21] | React 19 wrapper generator (`createComponent`) | Interops custom elements with React synthetic events, controlled props, and ref forwarding. |
| `react-router` | `8.4.0` [VERIFIED: apps/web/package.json:33] | Client-side routing, navigation, and location state | Project's existing router providing declarative route matching, redirects, and URL search param hooks. |
| Curated Material Symbols | In-repo (`Icon.tsx`) [VERIFIED: apps/web/src/components/ui/Icon.tsx:1-33] | Rounded SVG icon rendering with `filled?: boolean` | Zero WOFF2 precache overhead, strict CSP compliance, and filled state for active destinations. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ModalBottomSheet` | In-repo primitive [VERIFIED: apps/web/src/components/ui/ModalBottomSheet.tsx] | Native `<dialog>.showModal()` bottom sheet | Household switcher sheet across mobile and desktop. |
| `Skeleton` | In-repo primitive [VERIFIED: apps/web/src/components/ui/Skeleton.tsx] | MD3 tonal skeleton pill (`surfaceContainerHighest`) | Loading state indicator in household switcher trigger. |
| `ListRow` | In-repo primitive [VERIFIED: apps/web/src/components/ui/ListRow.tsx] | MD3 structured list item with leading/trailing slots | Household list items and "Join or create" row inside switcher sheet. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MD3 `NavigationRail` (`>=600px`) | Legacy `lg:w-56` text sidebar | Legacy sidebar wasted horizontal canvas and triggered an awkward 1025px layout jump; MD3 80dp rail is compact, standardized, and matches 600px Window Size Classes. |
| MD3 Primary Tabs (`<md-tabs>`) | `SegmentedControl` (radiogroup) | Segmented control is intended for discrete filtering/toggling, not top-level navigation; MD3 Primary Tabs feature animated indicator sliding, native keyboard roving tabindex, and standard ARIA `tablist`/`tab` semantics. |
| `ModalBottomSheet` | Radix UI `Sheet` | Radix adds external dependency weight and light-dismiss edge cases; native `<dialog>.showModal()` MD3 sheet leverages platform top-layer with zero bundle bloat. |

## Package Legitimacy Audit

> Phase 18 introduces **zero new external dependencies**. All libraries (`@material/web@2.5.0`, `@lit/react@1.0.8`, `react-router@8.4.0`) are already pinned and verified in `apps/web/package.json`.

| Package | Registry | Current In-Repo Version | Source Repo | Verdict | Disposition |
|---------|----------|-------------------------|-------------|---------|-------------|
| `@material/web` | npm | `2.5.0` | `github.com/material-components/material-web` | OK | Approved (already installed) |
| `@lit/react` | npm | `1.0.8` | `github.com/lit/lit` | OK | Approved (already installed) |
| `react-router` | npm | `8.4.0` | `github.com/remix-run/react-router` | OK | Approved (already installed) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
+----------------------------------------------------------------------------------------------------+
|                                    MD3 Adaptive Window Container                                   |
+----------------------------------------------------------------------------------------------------+
                                                  |
                  +-------------------------------+-------------------------------+
                  | Viewport Width                                                | Viewport Width
                  v (< 600px: Compact)                                            v (>= 600px: Medium / Expanded)
+---------------------------------------------+   +--------------------------------------------------+
|           Mobile Shell Container            |   |               Desktop Shell Container            |
|                                             |   |                                                  |
|  +---------------------------------------+  |   |  +--------------------+  +--------------------+  |
|  | Small Top App Bar (64px, scroll-tint) |  |   |  | Navigation Rail    |  | Top App Bar (64px) |  |
|  | - Back button OR Household Switcher   |  |   |  | (80dp width, fixed)|  | - Back button OR   |  |
|  | - Single <h1> Screen Title            |  |   |  |                    |  |   Household Switcher|  |
|  | - Settings icon button (<600px only)  |  |   |  | - Logo/Top space   |  | - Single <h1> Title|  |
|  +---------------------------------------+  |   |  | - 5 Primary Tabs   |  |   (No Settings btn)|  |
|                                             |   |  |   (Indicator pill) |  +--------------------+  |
|  +---------------------------------------+  |   |  | - Inset divider    |                          |
|  | Pillar SubTabs (<md-tabs> primary)    |  |   |  | - Settings pinned  |  +--------------------+  |
|  | (Horizontal touch scrollable <375px)  |  |   |  |   in rail footer   |  | SubTabs (<md-tabs>)|  |
|  +---------------------------------------+  |   |  +--------------------+  +--------------------+  |
|                                             |   |                                                  |
|  +---------------------------------------+  |   |  +--------------------------------------------+  |
|  | Fluid Main (<main id="main">)         |  |   |  | Fluid Main (<main id="main">)              |  |
|  | pb-[calc(5rem + safe-area-bottom)]    |  |   |  | ml-[80px], full width grid expansion       |  |
|  +---------------------------------------+  |   |  +--------------------------------------------+  |
|                                             |   +--------------------------------------------------+
|  +---------------------------------------+  |
|  | NavigationBar (80dp, surfaceContainer)|  |
|  | 5 Destinations with Active Indicator |  |
|  | + safe-area-inset-bottom fill        |  |
|  +---------------------------------------+  |
+---------------------------------------------+
```

### Component Responsibility Table

| Component | File Path | Primary Responsibilities |
|-----------|-----------|--------------------------|
| `AppShell` | `apps/web/src/components/shell/AppShell.tsx` | Main responsive layout wrapper, scroll memory, skip link, document title synchronization. |
| `TopBar` | `apps/web/src/components/shell/TopBar.tsx` | 64px Small Top App Bar, single `<h1>`, scroll tonal tint (`surfaceContainer`), back navigation button, conditional settings button (`<600px`). |
| `NavigationBar` | `apps/web/src/components/shell/NavigationBar.tsx` *(new)* | Compact `<600px` fixed 80dp bottom navigation bar, 5 destinations with active indicator pills. |
| `NavigationRail` | `apps/web/src/components/shell/NavigationRail.tsx` *(new)* | Medium/Expanded `>=600px` fixed 80dp left rail, 5 primary destinations, inset divider, footer-pinned Settings destination. |
| `SubTabs` | `apps/web/src/components/shell/SubTabs.tsx` | MD3 Primary Tabs (`<md-tabs>` / `<md-primary-tab>`), controlled active index, window scroll reset to 0. |
| `HouseholdSwitcher` | `apps/web/src/components/shell/HouseholdSwitcher.tsx` | Top App Bar trigger button with `, switch household`, loading skeleton pill, `ModalBottomSheet` with single-membership guidance. |
| `MdFilterChip` | `apps/web/src/components/md/MdFilterChip.tsx` *(new)* | Typed `@lit/react` wrapper around `@material/web/chips/filter-chip.js`. |
| `RecipeLibraryScreen` | `apps/web/src/screens/meals/RecipeLibraryScreen.tsx` | Hosts "On sale / Ready now" `<md-filter-chip>`, syncs `?filter=ready` search param, displays empty filter card. |

### Pattern 1: MD3 Active Indicator Pill Styling
**What:** Active navigation destinations show a rounded pill container (`w-[56px] h-[32px] rounded-full bg-secondary-container text-on-secondary-container`) hugging the icon, rendered with `filled={true}` on the Material Symbol `Icon.tsx`, and font-weight 600 label text. Inactive destinations display outlined icons with `text-secondary` and font-weight 400.
**When to use:** In both `NavigationBar` (`<600px`) and `NavigationRail` (`>=600px`).
```tsx
// Source: MD3 Navigation Bar and Navigation Rail specifications
import { NavLink } from 'react-router';
import { Icon, type IconName } from '../ui/Icon.tsx';

interface NavItemProps {
  to: string;
  label: string;
  iconName: IconName;
  end?: boolean;
}

export function NavItem({ to, label, iconName, end }: NavItemProps): ReactElement {
  return (
    <NavLink
      to={to}
      end={end}
      className="group flex flex-col items-center justify-center gap-1 py-1 text-center outline-none"
    >
      {({ isActive }) => (
        <>
          <div
            className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-150 ${
              isActive
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-secondary hover:bg-surface-container-high'
            }`}
          >
            <Icon name={iconName} filled={isActive} size={24} />
          </div>
          <span
            className={`text-label truncate ${
              isActive ? 'font-semibold text-primary' : 'font-normal text-secondary'
            }`}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}
```

### Pattern 2: Scroll-Aware Small Top App Bar with Single `<h1>`
**What:** Top App Bar stays sticky at the top (`sticky top-0 z-20 h-16`). It detects scroll with a passive listener; when `scrollY > 4px`, it applies the `bg-surface-container` elevation tier 2 tint with smooth CSS transition (`transition-colors duration-200`). The screen title is always rendered inside `<h1 className="text-heading font-semibold truncate">`.
```tsx
// Source: MD3 Top App Bar guidelines & ScreenChromeProvider
import { useEffect, useState, type ReactElement } from 'react';
import { MdIconButton } from '../md/MdButton.tsx';
import { Icon } from '../ui/Icon.tsx';
import { HouseholdSwitcher, type HouseholdSwitcherProps } from './HouseholdSwitcher.tsx';
import type { ScreenChrome } from './screen-chrome.tsx';

export interface TopBarProps {
  title: string;
  switcher: HouseholdSwitcherProps;
  chrome?: ScreenChrome | undefined;
}

export function TopBar({ title, switcher, chrome }: TopBarProps): ReactElement {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = (): void => {
      setIsScrolled(window.scrollY > 4);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`flex h-16 items-center gap-3 px-4 transition-colors duration-200 ${
        isScrolled ? 'bg-surface-container' : 'bg-surface'
      }`}
    >
      <div className="flex shrink-0 items-center">
        {chrome ? (
          <MdIconButton
            aria-label={chrome.backLabel ? `Back to ${chrome.backLabel}` : 'Back'}
            onClick={() => window.history.back()}
          >
            <Icon name="arrow_back" size={24} />
          </MdIconButton>
        ) : (
          <HouseholdSwitcher {...switcher} />
        )}
      </div>

      <h1 className="min-w-0 flex-1 truncate text-heading font-semibold text-primary">
        {title}
      </h1>

      {/* Settings icon button: rendered on mobile (<600px) only; rail provides it on >=600px */}
      <div className="flex shrink-0 items-center min-[600px]:hidden">
        <MdIconButton
          aria-label="Open settings"
          onClick={() => {
            /* navigate to /settings */
          }}
        >
          <Icon name="settings" size={24} />
        </MdIconButton>
      </div>
    </div>
  );
}
```

### Pattern 3: SubTabs Migration to `<md-tabs>` with Scroll Reset
**What:** `SubTabs` maps `pillar.subTabs` to `<md-primary-tab>`. `activeTabIndex` is calculated by matching the current pathname with tab paths. Switching tabs calls `navigate(tab.path)` and immediately invokes `window.scrollTo(0, 0)` (D-15).
```tsx
import type { ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { MdPrimaryTab, MdTabs } from '../md/MdTabs.tsx';
import { activeSubTab, type Pillar } from '../../lib/sections.ts';

export function SubTabs({ pillar }: { pillar: Pillar }): ReactElement {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = activeSubTab(pillar, pathname) ?? pillar.subTabs[0];
  const activeIndex = pillar.subTabs.findIndex((t) => t.path === current?.path);

  return (
    <nav aria-label={`${pillar.label} sections`} className="overflow-x-auto no-scrollbar">
      <MdTabs
        activeTabIndex={activeIndex >= 0 ? activeIndex : 0}
        onChange={(event) => {
          const tabIndex = (event.target as { activeTabIndex: number }).activeTabIndex;
          const nextTab = pillar.subTabs[tabIndex];
          if (nextTab && nextTab.path !== pathname) {
            void navigate(nextTab.path);
            window.scrollTo(0, 0);
          }
        }}
      >
        {pillar.subTabs.map((tab) => (
          <MdPrimaryTab key={tab.path} label={tab.label} />
        ))}
      </MdTabs>
    </nav>
  );
}
```

### Anti-Patterns to Avoid
- **Arbitrary Breakpoints (1025px layout cliff):** Do not use Tailwind's `lg:pl-56` or `1024px` media queries. MD3 window size classes specify `600px` (`min-width: 600px`) as the breakpoint where compact bottom navigation adapts to the 80dp rail.
- **Multiple `<h1>` Elements per Route:** Do not place an `<h1>` inside screen body components when Top App Bar already renders `<h1>{title}</h1>`. Demote inner headings to `<h2>` or visually hide them.
- **Breaking Playwright Locators:** Do not change the switcher trigger accessible name away from `/switch household$/` or the dialog title away from "Households".
- **Hardcoded 1px Borders on App Bar:** MD3 replaces harsh 1px borders with scroll-driven elevation color changes (`surface` -> `surfaceContainer`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sliding tab indicator animation | Custom CSS underline calculation | `<md-tabs>` / `<md-primary-tab>` | Lit component handles indicator morphing, keyboard roving tabindex, and touch gestures natively. |
| Modal Bottom Sheet | Custom overlay + animation CSS | `ModalBottomSheet.tsx` (`<dialog>.showModal()`) | Native `<dialog>` top-layer handles focus trapping, scroll locking, and backdrop clicks natively. |
| Filter Chip with Checkmark | Custom button + conditional checkmark SVG | `<md-filter-chip>` (`MdFilterChip.tsx`) | `@material/web` filter chip includes built-in elevation, ripple, leading checkmark slot, and accessible toggle states. |

## Runtime State Inventory

> Phase 18 is a refactor and route migration phase. The 5 runtime state categories have been audited:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None. Database schema, Supabase tables, and IndexedDB cache keys do not store route paths. Old route `/meals/suggestions` redirects to `/meals/recipes?filter=ready`. | No data migration required. |
| **Live service config** | None. Fastify API routes and push notifications do not reference UI shell components or sub-tab paths. | None. |
| **OS-registered state** | None. Web App Manifest start URL is `/` (unchanged). | None. |
| **Secrets/env vars** | None. | None. |
| **Build artifacts / installed packages** | Legacy files `apps/web/src/lib/section-context.tsx` and `apps/web/src/components/states/SubSectionComingSoon.tsx` slated for deletion. | Delete files, update imports, verify `pnpm build` passes under 200 KB budget, and ensure Knip baseline matches. |

## Common Pitfalls

### Pitfall 1: Duplicate `<h1>` Violations in Axe-Core
**What goes wrong:** Accessibility audits fail with `page-has-heading-one` or `landmark-unique` errors due to multiple `<h1>` elements.
**Why it happens:** The TopBar renders `<h1>{title}</h1>`, but pushed detail screens (`RecipeDetailScreen`, `ChoreDetailScreen`, `ChoreFormScreen`) historically rendered their own `<h1>` in the page body [VERIFIED: RecipeDetailScreen.tsx:119, ChoreDetailScreen.tsx:122, ChoreFormScreen.tsx:275].
**How to avoid:** Demote all inner screen headings in detail/form screens to `<h2>`, and ensure `useScreenChrome` synchronizes the title with the TopBar's single `<h1>`.

### Pitfall 2: Breaking E2E Locators for Household Switcher
**What goes wrong:** Playwright tests fail with `locator.click: Target closed` or timeout waiting for switcher button.
**Why it happens:** `e2e/support/app.ts` relies on `page.getByRole('button', { name: /switch household$/ })` [VERIFIED: e2e/support/app.ts:5-7].
**How to avoid:** Ensure the switcher trigger retains `<span className="sr-only">, switch household</span>` immediately following the active household name.

### Pitfall 3: Dangling Imports to Deleted `SectionProvider`
**What goes wrong:** Build fails with `Cannot find module '../../lib/section-context.tsx'`.
**Why it happens:** `ModalBottomSheet.tsx` currently imports `useSection()` and applies `data-section={section}` [VERIFIED: ModalBottomSheet.tsx:9, 54, 159].
**How to avoid:** Remove `useSection` and `data-section` from `ModalBottomSheet.tsx` when deleting `section-context.tsx`.

### Pitfall 4: Shell Budget Overrun
**What goes wrong:** `pnpm build` fails `scripts/check-build.mjs` with "App shell is X KB gzipped, over the 200 KB budget".
**Why it happens:** Eagerly importing unneeded `@material/web` elements or importing `@material/web/all.js`.
**How to avoid:** Only import the specific subpath modules needed (`@material/web/tabs/tabs.js`, `@material/web/tabs/primary-tab.js`, `@material/web/chips/filter-chip.js`).

## Code Examples

### 1. `MdFilterChip` Lit React Wrapper
```typescript
// apps/web/src/components/md/MdFilterChip.tsx
import { createComponent } from '@lit/react';
import { MdFilterChip as MdFilterChipElement } from '@material/web/chips/filter-chip.js';
import * as React from 'react';

export const MdFilterChip = createComponent({
  react: React,
  tagName: 'md-filter-chip',
  elementClass: MdFilterChipElement,
  events: {
    onChange: 'change',
    onInput: 'input',
  },
});
```

### 2. "On sale / Ready now" Recipe Filter Implementation
```typescript
// apps/web/src/screens/meals/RecipeLibraryScreen.tsx
import { useSearchParams } from 'react-router';
import { MdFilterChip } from '../../components/md/MdFilterChip.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';

// In RecipeLibraryScreen:
const [searchParams, setSearchParams] = useSearchParams();
const filterReady = searchParams.get('filter') === 'ready';

const handleToggleFilter = (): void => {
  const next = new URLSearchParams(searchParams);
  if (filterReady) {
    next.delete('filter');
  } else {
    next.set('filter', 'ready');
  }
  setSearchParams(next, { replace: true });
};

// Filter predicate: has items in pantry or on sale (readiness > 0)
const readyMatches = filterReady
  ? matches.filter((r) => r.inPantryCount > 0 || r.onSaleCount > 0)
  : matches;

// Empty state when filter active and 0 matches:
if (filterReady && readyMatches.length === 0) {
  return (
    <Card className="flex flex-col items-center gap-3 p-6 text-center bg-surface-container-low">
      <h2 className="text-heading font-semibold text-primary">No matching recipes</h2>
      <p className="text-body text-secondary max-w-md">
        No recipes have ingredients currently in your pantry or on sale. Try clearing the filter or adding ingredients to your pantry.
      </p>
      <Button variant="secondary" onClick={handleToggleFilter}>
        Clear recipe filter
      </Button>
    </Card>
  );
}
```

## State of the Art

| Old Approach | Current MD3 Approach | Impact |
|--------------|----------------------|--------|
| `1025px` layout cliff (`lg:pl-56` sidebar) | `600px` Window Size Class (80dp `NavigationRail`) | Smooth transition to rail at 600px; expands dashboard/planner to full desktop width. |
| `SegmentedControl` (radiogroup) in `SubTabs` | `<md-tabs>` / `<md-primary-tab>` Primary Tabs | Native MD3 indicator sliding, accessible ARIA tablist/tab semantics, horizontal scroll on narrow viewports. |
| 3 Meals sub-tabs (`Planner \| Recipes \| Suggestions`) | 2 Meals sub-tabs (`Planner \| Recipes`) + Filter Chip | Streamlines navigation; folds suggestions directly into recipe library with `?filter=ready`. |
| Screen body duplicate `<h1>` headings | Top App Bar single `<h1>` ownership | Completely eliminates axe-core accessibility heading errors. |
| `SectionProvider` + `[data-section]` color ramps | Unified Warm Terracotta `--md-sys-*` tokens | Eliminates legacy custom context and dead CSS color overrides. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Browser `window.history.back()` is appropriate for the TopBar back button when `chrome.backTo` is provided. | Architecture Patterns | If user lands via deep link, `window.history.back()` could exit app. Recommend using `<Link to={chrome.backTo}>` (styled with `MdIconButton` or icon button classes) to guarantee predictable route push/pop behavior. |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.1 (`jsdom` for DOM project, `node` for unit) |
| Config file | `apps/web/vite.config.ts` |
| Quick run command | `pnpm --filter @hestia/web test run src/components/shell/shell.test.tsx` |
| Full suite command | `pnpm --filter @hestia/web test run && pnpm --filter @hestia/e2e test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | Viewport `<600px` renders `NavigationBar`; `>=600px` renders `NavigationRail` with bottom-pinned Settings. | Component / E2E | `pnpm --filter @hestia/web test run src/components/shell/shell.test.tsx` | ✅ Wave 0 update |
| NAV-02 | Top App Bar owns single `<h1>`; detail screens demoted to `<h2>`; scroll changes tint. | Component / a11y | `pnpm --filter @hestia/web test run src/components/shell/shell.test.tsx` | ✅ Wave 0 update |
| NAV-03 | `SubTabs` renders `<md-tabs>` with `role="tablist"` and resets scroll; `HouseholdSwitcher` handles 1 membership. | Component | `pnpm --filter @hestia/web test run src/components/shell/shell.test.tsx` | ✅ Wave 0 update |
| NAV-04 | `/meals/suggestions` redirects to `/meals/recipes?filter=ready`; "On sale / Ready now" chip filters recipes. | Component / Unit | `pnpm --filter @hestia/web test run src/screens/meals/` | ✅ Wave 0 update |

### Wave 0 Gaps
- [ ] `apps/web/src/components/shell/shell.test.tsx`: Update existing tests from `role="radiogroup"` (`SegmentedControl`) to `role="tablist"` / `role="tab"` (`<md-tabs>`), remove tests for deleted `SectionProvider`, and verify single-membership copy.
- [ ] `apps/web/src/components/md/MdFilterChip.tsx`: New wrapper file needed for `@material/web/chips/filter-chip.js`.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | Yes | Household switching must verify user membership against active session before switching context; already enforced in `useProfile` and API RLS. |
| V5 Input Validation | Yes | URL search param `?filter=ready` parsed safely without eval or open redirect vulnerabilities. |

### Known Threat Patterns for Web Shell
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open Redirect via Back Navigation | Spoofing | Top App Bar back button uses internal route path (`chrome.backTo`) rather than arbitrary external query params. |
| DOM-based XSS via Title Sync | Tampering | Screen chrome title is rendered via React text interpolation (`{title}`), never `dangerouslySetInnerHTML`. |

## Sources

### Primary (HIGH confidence)
- `apps/web/src/components/shell/AppShell.tsx`, `TopBar.tsx`, `TabBar.tsx`, `SubTabs.tsx`, `HouseholdSwitcher.tsx` - In-repo component sources.
- `apps/web/src/components/md/MdTabs.tsx`, `MdButton.tsx` - Existing Lit wrappers.
- `apps/web/node_modules/@material/web/chips/filter-chip.d.ts` - Verified `@material/web/chips/filter-chip.js` export.
- `e2e/support/app.ts` - Playwright navigation locators.
- `apps/web/scripts/check-build.mjs` - Shell budget constraints.

### Secondary (MEDIUM confidence)
- Material Design 3 Navigation Specifications (Navigation Bar, Navigation Rail, Small Top App Bar, Primary Tabs).

