# Phase 18: Adaptive MD3 Navigation Shell & Route Chrome - Pattern Map

**Mapped:** 2026-11-15  
**Files analyzed:** 18 (3 new, 11 modified, 4 deleted/consolidated)  
**Analogs found:** 18 / 18  

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/src/components/shell/NavigationBar.tsx` | component | request-response | `apps/web/src/components/shell/TabBar.tsx` | exact |
| `apps/web/src/components/shell/NavigationRail.tsx` | component | request-response | `apps/web/src/components/shell/TabBar.tsx` | exact |
| `apps/web/src/components/md/MdFilterChip.tsx` | component | request-response | `apps/web/src/components/md/MdTabs.tsx` | exact |
| `apps/web/src/components/shell/AppShell.tsx` | component | request-response | `apps/web/src/components/shell/AppShell.tsx` | exact |
| `apps/web/src/components/shell/TopBar.tsx` | component | request-response | `apps/web/src/components/shell/TopBar.tsx` | exact |
| `apps/web/src/components/shell/SubTabs.tsx` | component | request-response | `apps/web/src/components/shell/SubTabs.tsx` | exact |
| `apps/web/src/components/shell/HouseholdSwitcher.tsx` | component | request-response | `apps/web/src/components/ui/ModalBottomSheet.tsx` | exact |
| `apps/web/src/lib/sections.ts` | config | transform | `apps/web/src/lib/sections.ts` | exact |
| `apps/web/src/pillars/lists/ListsRoute.tsx` | route | request-response | `apps/web/src/pillars/lists/ListsRoute.tsx` | exact |
| `apps/web/src/pillars/meals/MealsRoute.tsx` | route | request-response | `apps/web/src/pillars/meals/MealsRoute.tsx` | exact |
| `apps/web/src/screens/meals/RecipeLibraryScreen.tsx` | component | request-response | `apps/web/src/screens/meals/RecipeLibraryScreen.tsx` | exact |
| `apps/web/src/screens/meals/RecipeDetailScreen.tsx` | component | request-response | `apps/web/src/screens/bills/BillDetailScreen.tsx` | exact |
| `apps/web/src/screens/chores/ChoreDetailScreen.tsx` | component | request-response | `apps/web/src/screens/bills/BillDetailScreen.tsx` | exact |
| `apps/web/src/screens/chores/ChoreFormScreen.tsx` | component | request-response | `apps/web/src/screens/bills/BillDetailScreen.tsx` | exact |
| `apps/web/src/components/ui/ModalBottomSheet.tsx` | component | request-response | `apps/web/src/components/ui/ModalBottomSheet.tsx` | exact |
| `apps/web/src/components/shell/shell.test.tsx` | test | request-response | `apps/web/src/components/shell/shell.test.tsx` | exact |
| `apps/web/src/screens/meals/recipe-library.test.tsx` | test | request-response | `apps/web/src/screens/meals/recipe-library.test.tsx` | exact |
| `scripts/knip-production-baseline.txt` | config | batch | `scripts/knip-production-baseline.txt` | exact |

---

## Pattern Assignments

### 1. `apps/web/src/components/shell/NavigationBar.tsx` (component, request-response)

**Analog:** `apps/web/src/components/shell/TabBar.tsx`

**Imports pattern** (lines 1-4):
```typescript
import type { ReactElement } from 'react';
import { NavLink } from 'react-router';
import { Icon, type IconName } from '../ui/Icon.tsx';
import { TABS } from '../../lib/sections.ts';
```

**Core pattern** (lines 11-46 adapted to MD3 Active Indicator Pill):
```typescript
export function NavigationBar(): ReactElement {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex h-20 min-h-[80px] items-center justify-around bg-surface-container pb-[env(safe-area-inset-bottom)] min-[600px]:hidden"
    >
      <ul className="flex w-full items-center justify-around px-2">
        {TABS.map((tab) => {
          const iconName = tab.id as IconName;
          return (
            <li key={tab.id} className="flex-1">
              <NavLink
                to={tab.path}
                end={tab.path === '/'}
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
                      {tab.label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

---

### 2. `apps/web/src/components/shell/NavigationRail.tsx` (component, request-response)

**Analog:** `apps/web/src/components/shell/TabBar.tsx`

**Imports pattern**:
```typescript
import type { ReactElement } from 'react';
import { NavLink } from 'react-router';
import { Icon, type IconName } from '../ui/Icon.tsx';
import { TABS } from '../../lib/sections.ts';
```

**Core pattern** (MD3 80dp fixed rail with top-aligned destinations, inset divider, and bottom-pinned Settings):
```typescript
export function NavigationRail(): ReactElement {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center justify-between border-r border-border bg-surface py-4 min-[600px]:flex"
    >
      <div className="flex w-full flex-col items-center gap-3">
        {/* Top spacer / brand anchor */}
        <div className="flex h-12 w-12 items-center justify-center" />
        <ul className="flex w-full flex-col items-center gap-2 px-1">
          {TABS.map((tab) => {
            const iconName = tab.id as IconName;
            return (
              <li key={tab.id} className="w-full">
                <NavLink
                  to={tab.path}
                  end={tab.path === '/'}
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
                        {tab.label}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex w-full flex-col items-center gap-2 px-1 pb-2">
        <hr className="w-12 border-border" />
        <NavLink
          to="/settings"
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
                <Icon name="settings" filled={isActive} size={24} />
              </div>
              <span
                className={`text-label truncate ${
                  isActive ? 'font-semibold text-primary' : 'font-normal text-secondary'
                }`}
              >
                Settings
              </span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}
```

---

### 3. `apps/web/src/components/md/MdFilterChip.tsx` (component, request-response)

**Analog:** `apps/web/src/components/md/MdTabs.tsx`

**Imports & Core pattern** (lines 1-19 of `MdTabs.tsx` applied to filter chip):
```typescript
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

---

### 4. `apps/web/src/components/shell/AppShell.tsx` (component, request-response)

**Analog:** `apps/web/src/components/shell/AppShell.tsx`

**Imports pattern** (lines 1-18 with legacy `SectionProvider` and `TabBar` replaced):
```typescript
import { useEffect, useLayoutEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import {
  PILLARS,
  RELEASED_PILLARS,
  activeSubTab,
  sectionForPath,
  type SectionId,
} from '../../lib/sections.ts';
import { useWriteQueue } from '../../lib/offline/use-write-queue.ts';
import { ToastProvider } from '../ui/Toast.tsx';
import type { HouseholdSwitcherProps } from './HouseholdSwitcher.tsx';
import { OfflineBanner } from './OfflineBanner.tsx';
import { ScreenChromeProvider, useCurrentScreenChrome } from './screen-chrome.tsx';
import { NavigationBar } from './NavigationBar.tsx';
import { NavigationRail } from './NavigationRail.tsx';
import { TopBar } from './TopBar.tsx';
```

**Layout container pattern** (lines 90-119 modified to 600px window size classes and fluid `<main>`):
```typescript
return (
  <div className="min-h-dvh bg-base text-primary">
    <ToastProvider>
      <WriteQueue />
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-base px-4 py-3 text-body font-semibold text-section focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:px-4 focus:py-3"
      >
        Skip to main content
      </a>
      <div className="min-[600px]:pl-20">
        <header className="sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
          <TopBar title={title} switcher={switcher} chrome={chrome} />
          <OfflineBanner />
          {updatePrompt}
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] outline-none min-[600px]:pb-8"
        >
          {children}
        </main>
      </div>
      <NavigationBar />
      <NavigationRail />
    </ToastProvider>
  </div>
);
```

---

### 5. `apps/web/src/components/shell/TopBar.tsx` (component, request-response)

**Analog:** `apps/web/src/components/shell/TopBar.tsx`

**Imports pattern** (lines 1-8 replacing lucide icons with `Icon.tsx` and `MdIconButton`):
```typescript
import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router';
import { MdIconButton } from '../md/MdButton.tsx';
import { Icon } from '../ui/Icon.tsx';
import { HouseholdSwitcher, type HouseholdSwitcherProps } from './HouseholdSwitcher.tsx';
import type { ScreenChrome } from './screen-chrome.tsx';
```

**Core pattern** (lines 17-50 rewritten for scroll-aware tonal tint and single `<h1>`):
```typescript
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
          <Link
            to={chrome.backTo}
            aria-label={chrome.backLabel ? `Back to ${chrome.backLabel}` : 'Back'}
            className="flex h-10 w-10 items-center justify-center rounded-full text-secondary hover:bg-surface-container-high"
          >
            <Icon name="arrow_back" size={24} />
          </Link>
        ) : (
          <HouseholdSwitcher {...switcher} />
        )}
      </div>

      <h1 className="min-w-0 flex-1 truncate text-heading font-semibold text-primary">
        {title}
      </h1>

      <div className="flex shrink-0 items-center min-[600px]:hidden">
        <Link
          to="/settings"
          aria-label="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-full text-secondary hover:bg-surface-container-high"
        >
          <Icon name="settings" size={24} />
        </Link>
      </div>
    </div>
  );
}
```

---

### 6. `apps/web/src/components/shell/SubTabs.tsx` (component, request-response)

**Analog:** `apps/web/src/components/shell/SubTabs.tsx` & `apps/web/src/components/md/MdTabs.tsx`

**Imports & Core pattern** (replacing `SegmentedControl` with `MdTabs` / `MdPrimaryTab` and scroll-to-top reset):
```typescript
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

---

### 7. `apps/web/src/components/shell/HouseholdSwitcher.tsx` (component, request-response)

**Analog:** `apps/web/src/components/ui/ModalBottomSheet.tsx` & `apps/web/src/components/shell/HouseholdSwitcher.tsx`

**Core trigger & modal bottom sheet pattern** (migrating to `ModalBottomSheet` and single-membership copy):
```typescript
import { useState, type ReactElement } from 'react';
import { Icon } from '../ui/Icon.tsx';
import { ListRow } from '../ui/ListRow.tsx';
import { ModalBottomSheet } from '../ui/ModalBottomSheet.tsx';
import { Skeleton } from '../ui/Skeleton.tsx';

export function HouseholdSwitcher({
  households,
  activeHouseholdId,
  onSelect,
  onJoinOrCreate,
}: HouseholdSwitcherProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const active = households?.find((household) => household.id === activeHouseholdId);

  if (!households) {
    return (
      <span role="status" className="flex min-h-11 items-center">
        <span className="sr-only">Loading households</span>
        <Skeleton className="h-5 w-28 rounded-full" />
      </span>
    );
  }

  const isSingleHousehold = households.length === 1;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex min-h-11 max-w-full min-w-0 items-center gap-1 rounded-md px-2 text-body font-semibold text-primary transition-colors duration-150 ease-out hover:bg-surface-container-high"
      >
        <span className="truncate">{active?.name ?? 'Choose a household'}</span>
        <Icon name="expand_more" size={20} className="shrink-0 text-secondary" />
        <span className="sr-only">, switch household</span>
      </button>

      <ModalBottomSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Households"
        description={isSingleHousehold ? 'No other households' : undefined}
      >
        <ul className="divide-y divide-border">
          {households.map((household) => {
            const isActive = household.id === activeHouseholdId;
            return (
              <li key={household.id}>
                <ListRow
                  title={household.name}
                  description={memberCountLabel(household.memberCount)}
                  isCurrent={isActive}
                  leading={
                    <span className="flex size-5 items-center justify-center">
                      {isActive && <Icon name="check" size={20} />}
                    </span>
                  }
                  trailing={
                    isActive ? (
                      <span className="text-caption text-secondary">Current</span>
                    ) : undefined
                  }
                  onSelect={() => {
                    setIsOpen(false);
                    if (!isActive) onSelect(household.id);
                  }}
                />
              </li>
            );
          })}
          <li>
            <ListRow
              title="Join or create a household"
              leading={<Icon name="add" size={20} />}
              onSelect={() => {
                setIsOpen(false);
                onJoinOrCreate();
              }}
            />
          </li>
        </ul>
      </ModalBottomSheet>
    </>
  );
}
```

---

### 8. `apps/web/src/screens/meals/RecipeDetailScreen.tsx` (component, request-response)

**Analog:** `apps/web/src/screens/bills/BillDetailScreen.tsx`

**Screen Chrome sync & Heading pattern** (lines 68, 119-122 of `BillDetailScreen.tsx` applied to `RecipeDetailScreen.tsx`):
```typescript
// Synchronize with TopBar's single <h1> and register back navigation:
useScreenChrome({
  title: recipe.data?.title ?? 'Recipe',
  backTo: '/meals/recipes',
  backLabel: 'Recipes',
});

// Demote body heading from <h1> to <h2>:
<header className="flex items-start justify-between gap-3">
  <div className="flex flex-col gap-1">
    <h2 className="text-h1 text-primary">{data.title}</h2>
    <p className="text-body-sm text-secondary">
      {data.servings !== null ? pluralize(data.servings, 'serving') : 'Servings not recorded'}
    </p>
```

---

### 9. `apps/web/src/screens/chores/ChoreDetailScreen.tsx` & `ChoreFormScreen.tsx` (component, request-response)

**Analog:** `apps/web/src/screens/bills/BillDetailScreen.tsx`

**Heading demotion pattern**:
```typescript
// In ChoreDetailScreen.tsx:
<header className="flex items-start justify-between gap-3">
  <div className="flex flex-col gap-1">
    <h2 className="text-h1 text-primary">{data.name}</h2>
    <p className="text-body-sm text-secondary">
      {describeRecurrence(data.recurrenceUnit, data.interval)}
    </p>
  </div>

// In ChoreFormScreen.tsx:
<header className="flex items-center justify-between gap-3">
  <h2 className="text-h1 text-primary">
    {isEditing ? `Edit ${chore?.name ?? ''}` : 'Add a chore'}
  </h2>
```

---

### 10. `apps/web/src/screens/meals/RecipeLibraryScreen.tsx` (component, request-response)

**Analog:** `apps/web/src/screens/meals/RecipeLibraryScreen.tsx` (self)

**Filter chip integration pattern** (using `useSearchParams` and `MdFilterChip`):
```typescript
import { useSearchParams } from 'react-router';
import { MdFilterChip } from '../../components/md/MdFilterChip.tsx';

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

// Filter predicate: recipes with in-pantry or on-sale ingredients
const displayedRecipes = filterReady
  ? sorted.filter((r) => (r.inPantryCount ?? 0) > 0 || (r.onSaleCount ?? 0) > 0)
  : sorted;

// Empty state when filter produces 0 results:
if (filterReady && displayedRecipes.length === 0) {
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

---

### 11. `apps/web/src/components/ui/ModalBottomSheet.tsx` (component, request-response)

**Analog:** `apps/web/src/components/ui/ModalBottomSheet.tsx` (self)

**Decoupling pattern** (lines 9, 54, 159):
- Delete `import { useSection } from '../../lib/section-context.tsx';`
- Delete `const section = useSection();`
- Remove `data-section={section}` attribute from `<dialog>` element.

---

### 12. `apps/web/src/components/shell/shell.test.tsx` (test, request-response)

**Analog:** `apps/web/src/components/shell/shell.test.tsx` (self)

**Sub-tab & Switcher testing pattern** (migrating from `role="radiogroup"` to `role="tablist"` / `role="tab"` and testing single membership):
```typescript
it('selects the active sub-tab inside MD3 tabs', () => {
  renderBills('/bills/subscriptions');
  const nav = screen.getByRole('navigation', { name: 'Bills sections' });
  const tabs = within(nav).getByRole('tablist');
  expect(tabs).toBeInTheDocument();
  const activeTab = within(tabs).getByRole('tab', { name: 'Subscriptions', selected: true });
  expect(activeTab).toBeInTheDocument();
});

it('displays single-household helper copy and Join or Create action', async () => {
  render(
    <HouseholdSwitcher
      households={[{ id: 'h1', name: 'Solitary Home', memberCount: 1 }]}
      activeHouseholdId="h1"
      onSelect={vi.fn()}
      onJoinOrCreate={vi.fn()}
    />
  );
  await userEvent.click(screen.getByRole('button', { name: /switch household$/ }));
  const sheet = await screen.findByRole('dialog', { name: 'Households' });
  expect(within(sheet).getByText('No other households')).toBeInTheDocument();
  expect(within(sheet).getByRole('button', { name: 'Join or create a household' })).toBeInTheDocument();
});
```

---

## Shared Patterns

### 1. MD3 Active Indicator Pill
**Source:** `apps/web/src/components/shell/TabBar.tsx` & MD3 Navigation Specifications  
**Apply to:** `NavigationBar.tsx`, `NavigationRail.tsx`
```typescript
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
```

### 2. Scroll-Aware Tonal Elevation Tint
**Source:** `apps/web/src/components/shell/TopBar.tsx`  
**Apply to:** `TopBar.tsx`
```typescript
const [isScrolled, setIsScrolled] = useState(false);
useEffect(() => {
  const onScroll = (): void => {
    setIsScrolled(window.scrollY > 4);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}, []);
```

### 3. Lit Component React Wrapper
**Source:** `apps/web/src/components/md/MdTabs.tsx`  
**Apply to:** `apps/web/src/components/md/MdFilterChip.tsx`
```typescript
import { createComponent } from '@lit/react';
import * as React from 'react';

export const MdComponent = createComponent({
  react: React,
  tagName: 'md-tag-name',
  elementClass: ElementClass,
  events: {
    onChange: 'change',
  },
});
```

### 4. Single-`<h1>` Screen Chrome Synchronization
**Source:** `apps/web/src/screens/bills/BillDetailScreen.tsx` & `screen-chrome.tsx`  
**Apply to:** All pushed screens (`RecipeDetailScreen`, `ChoreDetailScreen`, `ChoreFormScreen`, `ListDetailScreen`, `BillDetailScreen`)
```typescript
useScreenChrome({
  title: entity.data?.name ?? 'Fallback Title',
  backTo: '/parent-route',
  backLabel: 'Parent Section',
});
```

---

## No Analog Found

*None. All components, routes, configs, and tests for Phase 18 have exact, tracked source analogs in the existing codebase.*

---

## Metadata

**Analog search scope:** `apps/web/src/components/shell/`, `apps/web/src/components/md/`, `apps/web/src/components/ui/`, `apps/web/src/screens/`, `apps/web/src/lib/`  
**Files scanned:** 38 files  
**Pattern extraction date:** 2026-11-15  
