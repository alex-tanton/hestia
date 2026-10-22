# Hearth — Design Reference

Color, type, spacing, icon, motion, and voice tokens are in `docs/branding.md`. Tokens are
referenced here by name (the accent color token, the section color).

## 1. Navigation and shell

The shell (`apps/web/src/components/shell/AppShell.tsx`) renders a sticky top bar, the page
content, and a tab bar, wrapped in a `SectionProvider` that colors the active screen's section
accent throughout.

Five top-level pillars, defined once in `apps/web/src/lib/sections.ts`: **Dashboard**, **Lists**,
**Meals**, **Bills**, **Chores**. Below `lg` (1025px, Tailwind's `--breakpoint-lg: 64.0625rem` in
`apps/web/src/index.css`), `TabBar.tsx` renders them as a fixed bottom tab bar; at `lg` and above
the same five items become a left sidebar with labels (`apps/web/src/components/shell/TabBar.tsx`).
The active tab is marked three ways at once — the section color, a heavier label weight, and an
indicator bar — never by color alone.

Four of the five pillars have sub-tabs (Lists → Lists/Deals/Flyers/Pantry; Meals →
Planner/Recipes/Suggestions; Bills → Bills/Subscriptions; Chores → Chores/Errands), listed in each
pillar's `subTabs` array in `sections.ts`. Dashboard has none.

The top bar (`TopBar.tsx`) shows the household switcher on the left at a tab's root, replaced by a
back control on any pushed detail screen — `screen-chrome.tsx`'s `useScreenChrome` hook lets a
detail screen register its own title and the path its back control returns to (always the screen
that pushed it, not the tab root). Settings opens from an icon on the right, always present.

**Household switching** is a bottom sheet (`HouseholdSwitcher.tsx`, opened from the top bar):
current household marked, other memberships listed, "Join or create a household" below. Picking a
different household calls `switchHousehold`, then navigates to `/` — `AuthenticatedLayout.tsx`'s
`onSelect` handler — which is how the app resets every tab to its root on a switch. A scroll-memory
hook (`useTabScrollMemory` in `AppShell.tsx`) keeps each tab's scroll position when just switching
tabs, but clears all of it when the household changes.

An unreleased pillar (tracked in `RELEASED_PILLARS` in `sections.ts`) is still a visible, tappable
tab — it just renders a coming-soon placeholder instead of being hidden or disabled, so the tab bar
never visibly changes shape between releases.

## 2. State-pattern philosophy

Every data-bearing screen is expected to represent: **loading**, **populated**, **empty**,
**error**, and **offline**. Three shared primitives carry this consistently across the app,
defined in `apps/web/src/components/states/StateBlocks.tsx` and
`apps/web/src/components/ui/Skeleton.tsx`:

- `SkeletonRows` — loading. Mirrors the final layout (rows with an icon-sized block and a text-sized
  block, not a grey rectangle), is `role="status" aria-busy="true"` with a `label` prop for screen
  readers, and only renders its visual rows after a delay (`useDelayedVisible`) so a fast response
  never flashes a skeleton.
- `EmptyState` — covered in detail in §3.
- `ErrorState` — an inline `CircleAlert` icon, a message describing what failed, and a `Try again`
  button plus an optional `alternative` action (a route forward when retry can't help). It renders
  inline in the failing region, never as a full-screen takeover — e.g. `AuthenticatedLayout.tsx`
  uses it for a failed profile fetch while the shell around it still renders.
- `OfflineState` — a dedicated `WifiOff`-icon block for screens that need live data and have
  nothing cached to fall back to (e.g. deal search offline).

Screens compose these directly rather than reinventing loading/error/empty markup — for example
`NotificationTypes.tsx` picks between `SkeletonRows`, `OfflineState`, `ErrorState`, and its own
populated list based on query state, and `AuthenticatedLayout.tsx` does the same one level up for
the whole app shell.

Offline is detected app-wide by `useOnlineStatus` (`apps/web/src/lib/use-online-status.ts`,
wrapping `@tanstack/react-query`'s `onlineManager`) and surfaced through the persistent
`OfflineBanner` (`apps/web/src/components/shell/OfflineBanner.tsx`) mounted in the shell header,
below the top bar. The banner is `role="status"`, always mounted (empty when online), so its
appearance is announced without stealing focus.

## 3. Empty states

The structural pattern, `EmptyState` in `StateBlocks.tsx`: a section-colored icon, one line of body
copy explaining *why* it's empty and what the screen is for, and an optional single primary action
button. No illustration, no multi-paragraph copy.

The principle, visible in the component's own doc comment and its callers: never just show nothing.
First-run empty copy ("Nothing due this week", "No notification types to turn on yet. Join a
household to get reminders.") is written distinctly from filtered-empty copy ("No deals match
these filters" + a clear-filters action) — the two states share the component but never share
wording, because the fix for one (do something to populate it) is not the fix for the other (loosen
a filter).

A larger version of the same shape is `DashboardFirstRun`
(`apps/web/src/components/dashboard/DashboardFirstRun.tsx`): a `Card`, a section-colored heading
with an icon, a body paragraph, and one `Create a list` action — shown in place of all shipped
pillars' empty dashboard cards at once when the whole household has no data yet. Unshipped-pillar
placeholders are unaffected and keep their position, so the dashboard layout never reflows as
pillars ship.

Empty-state examples: the dashboard first run, bills/chores/errands first run (`bills, first
run`, `chores, first run`, `errands, first run` cases in `e2e/tests/17-accessibility-states.spec.ts`),
recipe library empty, planner empty, archived lists empty, pantry empty.

## 4. Confirmation and destructive actions

Two tiers, not one:

**Simple confirm** — `ConfirmDialog` (`apps/web/src/components/ui/ConfirmDialog.tsx`), a Radix
`AlertDialog`: traps focus, opens with focus on Cancel, cannot be dismissed by an outside click, and
names the consequence in its description. Used for reversible-enough or lower-stakes destructive
actions: deleting a list ("Delete This Week? Its 15 items are removed permanently."), skipping a
bill, deleting a chore or recipe.

**Typed-name confirm** — the same `ConfirmDialog`, but with a `TextField` passed as its `children`
and the confirm button's `isConfirmDisabled` wired to whether the typed text matches exactly. This
is the pattern for the one truly unrecoverable action in the app: deleting a household when the
last member leaves. `DeleteHouseholdPanel.tsx` computes a `deletionSummary` naming what will be lost
("This deletes 4 lists, 23 recipes, and 6 chores permanently") and only enables the destructive
button once the typed text equals `preview.householdName` exactly.

The dividing line is irreversibility plus blast radius: one household, one typed-name
gate. Everything else destructive — a single list, chore, recipe, bill — gets the plain
`ConfirmDialog` with consequence-naming copy but no typed confirmation.

## 5. Container choice: sheet vs. dialog vs. full screen

Three containers, three distinct jobs:

- **Dialog (`ConfirmDialog`, a Radix `AlertDialog`)** — destructive confirmation only. Nothing else
  in the codebase uses a blocking dialog; there is no general-purpose `Dialog.tsx`, only the
  alert-dialog wrapper described in §4.
- **Sheet (`apps/web/src/components/ui/Sheet.tsx`, a Radix `Dialog` styled as a bottom sheet)** —
  quick actions that stay anchored to their context: adding a list item, adding an errand, the
  household switcher, placing a recipe on the planner (`PlaceOnPlannerSheet`), the list/recipe
  pickers (`ListPickerSheet`, `RecipePickerSheet`, `MatchToSheet`). It slides up from the bottom,
  traps focus, and returns focus to its trigger on close.
- **Full-screen pushed route** — a focused task that's substantial enough to be its own screen:
  the chore and recipe forms (`ChoreFormScreen.tsx`, `RecipeForm.tsx`), the bill sheet (despite its
  name, implemented as a pushed screen per `BillDetailScreen.tsx`), departure/leave-household
  (`DepartureScreen.tsx`). These register themselves with `useScreenChrome` (title + `backTo`), so
  the top bar's household switcher is replaced by a back control that returns to the screen that
  pushed it, not the tab root.

Rule of thumb: a dialog interrupts and asks yes/no; a sheet is a quick,
contextual add/pick that the underlying screen still matters for; a pushed screen is a task with
enough fields or a long enough flow that it earns its own back-stack entry.

## 6. Offline and sync UX

Detection is `useOnlineStatus` (`apps/web/src/lib/use-online-status.ts`); presentation is the
persistent `OfflineBanner` plus per-control messaging:

- A **queueable write** (list item add/check/uncheck/edit, chore-complete and errand-done)
  applies optimistically and queues via TanStack Query's mutation cache
  (`apps/web/src/lib/offline/write-queue.ts`, `chore-errand-writes.ts`). The affected row gets a
  `PendingMark` (`apps/web/src/components/lists/PendingMark.tsx`): a clock icon plus a screen-reader
  label ("Waiting to sync"), and a section-accent-colored left edge — never a reduced opacity,
  because blending text toward the background would drop it below the 4.5:1 contrast ratio.
- A **non-queueable write control** (anything not on that short list) is disabled while offline,
  with a `text-secondary` line beside it reading "Needs a connection." (or the screen's own variant,
  e.g. `WRITE_NEEDS_CONNECTION` in `notification-copy.ts`), and the same text goes into the
  control's `aria-describedby`. The control is never hidden.
- **Reconnect** is handled by `useWriteQueue` (`apps/web/src/lib/offline/use-write-queue.ts`),
  mounted once in the shell inside the toast provider: it watches the mutation cache, and when
  previously-paused writes finish replaying it fires a success toast counting how many changes
  synced (`pluralize(synced, 'change')} synced.`). A write that fails for good (not just paused
  offline) is dropped from the queue and announced once as a count, naming no specific chore,
  errand, or member.
- **Durability**: a second, unthrottled persister (`flushPersister`) saves the query cache the
  moment a write is newly paused offline, deliberately bypassing the normal 1-second-throttled
  persister in `persist.ts` — so a write made right before a tab close or crash is still on disk.
  The rule this encodes: a queued action is never silently lost, even across a reload or a browser
  restart.

## 7. Notifications UX

`NotificationTypes.tsx` and `NotificationTypeRows.tsx` (under `apps/web/src/screens/settings/`)
drive this off two independent axes: the browser's actual `Notification.permission`/push support,
and the saved preference rows from the server.

Device/browser states, each with its own line of copy (`notification-copy.ts` /
`NotificationTypeRows.tsx`):

- **Unsupported** — browser has no push APIs (or the build has no VAPID key): no switches shown.
- **iOS, not installed on the home screen** — shows the install-to-home-screen instructions in place
  of the switches, since iOS Safari push requires the PWA to be installed.
- **Denied** — the browser permission is `denied`; explained once, never prompted again (the
  browser itself blocks re-prompting). Switches still save even though push can't register.
- **Dismissed** — permission is still `default` after a type was turned on; explained, and the
  prompt is asked again the next time a type is switched on.
- **Registration failed** — a device failed to register for push after a type was turned on;
  surfaced locally via `registrationFailed` state, not a server round-trip.

These device notes are recomputed from the live browser permission and the saved preferences on
every render (`deviceNoteFor` in `NotificationTypes.tsx`), so a denied/dismissed explanation
reappears correctly on a later visit to Settings rather than being a one-time toast.

The permission prompt itself only ever appears as a side effect of switching a type on
(`handleToggle` calls `enable()` only after the preference write succeeds) — never on page load.

Preferences are presented as one switch per notification type (`PreferenceList`), each with its own
name as its accessible label and its description as the accessible description; a save is announced
through a `role="status"` region (`"Saving…"` / `"Notification settings saved."` /
`"Couldn't save that setting. Try again."`) that is mounted empty from the start so the first
result is reliably announced, per §8.

## 8. Accessibility commitments

**WCAG 2.1 Level AA is the baseline**, enforced in the E2E suite: `e2e/support/axe.ts` runs
`@axe-core/playwright` with tags `wcag2a, wcag2aa, wcag21a, wcag21aa` against every screen state a
journey visits, and fails the test on any violation (`expectAccessible`). Axe is stated to catch
"roughly half of real issues," so it's a floor, not the whole accessibility story.

**Focus management when a form replaces a trigger**: in `ChangePasswordForm.tsx`, an
effect watches `isOpen` and, on the transition, moves focus into the form's first input when it
opens and back onto the trigger button when it closes, rather than letting focus fall back to the
document. The same idiom (trigger ref + open-state effect) is the shared approach for any
disclosure that swaps a button for the form it opens. Sheets and dialogs get the equivalent trap
and return-to-trigger behavior for free from Radix (`Sheet.tsx`, `ConfirmDialog.tsx`).

**Live regions for async status**: the save-result region in `NotificationTypes.tsx` and the
`OfflineBanner` both use `role="status"` and are mounted permanently (empty string when there's
nothing to say), not conditionally rendered, because a region that arrives
already populated is announced unreliably by assistive tech.

**Both themes are checked, not just light**: `e2e/tests/17-accessibility-states.spec.ts` iterates
`THEMES = ['light', 'dark']` and runs the full state list (sign-in, dashboard first run, offline
states, every dialog, notification permission states, etc.) under `test.use({ colorScheme: theme })`
for each. Theming itself is a single `prefers-color-scheme: dark` media query over CSS custom
properties in `apps/web/src/index.css` — there is no manual in-app theme toggle or `data-theme`
switch; the app follows the OS/browser preference.

**Minimum supported width**: no explicit `min-width` guard exists. The layout is
built mobile-first with `max-w-160` (640px) and no breakpoint below `lg`; narrower phone widths
rely on standard flex/wrap behavior rather than a stated floor. 320px is the practical lower
bound, with no enforced guard or test for it.

## 9. Responsive and theming

**Breakpoint**: exactly one is defined, `--breakpoint-lg: 64.0625rem` (1025px) in `index.css` — the
point at which `TabBar` switches from a fixed bottom bar to a left sidebar
(`lg:inset-y-0 lg:left-0 lg:w-56 ...` in `TabBar.tsx`) and `AppShell` adds `lg:pl-56` to push content
clear of it. Below `lg`, content is constrained to `max-w-160` (640px) and centered; at `lg` and
above it widens to `max-w-240` (960px). Tailwind's default `sm` (640px) breakpoint still exists and
is used sparingly for minor in-page layout (e.g. a two-column grid in `FlyersScreen.tsx`), not for
shell-level restructuring.

**Theming**: light/dark is driven entirely by `@media (prefers-color-scheme: dark)` overriding a set
of CSS custom properties (`--bg-base`, `--text-primary`, the per-section `--lists`/`--meals`/etc.
tokens, and so on) — defined once in `index.css`'s `:root` block and its dark-mode override. There
is no JS-driven theme state; components reference role-based utility classes (`bg-base`,
`text-section`, `text-on-section-badge`) that resolve differently per theme automatically.
`prefers-reduced-motion: reduce` similarly collapses all animation/transition durations to zero in
the same file's `@layer base` block. The `17-accessibility-states.spec.ts` theme loop (§8) covers
every state as both an accessibility check and a dark-mode render check.
