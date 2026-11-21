# Phase 19: Entry, Dashboard & Grocery Ecosystem Screens - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-15
**Phase:** 19-entry-dashboard-grocery-ecosystem-screens
**Areas discussed:** Dashboard Card Overflow & Empty Hero, List Detail & Pantry Organization, Barcode Scanner HUD & Flow, Deals & Flyers Browsing Layout

---

## Dashboard Card Overflow & Empty Hero

### Question 1: Overflow Presentation for >3 Items
| Option | Description | Selected |
|--------|-------------|----------|
| Card footer button | "+N more in [Pillar]" linking directly to that pillar's route | ✓ |
| Header counter badge | e.g. "Showing 3 of N" chip in card header with card header linking to the pillar | |
| Inline expandable accordion | tap to expand and view up to 10 rows directly on the dashboard card | |
| You decide | | |

**User's choice:** Card footer button: "+N more in [Pillar]" linking directly to that pillar's route
**Notes:** Keeps the dashboard glanceable and consistent with MD3 Card anatomy.

### Question 2: Sorting and Prioritization within 3 Preview Rows
| Option | Description | Selected |
|--------|-------------|----------|
| Urgency-first ranking | Overdue items (highlighted with error tokens) at the top, followed by items due today, then items due next this week | ✓ |
| Creation/Chronological order | Show the 3 items nearest in schedule regardless of overdue state | |
| You decide | | |

**User's choice:** Urgency-first ranking
**Notes:** Overdue items use semantic error tokens; upcoming items follow in chronological sequence.

### Question 3: DashboardFirstRun Hero Card Guidance
| Option | Description | Selected |
|--------|-------------|----------|
| Stepped quick-start card | A warm tonal hero card with quick-launch pills ("Create a shopping list", "Add upcoming bill", "Plan first meal") | ✓ |
| Guided linear walkthrough | A single "Start household setup" button taking users through lists, bills, and meal planner in sequence | |
| Minimal banner | A simple warm welcome illustration and message, leaving pillar cards visible with individual empty states | |
| You decide | | |

**User's choice:** Stepped quick-start card
**Notes:** Gives new household members autonomy to choose their starting point.

### Question 4: EmptyState, ErrorState, OfflineState Adaptation
| Option | Description | Selected |
|--------|-------------|----------|
| Context-adaptive layout | Compact layout within cards (32dp icon, bodyMedium text, text button) vs full-bleed centered column on full-page routes (48dp icon, titleMedium, filled/tonal button) | ✓ |
| Always card-enclosed | Wrap empty/error/offline blocks in a distinct rounded surfaceContainerLow card regardless of route or card context | |
| You decide | | |

**User's choice:** Context-adaptive layout
**Notes:** Ensures clean spacing whether rendering in a small card or an entire screen.

---

## List Detail & Pantry Organization

### Question 1: Store Grouping & Subheaders in ListDetailScreen
| Option | Description | Selected |
|--------|-------------|----------|
| Tonal subheaders with count & collapse | A subtle surfaceContainer subheader showing store name, item count badge (e.g. "Trader Joe's (4)"), and chevron to collapse/expand store sections | ✓ |
| Always-expanded flat headers | Plain typography subheaders with store name and item count, leaving all store sections open without collapse toggles | |
| Store filter chips | A horizontal chip strip ("All stores", "Costco", "Trader Joe's") at the top that filters the list to one store at a time | |
| You decide | | |

**User's choice:** Tonal subheaders with count & collapse
**Notes:** Enables focused shopping at one store while retaining visibility into other stores.

### Question 2: Checked Item Transition to Bought (N)
| Option | Description | Selected |
|--------|-------------|----------|
| Smooth transition to Bought | Item strikes through with subtle animation, moves into the collapsible 'Bought (N)' section, and triggers a persistent Undo snackbar ("Marked as bought") | ✓ |
| Stay in place until refresh | Item strikes through and dims in place, only moving down to 'Bought (N)' on page reload or manual list clean-up | |
| Prompt for pantry addition | Checking off an item opens a quick bottom sheet or banner asking whether to log it directly into Pantry inventory | |
| You decide | | |

**User's choice:** Smooth transition to Bought
**Notes:** Provides instant gratification and clears the active shopping view while keeping Undo easily accessible.

### Question 3: 'Add bought to pantry' Transfer Flow
| Option | Description | Selected |
|--------|-------------|----------|
| Review Sheet before sync | Opens a Modal Bottom Sheet listing bought items with pre-filled category/storage suggestions, letting users tweak or uncheck before confirming | ✓ |
| Direct one-tap sync | Immediately transfers all bought items to pantry with default categories and a persistent Undo Snackbar | |
| Simple confirm dialog | A basic <md-dialog> ("Add N bought items to pantry?") with Confirm and Cancel buttons | |
| You decide | | |

**User's choice:** Review Sheet before sync
**Notes:** Prevents clutter by allowing users to adjust storage location (e.g., fridge vs freezer) and expiry dates before adding.

### Question 4: PantryScreen Organization and Filtering
| Option | Description | Selected |
|--------|-------------|----------|
| Location chips + borderless list | Storage location filter chips ("All", "Fridge", "Freezer", "Pantry") with Search Bar, rendering items as borderless list rows with quantity and expiry indicator pills | ✓ |
| Tonal location cards | 3-4 tonal cards (Fridge, Freezer, Pantry) each containing up to 5 items with an expandable "+N more" view | |
| You decide | | |

**User's choice:** Location chips + borderless list
**Notes:** Clean, fast filtering aligned with MD3 chip patterns and borderless list rows.

### Question 5: Rapid Item Addition in ListDetailScreen
| Option | Description | Selected |
|--------|-------------|----------|
| Persistent quick-add input + FAB | A clean text field at top of list for rapid one-line entries (Enter to add next item) alongside the <md-fab> which opens the full ItemSheet for quantities/stores/notes | ✓ |
| FAB only opening ItemSheet | Tapping the FAB always opens the ItemSheet Modal Bottom Sheet with all fields | |
| Bottom inline drawer | Tapping the FAB expands an inline keyboard-focused input row at the bottom of the list | |
| You decide | | |

**User's choice:** Persistent quick-add input + FAB
**Notes:** Supports both rapid entry and rich metadata editing.

### Question 6: Store Selection in ItemSheet
| Option | Description | Selected |
|--------|-------------|----------|
| Tonal store chips + select | Horizontal chip strip of favorite/recent household stores for single-tap assignment, plus a select/autocomplete for all stores or adding a new one | ✓ |
| Standard select menu | An <md-outlined-select> dropdown containing all household stores with an "Add store" option | |
| Freeform text with suggestion datalist | Simple text input with autocomplete suggestions from past shopping trips | |
| You decide | | |

**User's choice:** Tonal store chips + select
**Notes:** One-tap store selection for 90% of items, with full store search when needed.

### Question 7: Lists Index Presentation in ListsIndexScreen
| Option | Description | Selected |
|--------|-------------|----------|
| Rich list rows | Borderless list items showing list name, primary store tag, item progress badge (e.g. "4/12 bought"), and last modified date, with overflow menu (Edit name, Archive, Delete) | ✓ |
| Tonal card grid | 1–2 column grid of surfaceContainerLow cards displaying list title and previewing the top 3 items with a progress bar | |
| Minimal list rows | Clean single-line list rows showing list title and remaining item count badge | |
| You decide | | |

**User's choice:** Rich list rows
**Notes:** Compact, scannable, and consistent with MD3 list specifications.

### Question 8: Expiration Date Highlighting in PantryScreen
| Option | Description | Selected |
|--------|-------------|----------|
| Tonal status pills + "Expiring soon" sort chip | Badges on rows ("Expired 2d ago" in error container, "Expires tomorrow" in warning container) plus an "Expiring soon" filter chip at the top | ✓ |
| Top alert summary card | A tonal warning card pinned at the top listing all urgent items, while the main list remains ordered alphabetically or by category | |
| Subtle relative date text | Plain muted typography ("in 2 days", "yesterday") without high-contrast pills unless expired | |
| You decide | | |

**User's choice:** Tonal status pills + "Expiring soon" sort chip
**Notes:** Adheres to semantic token discipline (error strictly for expired items, warning for expiring soon).

---

## Barcode Scanner HUD & Flow

### Question 1: Item Commitment and Camera Flow on Barcode Detection
| Option | Description | Selected |
|--------|-------------|----------|
| Continuous scan with instant feedback | Camera stays live, sound/vibration confirms scan, item immediately commits with a persistent Undo Snackbar ("Added [Item] to list · [Undo]"), enabling fast rapid pantry/grocery scanning | ✓ |
| Scan-and-pause review card | Camera pauses on detection, showing a bottom HUD card with item details and "Confirm" / "Edit quantity" buttons before resuming camera | |
| You decide | | |

**User's choice:** Continuous scan with instant feedback
**Notes:** Optimized for rapid inventory stocking without screen touches.

### Question 2: Unknown Barcodes Handling
| Option | Description | Selected |
|--------|-------------|----------|
| In-HUD quick naming sheet | Slides up a compact sheet over the dark scanner with an <md-outlined-text-field> ("Item name") to label it and resumes scanning immediately on save | ✓ |
| Save as 'Item #barcode' | Adds it immediately with the barcode number as temporary title and shows a persistent Snackbar with a "Name item" action | |
| HUD error banner | Shows an inline "Product not found" warning badge with a "Type name" button while keeping camera active | |
| You decide | | |

**User's choice:** In-HUD quick naming sheet
**Notes:** Captures custom or unindexed household products without leaving the camera.

### Question 3: Full-Screen Dialog HUD Controls Layout
| Option | Description | Selected |
|--------|-------------|----------|
| Balanced camera HUD | Top bar has Close (arrow_back) and Flashlight (torch); center features viewfinder reticle; bottom floating container houses the Segmented Button ('Add to list | Mark bought') and 'Enter code manually' button | ✓ |
| Bottom-anchored control dock | Top has only Close button; all other actions grouped in an ergonomic thumb-level bottom dock | |
| You decide | | |

**User's choice:** Balanced camera HUD
**Notes:** Clear sightline to camera reticle with accessible thumb controls at the bottom.

### Question 4: Multi-scan Persistent Undo Snackbar Interaction
| Option | Description | Selected |
|--------|-------------|----------|
| Active item FIFO queue | Snackbar updates to show the latest scanned item ("Added [Item] · [Undo]") anchored above the bottom HUD; tapping Undo immediately removes that item and restores the previous queue item | |
| Batch counter snackbar | Updates count ("Added 3 items · [Undo last]") with a "View scanned" action pill to review all items scanned in this session | ✓ |
| You decide | | |

**User's choice:** Batch counter snackbar: Updates count ("Added 3 items · [Undo last]") with a "View scanned" action pill to review all items scanned in this session
**Notes:** Provides a running count during multi-item scanning with quick access to review or undo.

---

## Deals & Flyers Browsing Layout

### Question 1: DealCard Layout on Compact Screens (<600px)
| Option | Description | Selected |
|--------|-------------|----------|
| Single-column horizontal list cards | Photo on the left (72×72dp), item title/store/validity dates in the middle, bold price with single tonal discount badge (-X%) and '+ Add' icon button on the right | ✓ |
| 2-column vertical grid cards | Photo on top with price and discount badge overlay, title and store below, and bottom '+ Add' button | |
| You decide | | |

**User's choice:** Single-column horizontal list cards
**Notes:** High information density and vertical scrolling ergonomics on mobile.

### Question 2: Lifted AddToListSheet Behavior
| Option | Description | Selected |
|--------|-------------|----------|
| Smart add | If user has 1 active list, add immediately with a persistent Undo Snackbar ("Added to [List] · [Undo]"); if multiple active lists exist, open the shared AddToListSheet to choose list & quantity | ✓ |
| Always open AddToListSheet | Tapping '+ Add' always opens the Modal Bottom Sheet to choose destination list, adjust quantity, and add optional notes | |
| You decide | | |

**User's choice:** Smart add
**Notes:** Eliminates friction for single-list households while seamlessly supporting multi-list households.

### Question 3: Filter Chips Presentation in DealSearchScreen
| Option | Description | Selected |
|--------|-------------|----------|
| Top filter strip + 'All filters' | Horizontal chips for Category ("Produce", "Meat"), Discount ("20%+ off"), and Store, plus an "All filters (N)" chip that opens the full Filter Modal Bottom Sheet | ✓ |
| Compact 'All filters' chip only | Keep the search header clean with only the 'Favorites | All stores' Segmented Button and an "All filters" filter chip opening the bottom sheet | |
| You decide | | |

**User's choice:** Top filter strip + 'All filters'
**Notes:** One-tap filtering for top categories with deep filtering accessible via modal sheet.

### Question 4: FlyersScreen to FlyerItemsScreen Navigation
| Option | Description | Selected |
|--------|-------------|----------|
| Card grid to dedicated items route | Flyer card with store logo, cover preview, validity dates, and item count badge; tapping navigates to FlyerItemsScreen with Top App Bar back navigation and deal grid | ✓ |
| Expandable inline flyer cards | Tapping a flyer card expands it inline into an embedded carousel of deals without route navigation | |
| You decide | | |

**User's choice:** Card grid to dedicated items route
**Notes:** Provides dedicated screen space for browsing large weekly circulars.

---

## the agent's Discretion

- Animation timing for grocery item check-off and list transitions (200–300ms CSS transitions).
- Barcode reticle aesthetic styling (subtle terracotta pulsing scan line and corner brackets).
- Modal sheet chip wrap layout and responsive density.

## Deferred Ideas

None — discussion remained strictly within the boundaries of Phase 19.

