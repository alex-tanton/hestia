---
phase: "17"
slug: "md3-foundation-token-pipeline-ui-primitives"
status: ready
nyquist_compliant: true
wave_0_complete: false
created: "2026-11-11"
updated: "2026-11-12"
---

# Phase 17 — Validation Strategy

> Per-phase validation contract mapping all 15 revised plans (Waves 1–12) and Wave 0 test scaffolds.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `5.0.1` (`unit` Node project + `dom` jsdom project; configured in Plan `17-02`) |
| **Config file** | `apps/web/vite.config.ts` |
| **Quick unit/dom check** | `pnpm --filter @hestia/web exec vitest run --project unit && pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/primitives.test.tsx src/components/ui/Toast.test.tsx src/components/ui/Icon.test.tsx` |
| **Release gate command (`17-15`)** | `pnpm --filter @hestia/web test:coverage && pnpm build && pnpm knip && node scripts/check-knip-baseline.mjs && pnpm jscpd && node scripts/audit-prod.mjs && node scripts/check-repo-hygiene.mjs` |
| **Max per-task feedback latency** | `< 30 seconds` for development tasks (`17-01`–`17-14`); `17-15` is the dedicated phase-end release verification gate |

---

## Sampling Rate

- **After every task (`17-01`–`17-14`):** Run the targeted task `<verify><automated>` command (focused Vitest file/project + `typecheck`/`lint`) keeping feedback under 30 seconds.
- **After Wave 11 completes:** Run Plan `17-15` Tasks 1–3 cleanly (`knip` + static checks, full `84/80/77/85` `test:coverage`, `pnpm build` + `0` WOFF2 + `jscpd` + `audit-prod` + `check-repo-hygiene`).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | FND-01 | T-17-01, T-17-SC | Exact-pin 4 OK pkgs; deterministic LF `--md-sys-*` static cascade | script | `pnpm --filter @hestia/web tokens` | ✅ (created) | ⬜ pending |
| 17-01-02 | 01 | 1 | FND-01 | T-17-02 | WCAG AA `>= 4.5:1` / `>= 3.0:1` across 5 `surfaceContainer*` tiers + system fonts | unit | `pnpm --filter @hestia/web exec vitest run src/tokens.test.ts` | ✅ (W1 rewrite) | ⬜ pending |
| 17-02-01 | 02 | 2 | FND-01 | T-17-03, T-17-04 | Complete `@theme inline` bridge incl. `--overlay`; dual `theme-color`; `unit`/`dom` `.test.ts` split | unit + dom | `pnpm --filter @hestia/web exec vitest run --project unit && pnpm --filter @hestia/web exec vitest run --project dom src/lib/auth/auth-client.test.ts src/lib/barcode/detector.test.ts src/lib/push/push-port.test.ts src/screens/deals/refresh-poll.test.ts src/lib/offline/chore-errand-writes.test.ts src/lib/push/device-subscription.test.ts` | ✅ | ⬜ pending |
| 17-02-02 | 02 | 2 | FND-01 | T-17-03 | Warm Terracotta launcher PNG icons + fast `unit` & `typecheck` (no slow Vite build) | asset + unit | `pnpm --filter @hestia/web icons && pnpm --filter @hestia/web exec vitest run --project unit && pnpm --filter @hestia/web typecheck` | ✅ | ⬜ pending |
| 17-03-01 | 03 | 3 | FND-02 | T-17-05, T-17-06 | ESLint `components/md/` fence preserving `CLOCK_READS`/`FORMATTER_READS`; forced `element-internals-polyfill`; `md-queries.ts` | static + tsc | `pnpm --filter @hestia/web typecheck && pnpm lint` | ❌ W3 (`test-setup.ts`, `md-queries.ts`) | ⬜ pending |
| 17-03-02 | 03 | 3 | FND-02 | T-17-05 | Zero-cast `@lit/react` form adapters (`MdButton`, `MdSelect`, `MdCheckbox`) | static + tsc | `pnpm --filter @hestia/web typecheck && pnpm eslint "apps/web/src/components/md/*.tsx" "apps/web/src/components/md/*.ts" "apps/web/src/test/md-queries.ts" --max-warnings=0` | ✅ (created) | ⬜ pending |
| 17-04-01 | 04 | 4 | FND-02 | T-17-07 | Remaining `@lit/react` adapters (`MdSwitch`, `MdRadio`, `MdDialog`, `MdMenu`, `MdTabs`, `MdProgress`) | static + tsc | `pnpm --filter @hestia/web typecheck && pnpm eslint "apps/web/src/components/md/*.tsx" "apps/web/src/components/md/*.ts" --max-warnings=0` | ✅ (created) | ⬜ pending |
| 17-04-02 | 04 | 4 | FND-02 | T-17-07 | Mandatory `D-13` 5-check jsdom smoke gate without host role hacks | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/primitives.test.tsx && pnpm --filter @hestia/web typecheck && pnpm lint && pnpm format:check` | ✅ (expand) | ⬜ pending |
| 17-05-01 | 05 | 5 | FND-03 | T-17-SC | Blocking human legitimacy review of `@material-symbols/svg-400@0.48.3` (`SUS: too-new`) | manual gate | Blocking `checkpoint:human-verify` (`gate="blocking-human"`) prior to `pnpm add` | N/A | ⬜ pending |
| 17-05-02 | 05 | 5 | FND-03 | T-17-08, T-17-SC | Curated static rounded SVG `<path d>` `Icon.tsx` (`aria-hidden="true"`, zero raw HTML, zero WOFF2) | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/Icon.test.tsx && pnpm --filter @hestia/web typecheck && pnpm lint` | ❌ W5 (`Icon.test.tsx`) | ⬜ pending |
| 17-06-01 | 06 | 6 | FND-02, FND-04 | T-17-09 | `Button` (`type="button"`, `autoFocus`, `RefCallback` `HTMLElement` refs in `IngredientRow`/`ChangeEmailForm`/`ChangePasswordForm`, shadow-DOM focus in `ChangeEmailForm:37`/`ChangePasswordForm:36`, separate `disabled`/`softDisabled`) | static + tsc | `pnpm --filter @hestia/web typecheck && pnpm eslint "apps/web/src/components/ui/Button.tsx" "apps/web/src/components/meals/IngredientRow.tsx" "apps/web/src/screens/settings/account/ChangeEmailForm.tsx" "apps/web/src/screens/settings/account/ChangePasswordForm.tsx" --max-warnings=0` | ✅ | ⬜ pending |
| 17-06-02 | 06 | 6 | FND-02, FND-04 | T-17-10 | `DateField`/`TimeField` (`56px` outlined MD3, `className` forwarding, `FieldChangeEvent`), zero-cast `Field` (`autoComplete`->`autocomplete`, complete prop forwarding, `aria-invalid`, date/time delegation) | static + tsc | `pnpm --filter @hestia/web typecheck && pnpm eslint "apps/web/src/components/ui/DateField.tsx" "apps/web/src/components/ui/TimeField.tsx" "apps/web/src/components/ui/Field.tsx" --max-warnings=0` | ✅ | ⬜ pending |
| 17-06-03 | 06 | 6 | FND-02, FND-04 | T-17-10, T-17-SC | Hybrid `Select` (`pointer: coarse` native vs fine `menuPositioning="fixed"`) + `primitives.test.tsx` form suite (`TextField` props, `rows={4}`, `<md-outlined-text-field>` `.focus()`) | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/primitives.test.tsx && pnpm --filter @hestia/web typecheck && pnpm lint && pnpm format:check` | ✅ | ⬜ pending |
| 17-07-01 | 07 | 7 | FND-02, FND-04 | T-17-12 | `Switch` (`selected`), cast-free `CheckboxChangeEvent` in `Checkbox`, `NotificationTypeRows` `<Switch onCheckedChange>` migration | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/primitives.test.tsx && pnpm --filter @hestia/web typecheck && pnpm lint` | ✅ | ⬜ pending |
| 17-07-02 | 07 | 7 | FND-02, FND-04 | T-17-11 | `ConfirmDialog` initial Cancel focus (`autoFocus` + `cancelRef.current?.focus()`), outside scrim block + loading lock, `OverflowMenu` (`positioning="fixed"`), `Tabs` | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/primitives.test.tsx src/components/ui/Icon.test.tsx && pnpm --filter @hestia/web typecheck && pnpm lint && pnpm format:check` | ✅ | ⬜ pending |
| 17-07-03 | 07 | 7 | FND-04 | T-17-SC | Shadow-DOM initial-field focus (`'md-outlined-text-field, input, textarea'`) in `JoinHouseholdStep:49`, `MagicLinkCodeScreen:55`, `RecipeForm:70` | static + tsc | `pnpm --filter @hestia/web typecheck && pnpm eslint "apps/web/src/screens/onboarding/JoinHouseholdStep.tsx" "apps/web/src/screens/onboarding/MagicLinkCodeScreen.tsx" "apps/web/src/screens/meals/RecipeForm.tsx" --max-warnings=0` | ✅ | ⬜ pending |
| 17-08-01 | 08 | 8 | FND-04 | T-17-13 | Native `<dialog>` `ModalBottomSheet`/`Sheet` (`overscroll-behavior: contain`, focus restoration, no fake drag chrome) | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/primitives.test.tsx && pnpm --filter @hestia/web typecheck && pnpm lint` | ✅ | ⬜ pending |
| 17-08-02 | 08 | 8 | FND-04 | T-17-14 | FIFO single-slot `Snackbar` (`Toast.tsx`, persistent Undo/Error) + `Toast.test.tsx` + `chores.test.tsx` | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/Toast.test.tsx src/screens/chores/chores.test.tsx && pnpm --filter @hestia/web typecheck && pnpm lint && pnpm format:check` | ✅ | ⬜ pending |
| 17-09-01 | 09 | 9 | FND-04 | T-17-15 | Light-DOM tonal `Card`, `ListRow`, `Badge`, and roving light-DOM `SegmentedControl` | static + tsc | `pnpm --filter @hestia/web typecheck && pnpm eslint "apps/web/src/components/ui/Card.tsx" "apps/web/src/components/ui/ListRow.tsx" "apps/web/src/components/ui/Badge.tsx" "apps/web/src/components/ui/SegmentedControl.tsx" --max-warnings=0` | ✅ | ⬜ pending |
| 17-09-02 | 09 | 9 | FND-04 | T-17-15 | `Skeleton`, `FormMessage` (`<div role="alert"><p>`), `CopyButton`, zero legacy imports left in `components/ui/` | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/components/ui/primitives.test.tsx src/components/ui/Toast.test.tsx src/components/ui/Icon.test.tsx && pnpm --filter @hestia/web typecheck && pnpm lint && pnpm format:check` | ✅ | ⬜ pending |
| 17-10-01 | 10 | 10 | FND-02, FND-04 | T-17-16 | Shared `browser.ts` `openMenu` + `shell.test.tsx` & `dashboard.test.tsx` sync | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/components/shell/shell.test.tsx src/components/dashboard/dashboard.test.tsx && pnpm lint` | ✅ | ⬜ pending |
| 17-10-02 | 10 | 10 | FND-02, FND-04 | T-17-16 | `write-queue`, `realtime`, and `about-sign-out` test sync via `md-queries.ts` | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/lib/offline/write-queue.test.tsx src/lib/realtime/realtime.test.tsx src/screens/settings/about-sign-out.test.tsx && pnpm lint && pnpm format:check` | ✅ | ⬜ pending |
| 17-11-01 | 11 | 11 | FND-02, FND-04 | T-17-17 | Settings test suites (`departure`, `notification-types`, `settings`, `system-health`) | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/settings/departure.test.tsx src/screens/settings/notification-types.test.tsx src/screens/settings/settings.test.tsx src/screens/settings/system-health.test.tsx && pnpm lint` | ✅ | ⬜ pending |
| 17-11-02 | 11 | 11 | FND-02, FND-04 | T-17-17 | Onboarding & `dashboard-route` test suites | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/onboarding/magic-link.test.tsx src/screens/onboarding/onboarding.test.tsx src/screens/dashboard-route.test.tsx && pnpm lint && pnpm format:check` | ✅ | ⬜ pending |
| 17-12-01 | 11 | 11 | FND-02, FND-04 | T-17-18 | Lists test suites (`BarcodeScannerDialog`, `ItemSheet`, `ListDetailScreen`, `lists`) | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/components/lists/BarcodeScannerDialog.test.tsx src/components/lists/ItemSheet.test.tsx src/screens/lists/ListDetailScreen.test.tsx src/screens/lists/lists.test.tsx && pnpm lint` | ✅ | ⬜ pending |
| 17-12-02 | 11 | 11 | FND-02, FND-04 | T-17-18 | Bills test suites (`bill-detail`, `bills-index`, `household-timezone`, `subscriptions`) | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/bills/bill-detail.test.tsx src/screens/bills/bills-index.test.tsx src/screens/bills/household-timezone.test.tsx src/screens/bills/subscriptions.test.tsx && pnpm lint && pnpm format:check` | ✅ | ⬜ pending |
| 17-13-01 | 11 | 11 | FND-02, FND-04 | T-17-19 | Chores & Errands test suites (`RotationEditor`, offline queues, `errands`, `household-timezone`) | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/components/chores/RotationEditor.test.tsx src/screens/chores/chores-offline-queue.test.tsx src/screens/chores/errands.test.tsx src/screens/chores/errands-offline-queue.test.tsx src/screens/chores/household-timezone.test.tsx && pnpm lint` | ✅ | ⬜ pending |
| 17-13-02 | 11 | 11 | FND-02, FND-04 | T-17-19 | Deals test suites (`deal-card`, `deal-search`, `favorites`, `flyers`) | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/deals/deal-card.test.tsx src/screens/deals/deal-search.test.tsx src/screens/deals/favorites.test.tsx src/screens/deals/flyers.test.tsx && pnpm lint && pnpm format:check` | ✅ | ⬜ pending |
| 17-14-01 | 11 | 11 | FND-02, FND-04 | T-17-20 | Meal component test suites (`MealPlacementSheet`, `MealSlotEntry`, `meal-components`) | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/components/meals/MealPlacementSheet.test.tsx src/components/meals/MealSlotEntry.test.tsx src/components/meals/meal-components.test.tsx && pnpm lint` | ✅ | ⬜ pending |
| 17-14-02 | 11 | 11 | FND-02, FND-04 | T-17-20 | Meal screen test suites (`household-timezone`, `planner`, `recipe-detail`, `recipe-library`, `suggestions`) | component (`dom`) | `pnpm --filter @hestia/web exec vitest run --project dom src/screens/meals/household-timezone.test.tsx src/screens/meals/planner.test.tsx src/screens/meals/recipe-detail.test.tsx src/screens/meals/recipe-library.test.tsx src/screens/meals/suggestions.test.tsx && pnpm lint && pnpm format:check` | ✅ | ⬜ pending |
| 17-15-01 | 12 | 12 | FND-01..04 | T-17-21 | Release gate: Knip baseline + workspace `typecheck`, `lint`, and `format:check` | static gate | `pnpm knip && node scripts/check-knip-baseline.mjs && pnpm typecheck && pnpm lint && pnpm format:check` | ✅ | ⬜ pending |
| 17-15-02 | 12 | 12 | FND-01..04 | T-17-21 | Release gate: Multi-project Vitest coverage (`84/80/77/85`) | coverage gate | `pnpm --filter @hestia/web test:coverage` | ✅ | ⬜ pending |
| 17-15-03 | 12 | 12 | FND-01..04, T-17-SC | T-17-21, T-17-SC | Release gate: `<= 200 KB` gzipped shell build, `0` WOFF2 precache, Terracotta metas, `jscpd`, `audit-prod`, LF hygiene | release build & audit | `pnpm build && node -e "..." && pnpm jscpd && node scripts/audit-prod.mjs && node scripts/check-repo-hygiene.mjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 / Scaffold Creation Order

- `Plan 17-01` (`Wave 1`): Creates `apps/web/scripts/generate-tokens.mjs`, `apps/web/src/styles/tokens.css`, and rewrites `apps/web/src/tokens.test.ts` before Wave 2 `vite.config.ts` / `index.css` integration.
- `Plan 17-02` (`Wave 2`): Updates `apps/web/vite.config.ts` splitting pure-Node `unit` (`exclude: DOM_UNIT_TS_TESTS`) vs jsdom `dom` (`src/**/*.test.tsx` + 6 browser/RTL `.test.ts` suites) while preserving `84/80/77/85` coverage thresholds.
- `Plan 17-03` (`Wave 3`): Adds forced `element-internals-polyfill@3.0.2` bootstrap (`apps/web/src/test-setup.ts`) and shared Shadow DOM RTL helpers (`apps/web/src/test/md-queries.ts`), plus preserves `CLOCK_READS`/`FORMATTER_READS` in `eslint.config.js`.
- `Plan 17-05` (`Wave 5`): Sequences `@material-symbols/svg-400` human verification gate and creates `apps/web/src/components/ui/Icon.test.tsx` cleanly after Wave 3 `test-setup.ts` and Wave 4 `D-13` settle.
- `Plan 17-08` (`Wave 8`): Updates `apps/web/src/components/ui/Toast.test.tsx` and `apps/web/src/screens/chores/chores.test.tsx` alongside FIFO persistent Undo/Error `Snackbar`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supply-chain review of `@material-symbols/svg-400@0.48.3` (`SUS: too-new`, published 2026-11-04) | FND-03 | `gsd-tools package-legitimacy check` flagged package age (`<14d`) prior to `pnpm add` | Verify npm provenance attestation / release tarball in Plan `17-05` Task 1 (`checkpoint:human-verify`, `gate="blocking-human"`) before running `pnpm add` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands or explicit `blocking-human` supply-chain checkpoint (`17-05` Task 1)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave/Plan order satisfies every test harness (`tokens.test.ts`, `unit`/`dom` split, `test-setup.ts`, `md-queries.ts`, `Icon.test.tsx`, `browser.ts`) before dependent suites run
- [x] No watch-mode flags anywhere
- [x] Per-task feedback latency `< 30s` across Plans `17-01`–`17-14`; heavy build/coverage/audit checks isolated cleanly to Plan `17-15` release gate
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution
