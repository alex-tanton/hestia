# Phase 19: Entry, Dashboard & Grocery Ecosystem Screens - Pattern Map

**Mapped:** 2026-11-15  
**Files analyzed:** 32  
**Analogs found:** 32 / 32  

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/screens/DashboardScreen.tsx` | screen | request-response | `apps/web/src/screens/DashboardScreen.tsx` | exact |
| `apps/web/src/components/dashboard/DashboardCard.tsx` | component | request-response | `apps/web/src/components/ui/Card.tsx` | exact |
| `apps/web/src/components/dashboard/DashboardCards.tsx` | component | request-response | `apps/web/src/components/dashboard/DashboardCard.tsx` | exact |
| `apps/web/src/components/dashboard/DashboardFirstRun.tsx` | component | request-response | `apps/web/src/components/ui/Card.tsx` | role-match |
| `apps/web/src/components/states/StateBlocks.tsx` | component | request-response | `apps/web/src/components/ui/Icon.tsx` | exact |
| `apps/web/src/screens/onboarding/OnboardingLayout.tsx` | component | request-response | `apps/web/src/screens/onboarding/OnboardingLayout.tsx` | exact |
| `apps/web/src/screens/onboarding/SignInScreen.tsx` | screen | request-response | `apps/web/src/screens/onboarding/SignInScreen.tsx` | exact |
| `apps/web/src/screens/onboarding/SignUpScreen.tsx` | screen | request-response | `apps/web/src/screens/onboarding/SignInScreen.tsx` | role-match |
| `apps/web/src/screens/onboarding/MagicLinkRequestScreen.tsx` | screen | request-response | `apps/web/src/screens/onboarding/SignInScreen.tsx` | role-match |
| `apps/web/src/screens/onboarding/MagicLinkCodeScreen.tsx` | screen | request-response | `apps/web/src/screens/onboarding/SignInScreen.tsx` | role-match |
| `apps/web/src/screens/onboarding/ForgotPasswordScreen.tsx` | screen | request-response | `apps/web/src/screens/onboarding/SignInScreen.tsx` | role-match |
| `apps/web/src/screens/onboarding/SetPasswordScreen.tsx` | screen | request-response | `apps/web/src/screens/onboarding/SignInScreen.tsx` | role-match |
| `apps/web/src/screens/onboarding/CreateHouseholdStep.tsx` | component | request-response | `apps/web/src/screens/onboarding/SignInScreen.tsx` | role-match |
| `apps/web/src/screens/onboarding/JoinHouseholdStep.tsx` | component | request-response | `apps/web/src/screens/onboarding/SignInScreen.tsx` | role-match |
| `apps/web/src/screens/onboarding/InstallStep.tsx` | component | request-response | `apps/web/src/components/ui/Card.tsx` | role-match |
| `apps/web/src/screens/lists/ListsIndexScreen.tsx` | screen | CRUD | `apps/web/src/screens/bills/BillsIndexScreen.tsx` | role-match |
| `apps/web/src/screens/lists/ListDetailScreen.tsx` | screen | CRUD | `apps/web/src/screens/bills/BillDetailScreen.tsx` | role-match |
| `apps/web/src/screens/lists/ArchivedListsScreen.tsx` | screen | CRUD | `apps/web/src/screens/lists/ArchivedListsScreen.tsx` | exact |
| `apps/web/src/screens/lists/PantryScreen.tsx` | screen | CRUD | `apps/web/src/screens/lists/ListsIndexScreen.tsx` | role-match |
| `apps/web/src/screens/lists/ListNameSheet.tsx` | component | CRUD | `apps/web/src/components/ui/ConfirmDialog.tsx` | exact |
| `apps/web/src/components/lists/ShoppingListRow.tsx` | component | CRUD | `apps/web/src/components/chores/ChoreListRow.tsx` | exact |
| `apps/web/src/components/lists/StoreGroupHeader.tsx` | component | request-response | `apps/web/src/components/ui/Card.tsx` | role-match |
| `apps/web/src/components/lists/ItemSheet.tsx` | component | CRUD | `apps/web/src/components/shell/HouseholdSwitcher.tsx` | exact |
| `apps/web/src/components/lists/SyncToPantrySheet.tsx` | component | batch | `apps/web/src/components/shell/HouseholdSwitcher.tsx` | exact |
| `apps/web/src/components/lists/BarcodeScannerDialog.tsx` | component | event-driven | `apps/web/src/components/lists/BarcodeScannerDialog.tsx` | exact |
| `apps/web/src/screens/deals/DealSearchScreen.tsx` | screen | request-response | `apps/web/src/screens/deals/DealSearchScreen.tsx` | exact |
| `apps/web/src/screens/deals/DealCard.tsx` | component | request-response | `apps/web/src/components/chores/ChoreListRow.tsx` | role-match |
| `apps/web/src/screens/deals/AddToListSheet.tsx` | component | CRUD | `apps/web/src/components/shell/HouseholdSwitcher.tsx` | exact |
| `apps/web/src/screens/deals/DealFreshness.tsx` | component | request-response | `apps/web/src/components/ui/Card.tsx` | role-match |
| `apps/web/src/screens/deals/FlyersScreen.tsx` | screen | request-response | `apps/web/src/screens/deals/FlyersScreen.tsx` | exact |
| `apps/web/src/screens/deals/FlyerItemsScreen.tsx` | screen | request-response | `apps/web/src/screens/deals/FlyerItemsScreen.tsx` | exact |
| `apps/web/src/screens/deals/deal-card.test.tsx` | test | request-response | `apps/web/src/screens/deals/deal-card.test.tsx` | exact |

---

## Pattern Assignments

### 1. `apps/web/src/screens/DashboardScreen.tsx` & `DashboardCard.tsx` (screen & component, request-response)

**Analog:** `apps/web/src/components/ui/Card.tsx` and `apps/web/src/components/dashboard/DashboardCard.tsx`

**Imports pattern:**
```typescript
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { PILLARS, type PillarId } from '../../lib/sections.ts';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';
import { Icon } from '../ui/Icon.tsx';
import { SkeletonRows } from '../ui/Skeleton.tsx';
import { ErrorState } from '../states/StateBlocks.tsx';
```

**Urgency ranking and card overflow pattern:**
```typescript
// Sort top 3 items by urgency: overdue first, then today, then week
export function sortPillarItems(items: readonly DashboardItem[]): DashboardItem[] {
  return [...items].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return 0;
  });
}

// Borderless surfaceContainerLow card with dedicated overflow text button
export function DashboardCard({ pillar, title, state }: DashboardCardProps): ReactElement {
  // ...
  const sorted = sortPillarItems(state.items);
  const visible = sorted.slice(0, 3);
  const remainder = state.total - visible.length;

  return (
    <Card variant="flat" className="flex flex-col gap-3 p-4 bg-[var(--md-sys-color-surface-container-low)]">
      <div className="flex items-center justify-between">
        <Link to={path} className="flex items-center gap-2 text-title-md font-semibold text-[var(--md-sys-color-on-surface)]">
          <Icon name={pillarIcon(pillar)} size={20} className="text-[var(--md-sys-color-primary)]" />
          <span>{title}</span>
        </Link>
      </div>
      {/* 3 items */}
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

**Error handling pattern:**
```typescript
// Scoped to region via ErrorBoundary and inline ErrorState
case 'error':
  return (
    <div className="relative z-10">
      <ErrorState message={state.message} onRetry={state.onRetry} layout="card" />
    </div>
  );
```

---

### 2. `apps/web/src/components/states/StateBlocks.tsx` (component, request-response)

**Analog:** `apps/web/src/components/ui/Icon.tsx` and `apps/web/src/components/ui/Button.tsx`

**Imports pattern:**
```typescript
import type { ReactElement } from 'react';
import { Button } from '../ui/Button.tsx';
import { Icon, type IconName } from '../ui/Icon.tsx';
```

**Context-adaptive layout pattern (card vs page):**
```typescript
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

### 3. `apps/web/src/screens/onboarding/SignInScreen.tsx` & Auth Screens (screen, request-response)

**Analog:** `apps/web/src/screens/onboarding/SignInScreen.tsx` lines 1-60 and `apps/web/src/components/ui/Field.tsx` lines 275-300

**Imports pattern:**
```typescript
import { useState, type SyntheticEvent, type ReactElement } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { TextField } from '../../components/ui/Field.tsx';
import { FormMessage } from '../../components/ui/FormMessage.tsx';
import { useAuthClient } from '../../lib/api/api-context.tsx';
import { AuthError } from '../../lib/auth/auth-client.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
import { useOnlineStatus } from '../../lib/use-online-status.ts';
import { OnboardingLayout } from './OnboardingLayout.tsx';
```

**Card container and field validation pattern:**
```typescript
return (
  <OnboardingLayout title="Sign in">
    <Card variant="flat" className="w-full max-w-[440px] mx-auto p-6 bg-[var(--md-sys-color-surface-container)] flex flex-col gap-6">
      <form ref={formRef} noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {formError && <FormMessage variant="error">{formError}</FormMessage>}
        <TextField
          type="email"
          name="email"
          label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />
        <TextField
          type="password"
          name="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete="current-password"
        />
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          Sign into Hestia
        </Button>
        {/* MAGIC_LINK_COPY preserved exactly */}
        <Link to="/sign-in/link" className="text-label-md text-center text-[var(--md-sys-color-primary)]">
          Email me a sign-in link
        </Link>
      </form>
    </Card>
  </OnboardingLayout>
);
```

---

### 4. `apps/web/src/components/lists/ShoppingListRow.tsx` (component, CRUD)

**Analog:** `apps/web/src/components/chores/ChoreListRow.tsx` and `apps/web/src/components/ui/Checkbox.tsx` lines 11-28

**Imports pattern:**
```typescript
import type { ReactElement } from 'react';
import type { ListItem } from '@hestia/shared';
import { cn } from '../../lib/cn.ts';
import { Checkbox } from '../ui/Checkbox.tsx';
import { Icon } from '../ui/Icon.tsx';
import { OverflowMenu, type OverflowMenuItem } from '../ui/OverflowMenu.tsx';
import { ItemPrice } from './ItemPrice.tsx';
import { PendingMark } from './PendingMark.tsx';
```

**Full-row checkbox and strikethrough pattern:**
```typescript
export function ShoppingListRow({
  item,
  isPending = false,
  isReadOnly = false,
  onToggleBought,
  menuItems,
}: ShoppingListRowProps): ReactElement {
  const isBought = item.isBought;

  return (
    <div className={cn(
      'flex items-center justify-between gap-3 px-4 py-3 min-h-[48px] transition-all duration-200',
      isBought && 'opacity-60 bg-[var(--md-sys-color-surface-container-low)]'
    )}>
      <Checkbox
        variant="in-list"
        checked={isBought}
        onCheckedChange={(checked) => onToggleBought(checked)}
        label={
          <span className={cn('text-body-md select-none', isBought && 'line-through text-[var(--md-sys-color-on-surface-variant)]')}>
            {item.name}
          </span>
        }
        detail={<ItemPrice item={item} />}
      />
      {menuItems && <OverflowMenu items={menuItems} />}
    </div>
  );
}
```

---

### 5. `apps/web/src/screens/lists/ListNameSheet.tsx` (component, CRUD dialog)

**Analog:** `apps/web/src/components/ui/ConfirmDialog.tsx` lines 9-25 (converted to `<md-dialog>` basic dialog)

**Imports pattern:**
```typescript
import { useState, type ReactElement, type SyntheticEvent } from 'react';
import { listNameSchema, type ShoppingList, type ShoppingListDetail } from '@hestia/shared';
import { MdDialog } from '../md/MdDialog.tsx';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';
import { FormMessage } from '../ui/FormMessage.tsx';
import { useCreateList, useRenameList } from '../../lib/api/list-hooks.ts';
import { userMessage } from '../../lib/api/problem.ts';
import { useFieldErrors } from '../../lib/use-field-errors.ts';
```

**Dialog prompt pattern:**
```typescript
export function ListNameSheet({ householdId, list, open, onOpenChange, onCreated }: ListNameSheetProps): ReactElement {
  const isRenaming = list !== undefined;
  // ...
  return (
    <MdDialog
      open={open}
      onClose={() => onOpenChange(false)}
      aria-labelledby="dialog-title"
    >
      <div slot="headline" id="dialog-title">
        {isRenaming ? 'Rename shopping list' : 'Create shopping list'}
      </div>
      <form slot="content" id="list-name-form" onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
        {formError && <FormMessage variant="error">{formError}</FormMessage>}
        <TextField
          label="List name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoFocus
        />
      </form>
      <div slot="actions">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" form="list-name-form" isLoading={isPending}>
          {isRenaming ? 'Save list name' : 'Create shopping list'}
        </Button>
      </div>
    </MdDialog>
  );
}
```

---

### 6. `apps/web/src/components/lists/ItemSheet.tsx` & `SyncToPantrySheet.tsx` (components, modal bottom sheet)

**Analog:** `apps/web/src/components/shell/HouseholdSwitcher.tsx` lines 64-108 and `apps/web/src/components/ui/ModalBottomSheet.tsx`

**Imports pattern:**
```typescript
import { useState, type ReactElement, type SyntheticEvent } from 'react';
import { itemNameSchema, type ListItem, type PriceUnit } from '@hestia/shared';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';
import { ModalBottomSheet } from '../ui/ModalBottomSheet.tsx';
import { MdFilterChip } from '../md/MdFilterChip.tsx';
import { FormMessage } from '../ui/FormMessage.tsx';
```

**Modal Bottom Sheet pattern:**
```typescript
export function ItemSheet({ open, onOpenChange, item, stores, onSubmit }: ItemSheetProps): ReactElement {
  return (
    <ModalBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={item ? 'Edit grocery item' : 'Add grocery item'}
      description="Enter item details, quantity, and store assignment"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-6">
        <TextField
          label="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.itemName}
          autoFocus
        />
        {/* Horizontal tonal chip strip of favorite/recent stores (D-10) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-label-md text-[var(--md-sys-color-on-surface-variant)]">Store</label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {stores.map((s) => (
              <MdFilterChip
                key={s.merchantId}
                label={s.merchantName}
                selected={selectedStoreId === s.merchantId}
                onClick={() => setSelectedStoreId(s.merchantId)}
              />
            ))}
          </div>
        </div>
        <div slot="actions" className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit">
            {item ? 'Save item changes' : 'Add grocery item'}
          </Button>
        </div>
      </form>
    </ModalBottomSheet>
  );
}
```

---

### 7. `apps/web/src/screens/deals/AddToListSheet.tsx` & `DealSearchScreen.tsx` (screen-level lifted sheet)

**Analog:** `apps/web/src/components/shell/HouseholdSwitcher.tsx` lines 64-108 and `apps/web/src/components/ui/Toast.tsx` lines 49-54

**Lifted sheet and smart addition pattern:**
```typescript
// DealSearchScreen.tsx manages a single lifted AddToListSheet instance
const [dealToAdd, setDealToAdd] = useState<Deal | null>(null);

const handleAddDeal = (deal: Deal) => {
  const activeLists = (lists.data ?? []).filter((l) => l.archivedAt === null);
  if (activeLists.length === 1) {
    const list = activeLists[0];
    addDealToList.mutate(
      { listId: list.id, dealId: deal.id },
      {
        onSuccess: () => {
          toast({
            variant: 'success',
            message: `Added '${deal.name}' to ${list.name}`,
            action: {
              label: 'Undo',
              onAction: () => removeDealFromList.mutate({ listId: list.id, dealId: deal.id }),
            },
          });
        },
      }
    );
  } else {
    // 0 or >1 active lists opens the lifted modal bottom sheet
    setDealToAdd(deal);
  }
};
```

---

### 8. `apps/web/src/components/lists/BarcodeScannerDialog.tsx` (component, event-driven dark HUD dialog)

**Analog:** `apps/web/src/components/lists/BarcodeScannerDialog.tsx` lines 1-120 + `apps/web/src/components/ui/SegmentedControl.tsx` + `apps/web/src/components/ui/Toast.tsx`

**Imports pattern:**
```typescript
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createBarcodeDetector } from '../../lib/barcode/detector.ts';
import { playScanChime, triggerScanHaptic } from '../../lib/barcode/feedback.ts';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../ui/Icon.tsx';
import { ModalBottomSheet } from '../ui/ModalBottomSheet.tsx';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';
import { useToast } from '../ui/Toast.tsx';
```

**Dark HUD and continuous batch scanning pattern:**
```typescript
// Full-screen dark scheme dialog with in-HUD naming sheet and persistent batch undo toast
export function BarcodeScannerDialog({ open, onOpenChange, onScan }: BarcodeScannerDialogProps): ReactElement {
  const toast = useToast();
  const [scannedCount, setScannedCount] = useState(0);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);

  const handleScanCommit = (barcode: string) => {
    playScanChime();
    triggerScanHaptic();
    setScannedCount((prev) => {
      const next = prev + 1;
      toast({
        variant: 'success',
        message: `Added ${next} items`,
        action: { label: 'Undo last', onAction: handleUndoLastScan },
      });
      return next;
    });
  };

  return (
    <dialog open={open} className="fixed inset-0 z-50 size-full bg-[#1A110E] text-[#FFF8F6]">
      {/* Top action bar: back/close, torch */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 z-10">
        <Button variant="ghost" isIconOnly aria-label="Close scanner" onClick={() => onOpenChange(false)}>
          <Icon name="arrow_back" size={24} className="text-white" />
        </Button>
        {isTorchSupported && (
          <Button variant="ghost" isIconOnly aria-label="Toggle flashlight" onClick={toggleTorch}>
            <Icon name={torchOn ? 'flashlight_off' : 'flashlight_on'} size={24} className="text-white" />
          </Button>
        )}
      </div>

      {/* Center targeting reticle */}
      <div className="relative flex items-center justify-center size-full">
        <video ref={videoRef} autoPlay playsInline muted className="size-full object-cover" />
        <div data-testid="scanner-reticle" className="absolute size-64 border-2 border-[var(--md-sys-color-primary)] rounded-lg">
          <div className="w-full h-0.5 bg-[var(--md-sys-color-primary)] animate-pulse" />
        </div>
      </div>

      {/* Bottom floating controls: SegmentedControl and manual code button */}
      <div className="absolute bottom-6 inset-x-4 flex flex-col items-center gap-3 z-10">
        <SegmentedControl
          label="Scanner mode"
          segments={[{ value: 'add', label: 'Add to list' }, { value: 'shop', label: 'Mark bought' }]}
          value={mode}
          onValueChange={(val) => setMode(val as 'add' | 'shop')}
        />
        <Button variant="secondary" onClick={() => setManualInputOpen(true)}>
          Enter code manually
        </Button>
      </div>

      {/* In-HUD quick naming sheet for unknown barcodes (D-14) */}
      <ModalBottomSheet
        open={Boolean(unknownBarcode)}
        onOpenChange={(open) => !open && setUnknownBarcode(null)}
        title="Name scanned item"
      >
        {/* Quick item naming form */}
      </ModalBottomSheet>
    </dialog>
  );
}
```

---

## Shared Patterns

### MD3 Borderless Card Architecture
**Source:** `apps/web/src/components/ui/Card.tsx`  
**Apply to:** `DashboardCard.tsx`, `DashboardFirstRun.tsx`, `SignInScreen.tsx`, `SignUpScreen.tsx`, `DealCard.tsx`, `FlyersScreen.tsx`  
```typescript
import { Card } from '../ui/Card.tsx';

// Flat tonal card (surfaceContainerLow, 0 1px borders)
<Card variant="flat" className="p-4 bg-[var(--md-sys-color-surface-container-low)]">
  {content}
</Card>
```

### Modal Bottom Sheet Architecture
**Source:** `apps/web/src/components/ui/ModalBottomSheet.tsx` & `apps/web/src/components/shell/HouseholdSwitcher.tsx`  
**Apply to:** `ItemSheet.tsx`, `SyncToPantrySheet.tsx`, `AddToListSheet.tsx`, `FilterModalBottomSheet.tsx`, In-HUD quick naming  
```typescript
import { ModalBottomSheet } from '../ui/ModalBottomSheet.tsx';

<ModalBottomSheet
  open={open}
  onOpenChange={setOpen}
  title={title}
  description={description}
>
  {children}
</ModalBottomSheet>
```

### Persistent Undo Snackbar Queue
**Source:** `apps/web/src/components/ui/Toast.tsx` lines 49-54  
**Apply to:** Marking grocery items bought (`ListDetailScreen`), batch barcode scan commits (`BarcodeScannerDialog`), adding deals to shopping lists (`DealSearchScreen`)  
```typescript
const toast = useToast();

toast({
  variant: 'success',
  message: `Marked '${item.name}' as bought`,
  action: {
    label: 'Undo',
    onAction: () => undoMutation.mutate(),
  },
});
```

### MD3 Controlled Outlined Text Field
**Source:** `apps/web/src/components/ui/Field.tsx` lines 275-362  
**Apply to:** All auth forms, `ListNameSheet`, `ItemSheet`, Quick-Add input, Manual barcode entry  
```typescript
import { TextField } from '../ui/Field.tsx';

<TextField
  label="Item name"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  error={error}
  hint={hint}
/>
```

### Screen Chrome Pushed Navigation
**Source:** `apps/web/src/components/shell/screen-chrome.tsx` lines 11-40  
**Apply to:** `ArchivedListsScreen.tsx`, `ListDetailScreen.tsx`, `FlyerItemsScreen.tsx`  
```typescript
import { useScreenChrome } from '../../components/shell/screen-chrome.tsx';

useScreenChrome({
  title: 'Weekly Flyer Deals',
  backTo: '/deals/flyers',
  backLabel: 'Flyers',
});
```

---

## No Analog Found

Every file to be created or modified has a direct or role-matched analog within the tracked codebase. There are 0 files without analogs.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| *None* | — | — | All files match existing tracked patterns |

---

## Metadata

**Analog search scope:** `apps/web/src/screens/`, `apps/web/src/components/`, `apps/web/src/lib/`, `apps/web/src/test/`  
**Files scanned:** 64  
**Pattern extraction date:** 2026-11-15  
