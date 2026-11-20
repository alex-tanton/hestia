---
phase: 18-adaptive-md3-navigation-shell-route-chrome
reviewed: 2026-11-15T03:35:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - apps/web/src/components/dashboard/DashboardCard.tsx
  - apps/web/src/components/dashboard/DashboardFirstRun.tsx
  - apps/web/src/components/md/MdFilterChip.tsx
  - apps/web/src/components/meals/meal-copy.ts
  - apps/web/src/components/shell/AppShell.tsx
  - apps/web/src/components/shell/HouseholdSwitcher.tsx
  - apps/web/src/components/shell/NavigationBar.tsx
  - apps/web/src/components/shell/NavigationRail.tsx
  - apps/web/src/components/shell/SubTabs.tsx
  - apps/web/src/components/shell/TopBar.tsx
  - apps/web/src/components/states/ComingSoon.tsx
  - apps/web/src/components/ui/ConfirmDialog.tsx
  - apps/web/src/components/ui/ModalBottomSheet.tsx
  - apps/web/src/components/ui/OverflowMenu.tsx
  - apps/web/src/lib/sections.ts
  - apps/web/src/pillars/lists/ListsRoute.tsx
  - apps/web/src/pillars/meals/MealsRoute.tsx
  - apps/web/src/screens/chores/ChoreDetailScreen.tsx
  - apps/web/src/screens/chores/ChoreFormScreen.tsx
  - apps/web/src/screens/meals/RecipeDetailScreen.tsx
  - apps/web/src/screens/meals/RecipeLibraryScreen.tsx
  - apps/web/src/screens/onboarding/FavoriteStoresStep.tsx
  - apps/web/src/screens/onboarding/OnboardingLayout.tsx
  - apps/web/src/screens/settings/HouseholdSettingsSection.tsx
  - apps/web/src/styles/gap-primitives.css
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-11-15T03:35:00Z  
**Depth:** standard  
**Files Reviewed:** 25  
**Status:** issues_found  

## Summary

The Phase 18 implementation introduced Material Design 3 adaptive navigation shells (`NavigationBar` and `NavigationRail`), converted `SubTabs` to MD3 Primary Tabs (`<md-tabs>` / `<md-primary-tab>`), migrated `HouseholdSwitcher` to `ModalBottomSheet`, established single-`<h1>` heading hierarchy in `TopBar`, and consolidated Meals navigation with the `MdFilterChip` component.

However, an adversarial standard review identified critical issues:
1. **Rogue automatic redirection on nested sub-tab routes in `SubTabs.tsx`:** When `<MdTabs>` initializes on nested routes like `/lists/flyers/:flyerId`, it dispatches a custom `change` event. Because `SubTabs.tsx` does not check if the activated tab matches the currently active tab index (`tabIndex === activeIndex`), it compares the tab path `/lists/flyers` against the subpath `/lists/flyers/:flyerId` and immediately navigates away from the nested route, redirecting users back to the root tab and breaking `FlyerItemsScreen` in tests and production.
2. **Broken unit test suites from heading demotions:** Demoting body headings from `<h1>` to `<h2>` in `RecipeDetailScreen.tsx` and `ChoreDetailScreen.tsx` broke 15+ existing unit tests in `recipe-detail.test.tsx`, `chores.test.tsx`, and `household-timezone.test.tsx` which mount screens in isolation and assert `{ level: 1 }`.
3. **Stale route assertion in `shell.test.tsx`:** Pruning `/meals/suggestions` from `MEALS.subTabs` broke `shell.test.tsx`'s `titleForPath` test suite, which was not updated during the consolidation.
4. **State desynchronization & accessibility defects:** `RecipeLibraryScreen` toggles the readiness filter without resetting page to 1, potentially leaving users stranded on an empty page, and `NavigationBar` / `NavigationRail` suppress default focus outlines with `outline-none` without providing visible `focus-visible` styles.

---

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: Rogue auto-navigation on nested sub-tab routes in `SubTabs.tsx`

**File:** `apps/web/src/components/shell/SubTabs.tsx:27-34`  
**Classification:** BLOCKER  
**Issue:**  
When `SubTabs` mounts on a nested subpath (such as `/lists/flyers/:flyerId` in `DealsFrame`), `activeIndex` is computed as the index of `/lists/flyers` (index 2). When `@material/web` initializes `<md-tabs>`, it transitions selection and dispatches a `change` event.

In `SubTabs.tsx`:
```tsx
const tabIndex =
  eventWithDetail.detail?.activeTabIndex ??
  currentTarget?.activeTabIndex ??
  target?.activeTabIndex;
if (typeof tabIndex === 'number') {
  const nextTab = pillar.subTabs[tabIndex];
  if (nextTab && nextTab.path !== pathname) {
    void navigate(nextTab.path);
    window.scrollTo(0, 0);
  }
}
```
Because `nextTab.path` is `'/lists/flyers'` and `pathname` is `'/lists/flyers/:flyerId'`, `nextTab.path !== pathname` is `true`. As a result, `SubTabs` immediately calls `navigate('/lists/flyers')` on component mount. This forces a rogue navigation that ejects users from any nested screen rendered inside `PillarScreen`, and causes 4 tests in `src/screens/deals/flyers.test.tsx` to crash with React Router 404 errors.

**Fix:**  
Guard tab change navigation so that navigation only executes when the activated tab index differs from the current active tab index (`tabIndex !== activeIndex`):
```tsx
if (typeof tabIndex === 'number' && tabIndex !== activeIndex) {
  const nextTab = pillar.subTabs[tabIndex];
  if (nextTab) {
    void navigate(nextTab.path);
    window.scrollTo(0, 0);
  }
}
```

---

#### CR-02: Heading demotions broke isolated screen unit tests across test suites

**File:** `apps/web/src/screens/meals/RecipeDetailScreen.tsx:126`, `apps/web/src/screens/chores/ChoreDetailScreen.tsx:122`  
**Classification:** BLOCKER  
**Issue:**  
To establish a single-`<h1>` document outline owned by `TopBar.tsx`, Plan 18-01 Task 2 demoted screen title headings from `<h1>` to `<h2>` in `RecipeDetailScreen.tsx` and `ChoreDetailScreen.tsx`.

However, the unit test suites `apps/web/src/screens/meals/recipe-detail.test.tsx`, `apps/web/src/screens/chores/chores.test.tsx`, and `apps/web/src/screens/meals/household-timezone.test.tsx` test these screens in isolation using `renderScreen(...)`, which does not mount `TopBar` (since `TopBar` is part of `AppShell`). The test suites still query `screen.findByRole('heading', { level: 1 })` and fail:
- 10 tests fail in `recipe-detail.test.tsx` (lines 81, 157, 242, 308, 336, 363, 374, 384, 400, 438)
- 3 tests fail in `chores.test.tsx` (lines 417, 447, 487)
- 2 tests fail in `household-timezone.test.tsx` (lines 182, 191)

The plan summary reported passing tests because only `shell.test.tsx` was executed rather than the monorepo test suite.

**Fix:**  
Update the queries in `recipe-detail.test.tsx`, `chores.test.tsx`, and `household-timezone.test.tsx` to query `{ level: 2 }` or query by heading accessible name without restricting to `level: 1`:
```tsx
// In recipe-detail.test.tsx, chores.test.tsx, and household-timezone.test.tsx:
await screen.findByRole('heading', { level: 2, name: 'Sheet Pan Chicken and Vegetables' });
```

---

#### CR-03: Stale `/meals/suggestions` sub-tab test case in `shell.test.tsx`

**File:** `apps/web/src/components/shell/shell.test.tsx:163`  
**Classification:** BLOCKER  
**Issue:**  
Plan 18-03 removed `/meals/suggestions` from `MEALS.subTabs` in `apps/web/src/lib/sections.ts` and redirected the route to `/meals/recipes?filter=ready`. However, `shell.test.tsx` line 163 still asserts that `titleForPath('/meals/suggestions')` returns `'Suggestions'`:
```tsx
describe('titleForPath', () => {
  it.each([
    ...
    ['/meals/suggestions', 'Suggestions'],
    ...
  ])('%s → %s', (path, title) => { ... });
});
```
Because `/meals/suggestions` is no longer a recognized sub-tab in `MEALS.subTabs`, `titleForPath` returns `'Meals'`, causing `shell.test.tsx` to fail with:
`AssertionError: expected 'Meals' to be 'Suggestions'`.

**Fix:**  
Update the test case in `apps/web/src/components/shell/shell.test.tsx:163` to reflect the consolidated routing:
```tsx
['/meals/recipes', 'Recipes'],
```

---

### Warnings

#### WR-01: RecipeLibraryScreen pagination not reset when toggling readiness filter

**File:** `apps/web/src/screens/meals/RecipeLibraryScreen.tsx:51-59, 108-121`  
**Classification:** WARNING  
**Issue:**  
`RecipeLibraryScreen` performs client-side readiness filtering on the currently loaded page of recipes. When searching via `search`, `setPage(1)` is called because filtering within paginated server results requires returning to page 1. However, `handleToggleFilter` does not call `setPage(1)`:
```tsx
const handleToggleFilter = (): void => {
  const next = new URLSearchParams(searchParams);
  if (filterReady) {
    next.delete('filter');
  } else {
    next.set('filter', 'ready');
  }
  setSearchParams(next, { replace: true });
};
```
If a user is on page 2 (or beyond) and toggles "On sale / Ready now", `page` remains at 2. If page 2 has 0 ready recipes (even though page 1 has multiple ready recipes), the component displays the empty state card and hides the `Pagination` controls, stranding the user on an empty page without ability to paginate back.

**Fix:**  
Reset page to 1 whenever toggling the filter:
```tsx
const handleToggleFilter = (): void => {
  setPage(1);
  const next = new URLSearchParams(searchParams);
  if (filterReady) {
    next.delete('filter');
  } else {
    next.set('filter', 'ready');
  }
  setSearchParams(next, { replace: true });
};
```

---

#### WR-02: Missing keyboard focus indicator on NavigationBar and NavigationRail (WCAG 2.4.7)

**File:** `apps/web/src/components/shell/NavigationBar.tsx:28`, `apps/web/src/components/shell/NavigationRail.tsx:31, 64`  
**Classification:** WARNING  
**Issue:**  
`NavLink` elements in both `NavigationBar` and `NavigationRail` specify `outline-none` but provide no replacement `focus-visible` styling (such as `focus-visible:ring-2` or `focus-visible:outline-2` used elsewhere in the design system):
```tsx
className="group flex flex-col items-center justify-center gap-1 py-1 text-center outline-none"
```
When keyboard users tab through primary navigation destinations or Settings, there is no visible focus indicator showing which destination is focused, violating WCAG 2.4.7 Focus Visible (Level AA).

**Fix:**  
Add `focus-visible` ring/outline classes to the `NavLink` elements:
```tsx
className="group flex flex-col items-center justify-center gap-1 py-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded-lg"
```

---

#### WR-03: Transparent safe-area header padding causes content bleed-through on iOS

**File:** `apps/web/src/components/shell/AppShell.tsx:100`  
**Classification:** WARNING  
**Issue:**  
In `AppShell.tsx`, `<header>` has:
```tsx
<header className="sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
  <TopBar title={title} switcher={switcher} chrome={chrome} />
  ...
</header>
```
The background color `bg-base` was removed from `<header>` in commit `860fa32` so `TopBar` can apply its own dynamic background tinting. However, because `pt-[env(safe-area-inset-top)]` is on `<header>` outside and above `<TopBar>`, the notch/status-bar safe area is completely transparent. On mobile devices with notches (iOS Safari/PWA), scrolled content will visibly bleed through the status bar above `TopBar`.

**Fix:**  
Add a background matching the default surface tone to `<header>` or move the safe-area padding into `TopBar` so that the tinted background extends to the device edge.

---

#### WR-04: Initial scroll state desynchronization in TopBar on mount

**File:** `apps/web/src/components/shell/TopBar.tsx:18-26`  
**Classification:** WARNING  
**Issue:**  
In `TopBar.tsx`, `isScrolled` is initialized to `false` and is only evaluated inside the `onScroll` callback attached to `window.addEventListener('scroll', onScroll)`. If a user navigates to a screen where the page is already scrolled (or on page reload / browser history back-forward restore), `isScrolled` remains `false` until the user scrolls, displaying an untinted background even when `window.scrollY > 4`.

**Fix:**  
Invoke `onScroll()` once immediately upon mounting inside `useEffect`:
```tsx
useEffect(() => {
  const onScroll = (): void => {
    setIsScrolled(window.scrollY > 4);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    window.removeEventListener('scroll', onScroll);
  };
}, []);
```

---

### Info

#### IN-01: Empty `<p>` element rendered in `ComingSoonPanel`

**File:** `apps/web/src/components/states/ComingSoon.tsx:46`  
**Classification:** INFO  
**Issue:**  
When `comingSoon` copy was removed from `Pillar` definitions in `sections.ts`, `ComingSoon` was updated to pass `message=""` to `<ComingSoonPanel icon={pillar.icon} message="" />`. `ComingSoonPanel` unconditionally renders `<p className="max-w-[70ch] text-body text-secondary">{message}</p>`, resulting in an empty `<p>` element in the DOM when an unreleased pillar is displayed.

**Fix:**  
Conditionally render the paragraph only when `message` is non-empty:
```tsx
{message ? <p className="max-w-[70ch] text-body text-secondary">{message}</p> : null}
```

---

#### IN-02: Redundant Settings icon button in TopBar on `/settings`

**File:** `apps/web/src/components/shell/TopBar.tsx:50-58`  
**Classification:** INFO  
**Issue:**  
On compact viewports (`<600px`), `TopBar` renders a Settings icon button on the right side. When the user is already on `/settings`, the header displays the title "Settings" and also renders the Settings button linking to `/settings` with no active state or aria-current indicator.

**Fix:**  
Hide the Settings button when already on `/settings`, or render it with `aria-current="page"`.

---

_Reviewed: 2026-11-15T03:35:00Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: standard_  
