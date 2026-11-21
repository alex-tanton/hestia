# Phase 20: Meals, Bills, Chores & Settings Screens - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-15
**Phase:** 20-Meals, Bills, Chores & Settings Screens
**Areas discussed:** Meals & Recipe Planning, Bills & Subscriptions, Chores Rotation & Errands, Settings Hub Architecture

---

## Meals & Recipe Planning

| Option | Description | Selected |
|--------|-------------|----------|
| Planned-only with "+ Plan meal" button | Uncluttered; days only show meals that are scheduled, with a compact "+ Plan" tap target to assign breakfast/lunch/dinner | ✓ |
| Explicit 3-slot rows per day | Shows Breakfast, Lunch, and Dinner rows for all 7 days with placeholder "+ Add" slots | |
| Collapsible day sections | Day accordions that can be expanded or collapsed to focus on today or tomorrow | |

**User's choice:** Planned-only with "+ Plan meal" button
**Notes:** Keeps mobile agenda clean and uncluttered.

| Option | Description | Selected |
|--------|-------------|----------|
| Responsive MD3 Dialog | Full-screen dialog on mobile (<600px) and centered wide dialog (max-w-[720px]) on desktop, keeping user in context without route switching | ✓ |
| Dedicated pushed route | Navigate to /meals/recipes/new and /meals/recipes/:id/edit with Top App Bar back button, giving maximum viewport room for extensive recipes | |
| You decide | Full-screen dialog on mobile, centered modal dialog on desktop | |

**User's choice:** Responsive MD3 Dialog
**Notes:** Standardized on responsive modal dialogs for recipe creation and editing.

| Option | Description | Selected |
|--------|-------------|----------|
| Inline rapid row editor | Quantity, unit, and ingredient name fields directly in borderless rows, with Enter key advancing to next row and drag/reorder handle | ✓ |
| Quick sheet per ingredient | Tapping "+ Add ingredient" opens a focused Modal Bottom Sheet for amount, unit, and item name | |
| Smart multiline text paste & parse | Paste raw recipe text to auto-parse lines into structured ingredient rows, with inline adjustment fallback | |

**User's choice:** Inline rapid row editor
**Notes:** Fast keyboard-friendly entry for recipe ingredients.

| Option | Description | Selected |
|--------|-------------|----------|
| Sheet with ingredient selection checklist | Always open ListPickerSheet showing missing ingredients with checkboxes and target list picker so the user can verify/deselect before adding | ✓ |
| Smart immediate export | If 1 active list, immediately add missing ingredients with persistent Undo Snackbar; open sheet only if multiple lists exist | |
| You decide | Always open ListPickerSheet checklist to avoid adding items already in the kitchen | |

**User's choice:** Sheet with ingredient selection checklist
**Notes:** Gives user control to deselect ingredients they already have in the kitchen.

| Option | Description | Selected |
|--------|-------------|----------|
| Open PlaceOnPlannerSheet | Select target day (mon-sun pills) and meal slot (Breakfast/Lunch/Dinner segmented button) with quick "Today" default | ✓ |
| Quick "Tonight's Dinner" action + "Choose another day..." sheet | One-tap shortcut for the most common scenario, sheet fallback for other days | |
| You decide | PlaceOnPlannerSheet with Today preselected | |

**User's choice:** Open PlaceOnPlannerSheet
**Notes:** Fast day-picker bottom sheet with Today preselected.

| Option | Description | Selected |
|--------|-------------|----------|
| Tonal readiness card with inline chip badges | Green/amber readiness progress bar with direct "In pantry" or "On sale at [Store] (-X%)" badges per ingredient row, tapping opens MatchToSheet | ✓ |
| Compact MatchToSheet button only | Keep ingredient rows plain, placing a single "Match Ingredients (Pantry / Deals)" button below the title | |
| You decide | Inline deal badges with quick-open sheet | |

**User's choice:** Tonal readiness card with inline chip badges
**Notes:** Clear visual indicators for which items are in pantry vs on sale.

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal md-suggestion-chip strip above custom title input | Single tap fills title instantly, or type custom dish directly below | ✓ |
| Two-tab bottom sheet (Recipes | Quick Ideas) | Dedicated tab for quick ideas (Leftovers, Takeout, etc.) and a tab for custom text entry | |
| You decide | Suggestion chip strip directly above the text field | |

**User's choice:** Horizontal md-suggestion-chip strip above custom title input
**Notes:** Single-tap quick suggestions for common unlinked meals.

| Option | Description | Selected |
|--------|-------------|----------|
| Click-to-open actions menu | Tapping a meal card offers Move to day..., Edit slot, and Remove actions, with accessible keyboard navigation | ✓ |
| Drag-and-drop between day columns | Direct mouse drag between days/slots with accessible menu fallback | |
| You decide | Clean click-to-open actions sheet/menu to avoid accidental drag errors on touch laptops | |

**User's choice:** Click-to-open actions menu
**Notes:** Reliable, accessible meal manipulation on expanded viewports.

---

## Bills & Subscriptions

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate one-tap with persistent Undo Snackbar | Direct "Mark Paid" icon button records payment immediately with a persistent Undo toast (preserves fast routine workflow) | ✓ |
| Quick PaymentEditSheet bottom sheet | Tapping mark paid slides up a sheet to verify/adjust amount paid, date, or note before saving | |
| You decide | One-tap checkoff with persistent Undo toast | |

**User's choice:** Immediate one-tap with persistent Undo Snackbar
**Notes:** Fast routine workflow backed by toast.undo.

| Option | Description | Selected |
|--------|-------------|----------|
| Monthly & Annual spend hero card with next renewal callout | Tonal surfaceContainerLow card showing total monthly spend ($X/mo), annualized total ($Y/yr), and upcoming renewal pill | |
| Minimal monthly total badge only | Compact headline stat ("$X/month across N active services") without annualized projection | ✓ |
| You decide | Monthly & Annual spend card with next renewal alert | |

**User's choice:** Minimal monthly total badge only
**Notes:** Uncluttered headline stat keeping the header simple and minimal.

| Option | Description | Selected |
|--------|-------------|----------|
| Responsive MD3 Dialog | Full-screen dialog on mobile (<600px), centered dialog on desktop (consistent with RecipeForm and ListName prompt) | ✓ |
| Dedicated pushed route | Navigates to /bills/new and /bills/:id/edit with Top App Bar back button | |
| You decide | Responsive MD3 Dialog for consistency with other creation flows | |

**User's choice:** Responsive MD3 Dialog
**Notes:** Consistent dialog pattern with RecipeForm and ChoreForm.

| Option | Description | Selected |
|--------|-------------|----------|
| Direct inline action buttons | Direct Delete icon on skipped payments, tap on paid rows opens PaymentEditSheet to adjust amount/date, with persistent Undo Snackbar | ✓ |
| Contextual overflow menu per payment row | 3-dot menu on each payment history entry for Edit / Delete | |
| You decide | Direct delete icon with persistent Undo Snackbar, tap row to edit in PaymentEditSheet | |

**User's choice:** Direct inline action buttons
**Notes:** Zero 1-item overflow menus, direct inline actions.

---

## Chores Rotation & Errands

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate checkoff with next assignee toast | Tonal "Done" button records completion immediately, updates next due date, and displays persistent Undo toast: "Completed! Next up: Alex · [Undo]" | ✓ |
| In-place avatar transition | Chore card smoothly animates to next assignee's avatar/name with persistent Undo toast | |
| You decide | Instant checkoff with next-assignee persistent Undo toast | |

**User's choice:** Immediate checkoff with next assignee toast
**Notes:** Quick chore completion with clear rotation feedback.

| Option | Description | Selected |
|--------|-------------|----------|
| Responsive MD3 Dialog | Full-screen dialog on mobile (<600px), centered dialog on desktop (maintains consistent modal dialog pattern across all creation forms) | ✓ |
| Dedicated pushed route | Navigates to /chores/new and /chores/:id/edit with Top App Bar back button | |
| You decide | Responsive MD3 Dialog for cross-screen consistency | |

**User's choice:** Responsive MD3 Dialog
**Notes:** Modal dialog consistency across all forms.

| Option | Description | Selected |
|--------|-------------|----------|
| Tonal list with member switches and up/down order controls | Each household member has an enable switch, avatar/name, and subtle arrow buttons to adjust rotation turn order | ✓ |
| Numbered sequence chips | Horizontal row of member avatar chips with drag or tap-to-swap order | |
| You decide | Accessible tonal list with switches and reorder controls | |

**User's choice:** Tonal list with member switches and up/down order controls
**Notes:** Accessible rotation management without drag/drop fragility.

| Option | Description | Selected |
|--------|-------------|----------|
| Store/Category filter chips + collapsible Completed section | Top horizontal chips (All, Hardware, Pharmacy, etc.) filtering active errands, with FAB opening ErrandSheet and collapsible Completed (N) matching grocery list Bought (N) | ✓ |
| Single flat list with collapsible Completed section | No filter chips, clean minimal list sorted by date added, with FAB opening ErrandSheet | |
| You decide | Filter chips if errands have stores/categories, with collapsible Completed section | |

**User's choice:** Store/Category filter chips + collapsible Completed section
**Notes:** Filter chips for errands with collapsible Completed (N) matching grocery lists.

---

## Settings Hub Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Pushed sub-routes with Top App Bar back navigation | Categorized list items navigate to /settings/account, /settings/households, /settings/notifications, etc. with single <h1> in Top App Bar and browser history support | ✓ |
| In-place Modal Bottom Sheets & Dialogs | Tapping a category item pops up a sheet or dialog in place, remaining on the settings screen | |
| Hybrid | Quick sections (Account) open in a sheet; complex sections (Households, Notifications, System Health) push full routes | |

**User's choice:** Pushed sub-routes with Top App Bar back navigation
**Notes:** Clean route structure with browser history and single `<h1>`.

| Option | Description | Selected |
|--------|-------------|----------|
| Selected filter chips + "+ Add store" picker dialog | Current favorites displayed as tonal filter chips with 'x' to remove, plus a "+ Add store" chip opening an md-list dialog of regional stores | ✓ |
| Checklist with toggles | Full list of all known local stores with an md-switch or checkbox per store in an md-list | |
| You decide | Selected filter chips with "+ Add store" picker dialog | |

**User's choice:** Selected filter chips + "+ Add store" picker dialog
**Notes:** Compact chip management for favorite stores.

| Option | Description | Selected |
|--------|-------------|----------|
| Tonal device guidance card + categorized switch rows | Top tonal surfaceContainerLow card showing PWA install & Web Push permission status (with direct "Enable notifications" CTA if needed), followed by clean md-switch rows grouped by pillar (Deals, Chores, Bills) | ✓ |
| Minimal switch rows only | Clean md-switch list with a small inline helper text under each switch and no top hero banner | |
| You decide | Tonal guidance card + categorized switch rows | |

**User's choice:** Tonal device guidance card + categorized switch rows
**Notes:** Clear notification permission state and toggles.

| Option | Description | Selected |
|--------|-------------|----------|
| Progressive single-column review + error confirmation dialog | Step-by-step review of chore/bill reassignments with md-outlined-select dropdowns, followed by an error-styled md-dialog requiring explicit confirmation to depart/delete | ✓ |
| Multi-step wizard dialog | Modal bottom sheet with "Next" steps for reassignment, transfer ownership, and final exit | |
| You decide | Progressive single-column screen with error-styled confirmation dialog | |

**User's choice:** Progressive single-column review + error confirmation dialog
**Notes:** Explicit safety gates for household departure and deletion.

---

## the agent's Discretion

- Standard dialog entry and exit micro-animations (150–200ms).
- Material Symbols illustration sizing in empty state cards (48dp).
- Touch target sizing (`min-h-12` 48dp) across list rows and controls.

## Deferred Ideas

- None.
