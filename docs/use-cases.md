# Hearth — Use Cases

## Actors

- **Owner** — the household admin. Exactly one per household (the role is transferable; the creator holds it initially). Can create, view, and revoke invites; remove members; transfer the admin role; and change the household's name, postal code, and timezone. Everything a Member can do, an Owner can also do. Separately, the **server owner** (the account whose email equals `HESTIA_OWNER_EMAIL`) is a single person across the whole deployment who sees Settings → About → System health and runs the password-reset CLI; this is an infrastructure role, not a household role, and is called out explicitly wherever it applies.
- **Member** — any other household member. May create, edit, and delete lists, list items, recipes, meal-plan entries, pantry items, match overrides, chores, errands, household bills, and favorite stores. May leave the household on their own. Cannot manage membership or change household-level settings.
- **System** — the backend service's scheduled jobs and background processes: the daily deal refresh, the notification outbox and dispatch job, the autopay logger, readiness recomputation, and push delivery. Initiates use cases on a schedule or in reaction to data changes, never at a user's direct request.

---

## Identity and households

### Use case: Sign up

- **Actor:** a new user (unauthenticated)
- **Preconditions:** the server is reachable; signup is open (rate-limited only, no invite required to create an account)
- **Main flow:**
  1. The user submits an email, password, and display name (or leaves display name blank).
  2. The service checks the password is at least 8 characters and is not on the common-password list (the 10,000 most common passwords of at least 8 characters, compared case-insensitively) kept in `packages/shared`. The password is capped at 72 bytes, the most bcrypt reads.
  3. GoTrue creates the account. The email is autoconfirmed — nothing is ever emailed, so the email serves only as a login identifier and is never verified.
  4. A trigger creates the `profile` row, copying `display_name` and `timezone` from the signup's browser-supplied metadata.
  5. The user is signed in and lands on onboarding's create-or-join step, since they belong to no household yet.
- **Alternate/exception flows:**
  - **Common or short password:** rejected with a specific message; GoTrue enforces the minimum length, and both the PWA and the service check the common-password list.
  - **Blank display name:** falls back to the part of the email before the `@`.
  - **Missing or unrecognized browser timezone:** `profile.timezone` falls back to `UTC` until the app's next open replaces it.
  - **Rate limit exceeded:** signup is refused, along with every other API route, past the server's per-IP request budget (see `docs/deployment.md`'s environment variable table for the configured limit).
- **Postconditions:** an `auth.users` row and a matching `profile` row exist; the user is signed in with no household membership and no `active_household_id`.

### Use case: Create a household

- **Actor:** Member (becomes Owner of the new household)
- **Preconditions:** the user is signed in
- **Main flow:**
  1. The user enters a name and a five-digit US postal code (required).
  2. `household.timezone` is set from the creator's browser.
  3. A `household_member` row is created for the user with role `admin`.
  4. `profile.active_household_id` is set to the new household.
- **Alternate/exception flows:**
  - **Invalid postal code:** rejected — a five-digit US ZIP is required.
- **Postconditions:** exactly one admin row exists for the household; the household becomes the user's active household on every device they sign in on, since the active household is stored server-side.

### Use case: Invite someone to a household

- **Actor:** Owner
- **Preconditions:** the actor is the household's admin
- **Main flow:**
  1. The admin creates an invite. The service generates an opaque random token (for a shareable link) and an 8-character code drawn from the Crockford Base32 alphabet (no I, L, O, or U).
  2. Both credentials are stored only as SHA-256 hashes, in lowercase hex.
  3. `expires_at` is set to exactly 7 days after `created_at`.
  4. The admin shares the link or the code with the invitee by any out-of-band means (Hearth never emails it).
  5. The admin can view the list of outstanding invites for the household at any time, and can revoke one — revocation takes effect immediately for both the link and the code.
- **Alternate/exception flows:**
  - **Non-admin attempts to create an invite:** refused.
- **Postconditions:** a `household_invite` row exists, redeemable any number of times until revoked or until it expires 7 days after creation.

### Use case: Join a household by invite

- **Actor:** Member (a new or existing user)
- **Preconditions:** the user has a valid invite link or an 8-character code; the invite has not expired or been revoked
- **Main flow:**
  1. During signup, or from Settings as an already signed-in user adding another household, the user enters the code or follows the link.
  2. The service hashes the supplied credential and matches it against `household_invite`.
  3. A `household_member` row is created for the user with role `member`, `joined_at` set to now.
  4. If this is the user's first household, `profile.active_household_id` is set to it.
- **Alternate/exception flows:**
  - **Invalid code or token:** rejected with an error; no membership is created.
  - **Expired invite (more than 7 days old):** rejected, even if the admin never explicitly revoked it.
  - **Revoked invite:** rejected immediately, for both the link and the code, regardless of expiry.
  - **Already a member:** redeeming the same invite again when the user is already a member of that household — the invite remains reusable for others; this call changes nothing for the already-joined user.
- **Postconditions:** the user has a `household_member` row for the household; the invite remains valid for further redemptions until it is revoked or expires.

### Use case: Switch active household

- **Actor:** Member or Owner, belonging to more than one household
- **Preconditions:** the user belongs to at least one household
- **Main flow:**
  1. The user taps the household switcher in the top bar, which lists every household they belong to.
  2. The user selects a different household.
  3. `profile.active_household_id` is updated server-side.
  4. The entire app context swaps — this is a full switch, not a merged view — and the newly active household's local data (its postal code's deals, its lists, etc.) becomes what every screen shows, on every device the user is signed in on.
- **Alternate/exception flows:**
  - **A notification tap for a different household:** opens that household directly and makes it the active household, bypassing the switcher.
- **Postconditions:** `profile.active_household_id` points at the newly selected household; all screens reflect it.

### Use case: Remove a member (or a member departs)

- **Actor:** Owner (removing another member) or Member (leaving on their own)
- **Preconditions:** for removal, the actor is the household's admin; for self-departure, no special precondition
- **Main flow:**
  1. The initiating user (the admin removing someone, or the member leaving) is shown a departure preview of everything the departing member owns: lists they created, chores assigned to them, open errands assigned to them, and unarchived household bills they own. The preview also lists every rotation the member is in, without asking for reassignment, naming who inherits the turn (e.g., "Will be removed from rotation; the turn passes to Sam").
  2. The initiating user reassigns each owned item to a remaining member. Done errands and archived bills are left alone — they keep the departed member's id, like other history.
  3. The reassignment and the departure happen in one transaction: either both happen, or neither does.
  4. The departing member is removed from every rotation order they are in, which rebases `rotation_offset` per the Rotation rule below.
  5. The `household_member` row is deleted. Row-level security ends that user's access immediately.
  6. All of the departed user's unsent notifications about that household are deleted, since they could no longer open it. Their `notification_preference` rows for that household are also deleted.
  7. The departed user's `active_household_id` moves to their longest-held remaining membership (earliest `joined_at`), or to null if they have none, which sends them to onboarding's create-or-join step.
- **Alternate/exception flows:**
  - **Last member leaves:** the household and all its data are deleted — lists, pantry, recipes, meal plans, match overrides, chores, errands, household bills, favorite stores, and invites. There is nothing to reassign. The initiating user must type the household's name to confirm, after seeing counts of what will be lost (e.g., "This deletes 4 lists, 23 recipes, and 6 chores permanently"). Deletion is irreversible.
  - **The admin leaves without transferring first:** the longest-tenured remaining member, by `joined_at`, is promoted automatically, so the household is never left without an admin. The departing admin still completes the reassignment before leaving.
  - **A chore rotation has only one other member:** that member's `rotation_order` becomes null once the departing member is removed, per the rebase rule's `n = 1` case.
  - **Personal bills:** never appear in the departure preview and are never reassigned — they belong to the user, survive household deletion, and leave with the user.
- **Postconditions:** the departing user has no further access to the household (immediate, via RLS); every reassigned item has a new, current owner; history (`chore_completion`, `bill_payment_log`) keeps the departed user's id unchanged and is shown as "Former member" once they are not a current member (or by name again if they rejoin).

### Use case: Reset a forgotten password

- **Actor:** Member or Owner (any user who forgot their password) and the server owner
- **Preconditions:** none for the user; the server owner must have shell access to the service container
- **Main flow:**
  1. The user opens the in-app "Forgot password" screen, which tells them to ask the server owner. There is no email-based reset.
  2. The server owner runs `hestia-admin reset-password <email>` in the service container.
  3. The CLI prints a one-time reset link.
  4. The server owner hands the link to the user in person.
  5. The user follows the link and sets a new password, subject to the same password policy as signup (8+ characters, not on the common-password list, re-entry of... — not applicable here since there is no current password yet).
- **Alternate/exception flows:**
  - **User is not the server owner and has no way to receive email:** this is the only path — no self-service email reset exists by design (no domain, no SMTP relay, to keep hosting free).
- **Postconditions:** the user's password is changed; the one-time link is no longer valid for reuse.

### Use case: Change account details

- **Actor:** Member or Owner
- **Preconditions:** the user is signed in
- **Main flow:**
  1. In Settings → Account, the user changes their display name, email, or password.
  2. Changing the email or the password requires re-entering the current password.
  3. A password change is checked against the same policy as signup (length, common-password list).
- **Alternate/exception flows:**
  - **Current password re-entry is wrong:** the email or password change is rejected.
  - **New password fails the common-password or length check:** rejected.
- **Postconditions:** the relevant `profile`/`auth.users` field is updated.

---

## Deals and shopping lists

### Use case: Search for deals

- **Actor:** Member or Owner
- **Preconditions:** the household has a postal code; the user has an active household
- **Main flow:**
  1. The user enters a keyword in Deal search.
  2. The user optionally filters by store, category, and price range, and sorts by relevance or price.
  3. The service checks `deal_query_cache` for the (postal code, normalized query) key; on a cache miss it calls the Flipp wrapper's search mode live.
  4. Results are returned: item name, sale price with its unit (each, /lb, /oz), original price where available, discount, store, and the deal's valid date range. A deal whose price depends on a digital coupon or a loyalty card carries a conditional-price badge naming which it is.
- **Alternate/exception flows:**
  - **Live fetch fails and a cache exists:** stale cached results are shown with an "as of" date rather than an empty screen.
  - **Live fetch fails and no cache exists:** a refreshing/empty state is shown instead.
  - **Keyword search on a dormant postal code:** unaffected by dormancy — a cache miss always fetches live, under normal rate discipline (no on-demand-refresh queuing, unlike flyer browsing).
- **Postconditions:** `deal_query_cache` is updated (on a live fetch) with the ids of deals the search returned.

### Use case: Browse flyers

- **Actor:** Member or Owner
- **Preconditions:** the household has a postal code
- **Main flow:**
  1. The user opens Browse flyers, which lists every active weekly flyer near the household's ZIP.
  2. The user drills into one flyer to see its full contents (every item inside it, via the wrapper's flyerItems mode).
- **Alternate/exception flows:**
  - **Postal code is dormant** (no household there has had activity in the last 14 days) **and has not already had an on-demand refresh that UTC day:** the request queues one background refresh of that postal code's flyers and flyer items, going through the same serialized queue and circuit breaker as the daily refresh. Until it finishes, the UI shows whatever is cached in a stale "as of" state, or a "refreshing" state if nothing is cached. The request also updates the postal code's `last_active_at`, so it joins the daily refresh set from then on.
  - **Fetch fails with a warm cache:** stale results shown with an "as of" date.
- **Postconditions:** flyer and flyer-item data for the postal code is as fresh as the most recent refresh (daily, or the queued on-demand one for a dormant code).

### Use case: Build and manage a shopping list

- **Actor:** Member or Owner
- **Preconditions:** the user has an active household
- **Main flow:**
  1. The user creates a list (a household may keep several; one per week is the common case).
  2. Items are added from a deal result, from a recipe's ingredients, from a meal plan, or typed manually.
  3. Each item carries a status: needed, in cart, or bought, and records who added it.
  4. An item added from a deal takes a snapshot of that deal (merchant, sale price, price unit, validity, conditional flag) rather than a live reference, because Flipp item ids change weekly.
  5. The list groups items by store. Items from a deal carry their store (`merchant_id`/`merchant_name`) automatically; manual items can be assigned a store or left unassigned.
  6. Each store group shows a subtotal (see Subtotals rule below).
  7. The list can be archived (hidden from the main view, still readable, and can be unarchived) or deleted.
- **Alternate/exception flows:**
  - **Subtotals rule:** an item priced `each` counts `price × quantity` with a missing quantity counting as 1; an item priced `lb` counts `price × quantity` in pounds and is excluded with no quantity; every other item (including per-oz items and items with no price) is excluded, and the store header shows "+N unpriced" for the excluded count. Subtotals round half-up to cents.
  - **Deleting a list:** requires confirmation naming the item count, e.g. "Delete This Week? Its 15 items are removed permanently." Deletion removes the list and its items permanently.
  - **Bought items:** stay on the list in a collapsed, dimmed "Bought (n)" group rather than disappearing.
  - **Archived list write:** the app shows it read-only except for unarchive/delete, but the API still accepts an item write against an archived list, because a queued offline write must never be refused for a state that changed while the device was offline — last write wins there as everywhere else.
  - **Expired deal repricing:** an item whose `deal_valid_to` has passed and whose status is not bought is repriced after every deal refresh and whenever the list is viewed. It is re-matched by `merchant_id` + `normalized_name` (never the Flipp item id). The new price is the matching current deal's price if one exists (lowest `unit_price` wins when several match); otherwise the item's known `regular_price`; otherwise the price is cleared and shown as no price — never guessed. The previous sale price is kept in `original_sale_price` (written once, at the item's original add time) and `repriced_at` records when. Repricing writes only when a value actually changes, so re-running it over an already-corrected item does nothing.
- **Postconditions:** the list reflects current items, statuses, and up-to-date (repriced where needed) pricing; `shopping_list.updated_at` is bumped by any change.

### Use case: Add deal items to a list from a flyer or search result

- **Actor:** Member or Owner
- **Preconditions:** a deal result or flyer item is visible
- **Main flow:**
  1. The user taps "add to list" on a deal.
  2. The service snapshots the deal's merchant, sale price, price unit, validity, and conditional flag onto a new `shopping_list_item` with `source = from_deal`.
- **Alternate/exception flows:**
  - **The response is lost after the add landed:** the app shows an error, and the next tap on the same deal for the same list carries the item id of the failed attempt, so the service keeps the one row that landed and the repeat changes nothing. Only a success starts the next add with a fresh id. The id is held in memory per list, deal and signed-in user, so it survives the card unmounting but not a reload. Adding a deal is an online action and is not queued while offline.
- **Postconditions:** a new list item exists carrying the deal snapshot; it is independent of the live deal from that point on.

### Use case: Edit a shopping list item while offline

- **Actor:** Member or Owner
- **Preconditions:** the app has a service worker caching the shell and a last-synced copy of the list; the device is offline
- **Main flow:**
  1. The user adds, checks, unchecks, or edits a list item while offline.
  2. TanStack Query queues the write to IndexedDB, and a visible "offline — changes will sync" indicator confirms the action was recorded locally, not lost.
  3. On reconnect, queued writes replay in the order they were made.
  4. Each write is idempotent: inserts use client-generated UUIDs and ignore duplicates; updates set absolute values ("status = bought"), never toggles or increments — so a replayed write that already landed changes nothing.
- **Alternate/exception flows:**
  - **Conflict on reconnect:** last write to arrive wins. If a member marks an item "in cart" offline while another marks it "bought" online, the offline write arriving later on reconnect moves the item back to "in cart". This is an accepted quirk of the conflict model, not a bug.
  - **Action not supported offline:** deal search, flyer browsing, recipe import, household membership changes/invites, and any create/edit/delete not in the offline-supported list (list items, chore completion, errand done) is disabled offline with an inline explanation.
- **Postconditions:** the item's state matches the user's last offline action once synced; no duplicate or double-applied write exists.

### Use case: Real-time sync between household members

- **Actor:** System (realtime channel), triggered by a Member's or Owner's write
- **Preconditions:** two or more members have the same list open, online
- **Main flow:**
  1. One member checks off (or adds, or edits) an item.
  2. The change syncs live to every household member via the realtime backend.
  3. Other members see the change reflected immediately, without a manual refresh.
- **Postconditions:** all connected clients converge on the same list state within about a second.

### Use case: Manage the pantry

- **Actor:** Member or Owner
- **Preconditions:** the user has an active household
- **Main flow:**
  1. The user views pantry items: a name plus an optional free-text quantity note.
  2. The user adds, edits, or removes a pantry item manually.
  3. From a list, the user adds its bought items to the pantry in one action.
  4. Each bought item becomes a pantry item under its `normalized_name`: an existing pantry entry is refreshed, a new name is added. The list's quantity does not follow into the pantry — the pantry does not do quantity arithmetic. Bought items remain on their list.
- **Postconditions:** pantry items are unique per (`household_id`, `normalized_name`); readiness scoring reflects the updated pantry on its next recompute.

---

## Meal planning and recipes

### Use case: Import a recipe by URL

- **Actor:** Member or Owner
- **Preconditions:** the user has a recipe URL; the device is online (recipe import is not available offline)
- **Main flow:**
  1. The user pastes a URL into the recipe library's import flow.
  2. The service fetches the page and parses its schema.org / JSON-LD recipe markup.
  3. JSON-LD ingredient lines (free text like "2 cups chopped yellow onion") are split into quantity, unit, and item name by an ingredient-line parser library. The original line is kept in `recipe_ingredient.raw_text`.
  4. The parsed recipe (title, source URL, instructions, servings, ingredients) is shown in an editable preview; the user can correct the split before saving.
  5. The user saves the recipe.
- **Alternate/exception flows:**
  - **Page has no JSON-LD, or parsing fails:** falls back cleanly to an editable manual-entry form rather than erroring out.
  - **Servings:** are recorded as published and never scaled by the app.
- **Postconditions:** a `recipe` row and its `recipe_ingredient` rows exist, each with a precomputed `normalized_name`.

### Use case: Enter a recipe manually

- **Actor:** Member or Owner
- **Preconditions:** none
- **Main flow:**
  1. The user chooses manual entry (fallback when parsing fails or no URL exists).
  2. The user enters title, instructions, servings, and ingredients with quantity and unit.
  3. The user saves the recipe.
- **Postconditions:** same as URL import — a `recipe` and its `recipe_ingredient` rows exist.

### Use case: View a recipe's readiness and missing ingredients

- **Actor:** Member or Owner
- **Preconditions:** the recipe has at least one ingredient; the household has favorite merchants and (optionally) pantry items
- **Main flow:**
  1. The user opens a recipe or the deal-matched suggestions screen.
  2. Every ingredient is bucketed: **In pantry** (matches a pantry item), **On sale** (matches a current deal from a favorite merchant whose `valid_to` has not passed, and no pantry match), or **To buy** (no match either way). An ingredient matching both pantry and a deal counts once, in the pantry bucket.
  3. Readiness is computed as `(on_sale + in_pantry) / total_ingredients`, displayed as a whole-number percentage rounded half-up. A recipe with no ingredients scores 0%.
  4. On-sale and in-pantry ingredients are weighted equally — a recipe with 4 of 5 ingredients ready outranks one with 3 of 5 regardless of which buckets the 4 came from.
  5. The suggestion card shows the breakdown, e.g. "4 of 5 ready — 2 on sale, 2 in pantry, 1 to buy"; opening the recipe shows which specific ingredient landed in which bucket.
  6. Suggestions are ranked by readiness, highest first.
- **Alternate/exception flows:**
  - **Wrong or missed match:** the user corrects it from the recipe's breakdown by creating a match override (see below).
  - **Readiness recompute trigger:** readiness is precomputed server-side and stored in `recipe_readiness`, recomputed for the affected household after every deal refresh and whenever a pantry item, recipe, or match override changes — never computed ad hoc in SQL at read time.
- **Postconditions:** `recipe_readiness` holds the current bucket counts, percentage, and per-ingredient breakdown.

### Use case: Correct a match with an override

- **Actor:** Member or Owner
- **Preconditions:** a fuzzy match is wrong or missing, visible in a recipe's breakdown
- **Main flow:**
  1. The user corrects the match from the recipe's breakdown.
  2. The client sends the ingredient's and target's plain names to `POST /households/:id/match-overrides` (not pre-normalized strings) along with the target kind (deal or pantry) and a decision (force match or force no-match).
  3. The service normalizes both names itself through `@hestia/matching`.
  4. A force match puts the ingredient in the target's bucket whenever a target with that normalized name exists; a force no-match prevents that pair from matching.
  5. The override applies to every recipe in the household and stays in effect until a member removes it.
- **Alternate/exception flows:**
  - **An override already exists for the same (household, ingredient, target kind, target):** the request updates its decision in place — the same idempotent-POST pattern as favorite-stores and the pantry — rather than failing with a conflict.
- **Postconditions:** an `ingredient_match_override` row exists; affected recipes' readiness is recomputed.

### Use case: Add missing ingredients to a list

- **Actor:** Member or Owner
- **Preconditions:** a recipe, a planned meal, or a whole planned week is in view, with a target list chosen
- **Main flow:**
  1. The user triggers "Add missing to list" from a recipe, a planned meal, or a whole planned week.
  2. An ingredient counts as missing unless it matches a pantry item, or matches (by `normalized_name`) an item already on the target list with status needed or in cart.
  3. A missing ingredient in the On sale bucket is added linked to the deal: it takes the deal's snapshot (store, sale price, price unit, validity, conditional flag), with `source = from_recipe`. When several favorite-merchant deals match, the lowest-unit-price one is used — the same one the readiness breakdown would show.
  4. The added item keeps the ingredient's own name, never the deal's product name (e.g. stays "ground beef" even though price/store/validity come from the matched deal).
  5. Other missing ingredients are added with no store or price.
  6. Ingredients from several recipes are aggregated per the Ingredient aggregation rule (below) before being written to the list.
- **Alternate/exception flows:**
  - **Ingredient aggregation:** the merge key is `normalized_name`. Matching units sum (1 cup + 2 cups milk → one 3-cup item). Mismatched units merge into one item keeping both quantities in `quantity_note` (2 cups + 1 lb onions → one "onions" item reading "2 cups + 1 lb"); no unit conversion is ever attempted. A missing unit is treated as a unit of its own, so "2 onions" and "1 lb onions" merge the mismatched way. The item records every contributing recipe in `contributing_recipe_ids`. Aggregation happens once, at add time; editing a recipe afterward does not change an existing list.
  - **Planned meal whose recipe has been deleted:** the action answers `404` rather than silently adding nothing — consistent with the week planner never offering the action on a deleted-recipe entry.
  - **Two calls for one list overlap** (a retry that arrives while the first request is still running, or two members adding together): the service handles them one after the other per list, so the second reads the first one's rows and does not add the same ingredient again.
- **Postconditions:** the target list contains exactly the ingredients that were neither on hand nor already listed, correctly priced and aggregated.

### Use case: Plan the week

- **Actor:** Member or Owner
- **Preconditions:** at least one saved recipe exists (for placing a recipe) — the planner itself has no precondition to view
- **Main flow:**
  1. The user opens the Week planner: a seven-day grid, Sunday through Saturday.
  2. The user places a recipe onto a day and meal slot (breakfast, lunch, dinner); a slot may hold more than one entry.
  3. The entry snapshots the recipe's title into `meal_plan_entry.recipe_title` at placement time.
- **Alternate/exception flows:**
  - **Recipe deleted after being planned:** the entry remains, `recipe_id` is set to null (`ON DELETE SET NULL`), and the entry shows the snapshotted `recipe_title`. Recipes are hard-deleted; there is no soft delete.
  - **Past plan entries:** kept indefinitely, excluded from the active week view but viewable as history.
- **Postconditions:** a `meal_plan_entry` exists for the day/slot; it survives recipe deletion by snapshot.

---

## Bills and subscriptions

### Use case: Add a bill

- **Actor:** Member or Owner
- **Preconditions:** none
- **Main flow:**
  1. The user enters a name, amount, category, recurrence (unit, interval, anchor date — or none, for a one-time bill), autopay flag, reminder lead time (`reminder_days_before`, default 3), and visibility (household or personal).
  2. A household bill's owner must be a member of the household when the owner is set.
  3. The bill is saved; its current occurrence and next due date are never stored — both are derived on every read from the anchor, interval, and recorded payments.
- **Alternate/exception flows:**
  - **Personal visibility:** `household_id` is null exactly when `visibility = 'personal'` (enforced by a check constraint). A personal bill belongs to `owner_user_id`, sits outside any household, and is visible only to its owner — appearing, marked "Personal", in every household context that owner opens (Bills tab and dashboard). No other member ever sees it.
  - **Changing visibility:** only the bill's owner can change it, moving the bill between the household and the owner alone; a household bill never moves to another household.
- **Postconditions:** a `bill` row exists with its recurrence fields set (or null `recurrence_unit` for a single occurrence on `anchor_date`).

### Use case: Recurring bills and their anchor date

- **Actor:** Member or Owner (viewing); System (deriving on read)
- **Preconditions:** a bill with `recurrence_unit` set exists
- **Main flow:**
  1. Occurrence dates are `anchor_date` plus k × `interval` units, for k = 0, 1, 2, …. No occurrence exists before `anchor_date`.
  2. The bill's current occurrence is its earliest occurrence with no `bill_payment_log` row (neither paid nor skipped).
  3. That occurrence is overdue once its date is before today (in the household timezone), and stays current and overdue until paid or skipped.
  4. The Bills tab and dashboard sort bills by soonest due date and flag any overdue occurrence.
- **Alternate/exception flows:**
  - **Month-end / year-end clamping:** monthly and yearly anchors past the 28th clamp to the last day of shorter months. An anchor on the 31st gives Feb 28 (Feb 29 in a leap year), then the 31st again in March — each occurrence is computed from the original anchor, never from the previous clamped date.
  - **Yearly anchor on Feb 29:** gives Feb 28 in non-leap years.
  - **Late payment:** recording a payment or a skip writes the log row for the current occurrence; a bill paid late advances to the next anchor-derived occurrence, not completion-plus-interval. A payment may be recorded before the due date too.
  - **Unpaid occurrence:** never rolls forward by itself; it stays overdue until paid or explicitly skipped (a skip records that it will not be paid, e.g. a waived month).
- **Postconditions:** `bill_payment_log` has exactly one row per (bill, occurrence) that has been paid or skipped; the next due date is always recomputable, never stored.

### Use case: Autopay bills log their own payments

- **Actor:** System (the `log-autopay` job)
- **Preconditions:** a bill has `autopay = true`
- **Main flow:**
  1. Once an occurrence's due date begins in the bill's timezone, the job writes an automatic payment for the bill's amount to `bill_payment_log`, flagged `is_auto = true`, with `recorded_by` null.
  2. This applies only to occurrences dated on or after the bill's `created_at` date (in the bill's timezone).
  3. Reminders for autopay bills still fire, labelled "autopay".
- **Alternate/exception flows:**
  - **Occurrence dated before the bill's `created_at`:** follows the normal unpaid rule — stays overdue until someone pays or skips it; autopay never logs it.
  - **Job rerun:** logs a payment on the due date exactly once — the unique (`bill_id`, `occurrence_date`) key on `bill_payment_log` prevents a double-log.
  - **Editing or removing an automatic payment:** any member who can see the bill may do so, since there is no "automatic" lock on the log row once written.
- **Postconditions:** the occurrence has a `bill_payment_log` row with `is_auto = true`; it is no longer current/overdue.

### Use case: Archive a bill

- **Actor:** Member or Owner
- **Preconditions:** the bill exists
- **Main flow:**
  1. The user archives a bill that is no longer needed.
  2. Archiving hides it from every view and stops its reminders; payment history is kept, not deleted.
- **Postconditions:** `bill.archived_at` is set; no further `bill_due` notifications are produced for it.

### Use case: Track subscriptions

- **Actor:** Member or Owner
- **Preconditions:** at least one bill is flagged `is_subscription`
- **Main flow:**
  1. The user opens the Subscriptions view, which shows the active household's subscriptions plus the viewing user's own personal subscriptions, sorted by monthly cost.
  2. Each bill's monthly amount is derived from its recurrence unit and interval: Week → `amount × 52 ÷ 12 ÷ interval`; Month → `amount ÷ interval`; Year → `amount ÷ 12 ÷ interval`; Day → `amount × 365 ÷ 12 ÷ interval`.
  3. The view's total is the sum of monthly amounts, rounded half-up to cents. Each row's annualized figure is its monthly amount × 12.
- **Alternate/exception flows:**
  - **"Still using this?" prompt:** shown when usage has not been confirmed for 60 days, clocked from `last_used_confirmed_at`, or from `created_at` if usage has never been confirmed.
    - **"Still using":** sets `last_used_confirmed_at` to now, resetting the clock.
    - **"Stop tracking":** archives the bill.
  - Usage is self-reported only; Hearth has no way to detect actual usage.
- **Postconditions:** the subscriptions total and per-row figures reflect current recurrence data; `last_used_confirmed_at` is updated if the user confirmed usage.

### Use case: Receive and act on a bill reminder

- **Actor:** System (sends); Member or Owner (the bill's owner, or an opted-in member)
- **Preconditions:** a bill has an unpaid, upcoming or overdue occurrence
- **Main flow:**
  1. By default, the bill's owner gets `bill_due` reminders.
  2. Any other member can opt in via the single per-user setting "Remind me about all household bills" (`profile.household_bill_reminders`), which then applies to every household bill in every household they belong to — there is no per-bill opt-in.
  3. A reminder fires `reminder_days_before` days before the due date, and again on the due date if still unpaid.
- **Alternate/exception flows:**
  - **`reminder_days_before = 0`:** only the due-date reminder is sent.
  - **Archived bill:** sends nothing.
- **Postconditions:** see Notifications section for delivery mechanics.

---

## Chores and errands

### Use case: Create a recurring chore

- **Actor:** Member or Owner
- **Preconditions:** none
- **Main flow:**
  1. The user names the chore and sets its recurrence (unit, interval, anchor date). A custom interval like "every 3 days" uses unit `day`; its anchor defaults to the chore's creation date.
  2. The user optionally sets up rotation: an ordered list of household members that advances on each completion. A `rotation_order` lists each member at most once — create and edit both refuse a repeated member.
  3. Alternatively, without rotation, the chore may be assigned to one member (`assigned_to`) or left unassigned.
- **Alternate/exception flows:**
  - **Editing assignment from the Chore sheet:** replaces `rotation_order` wholesale — the sheet redefines the order rather than reordering it in place. The turn is preserved by member identity when the current holder remains in the new order (`rotation_offset` recomputed from their new index), and reset to 0 when they do not.
- **Postconditions:** a `chore` row exists with its recurrence fields and, if applicable, a rotation order and offset of 0.

### Use case: Complete a chore

- **Actor:** Member or Owner
- **Preconditions:** the chore has a current occurrence (open or already completed)
- **Main flow:**
  1. The member marks the chore done.
  2. A `chore_completion` row is recorded: who did it, when ("when" is the moment the member acted, even if sent later from an offline queue — never a future time), and which occurrence it closes.
  3. If the current occurrence is open, the completion closes it. For a rotating chore, the turn advances one position from the scheduled member — whoever actually did it: if Sam does Alex's turn, the next turn is still the member after Alex. The formula is `rotation_order[(rotation_offset + completion_count) mod n]`.
  4. A `chore_rotation` notification is queued for the new assignee of a rotating chore.
- **Alternate/exception flows:**
  - **Current occurrence already completed, or not yet arrived:** the completion is early, and closes the earliest later occurrence that has no completion.
  - **Completion recorded after the due date:** still closes its occurrence; it never moves the series.
  - **Missed occurrence:** when the next occurrence's date arrives, an uncompleted earlier occurrence stops being due — missed occurrences do not stack up and are never backfilled. A missed occurrence does not pass the rotation turn; only completions do.
  - **Last-completed display:** the chore list shows the calendar day the completion was made (household timezone), not the occurrence it closed — a chore completed early for next week still reads as done today.
- **Postconditions:** `chore_completion` has a new row, unique per (`chore_id`, `occurrence_date`); the rotation (if any) and next due date are derivable from it with no separate "next due" storage.

### Use case: Undo a chore completion

- **Actor:** Member or Owner
- **Preconditions:** a completion was just recorded (toast still visible) or exists as the chore's most recent completion in its history
- **Main flow:**
  1. Immediately after completing, the completion toast offers Undo for 5 seconds.
  2. Alternatively, from the chore's history, the user can delete its most recent completion — only the most recent completion can be deleted.
  3. Deleting the completion reopens its occurrence and moves the rotation back one turn, since both are derived from the remaining completions.
  4. Any unsent `chore_rotation` notification for that occurrence is deleted; a push already sent stays sent.
- **Alternate/exception flows:**
  - **Completion still queued offline (not yet sent):** undo removes it directly from the queue.
  - **Completion already sent to the server:** undo is online-only.
- **Postconditions:** the occurrence returns to open; `rotation_offset`/turn state reflects one fewer completion; any unsent rotation notification for that occurrence is gone.

### Use case: Complete a chore offline

- **Actor:** Member or Owner
- **Preconditions:** the device is offline; the household's cached data (needed to date the occurrence in the household timezone) is available
- **Main flow:**
  1. The member marks the chore done while offline.
  2. The occurrence is worked out on the device from the household's "today" and the completions the device holds. If the chore's detail has never been opened, the device holds only the chore's most recent completion and places the occurrence from that; once detail has been opened, the full history is held.
  3. The write queues with the moment it was made, and a visible offline indicator confirms it.
  4. On reconnect, it replays; the completion is unique per (`chore_id`, `occurrence_date`), so a duplicate replay changes nothing.
- **Alternate/exception flows:**
  - **Completion placed from less history than the server holds:** refused when sent, reported as a change that could not be saved, with no household content disclosed in the error.
  - **Household's details not yet known on this device (no cache, no network):** the chore/errand screens show their loading or offline state rather than dated rows — a day is never read from the device's own timezone.
  - **No cached household data at all:** chore completion and errand-done are disabled offline, with "Needs a connection," since the occurrence can't be dated without it.
- **Postconditions:** on successful sync, identical to the online Complete a chore use case; on refusal, no completion is recorded and the user is told the save failed.

### Use case: Add and complete an errand

- **Actor:** Member or Owner
- **Preconditions:** none
- **Main flow:**
  1. Any member adds an errand: a name, an optional due date, and status open. Assignment to a specific member is optional.
  2. A member marks it done, which records `completed_at` and `completed_by` together (a check constraint requires both fields to move together in either direction).
  3. A done errand can be reopened, which clears both fields — the same mechanism a bought list item uses to move back to needed.
- **Alternate/exception flows:**
  - **Marking an already-done errand done again:** changes nothing, so a replayed "done" write is harmless.
  - **Marking done while offline:** queues, with the moment it was made.
  - **Reopening:** online-only — not supported from the offline queue.
- **Postconditions:** `errand.status`, `completed_at`, and `completed_by` reflect the latest action; reopening clears the completion fields.

---

## Notifications

### Use case: Receive a notification (general delivery)

- **Actor:** System (outbox + dispatch job); Member or Owner (recipient)
- **Preconditions:** a notification-worthy event has occurred and the recipient has that type enabled (or it defaults on)
- **Main flow:**
  1. A producer enqueues a row in the single outbox table `notification`, unique on (`user_id`, `type`, `target_id`, `occurrence_key`) — this key makes double-sending impossible.
  2. The dispatch job runs every 2 minutes. Just before sending, it re-checks the trigger condition still holds (see Conditions at send, below); if not, the row is deleted unsent and nothing is pushed.
  3. The notification is delivered via Web Push (VAPID-authenticated) to every device the recipient has registered. Delivery counts as successful once at least one device accepts it.
  4. The title and body are each capped at 60 characters, enforced by the shared notification schema and every producer; a notification that would exceed this is never created — it is dropped, and only its type and id are logged.
- **Alternate/exception flows:**
  - **No device accepts the push:** retried every 2 minutes until 24 hours after the send time, then dropped silently — the only record is a log line naming its type and id.
  - **A device the push service reports as gone:** removed from the recipient's account. A device whose push fails for any other reason stays registered.
  - **Recipient left the household the notification is about, before it was sent:** enqueueing checks current membership before writing, so nothing is written for someone no longer a member; if already written, the departure flow deletes unsent rows for that household.
  - **Quiet hours in effect (see below).**
  - **Tests/E2E:** never contact a real push service — a test double stands in, so no CI run sends a live push.
- **Postconditions:** the notification is sent and `sent_at` is set, or it is dropped/deleted per the exception flows, with the outbox key preventing any duplicate send.

### Use case: Notification types and their defaults

- **Actor:** System
- **Preconditions:** none
- **Main flow (reference table):**

| Type | Default | Recipients | Send time | `target_id` | `occurrence_key` |
| --- | --- | --- | --- | --- | --- |
| `bill_due` | On | Bill's owner, plus members with "Remind me about all household bills" on (household bills only) | 09:00, household timezone | bill id | occurrence date + `/advance` or `/due` |
| `chore_due` | On | Chore's assignee/current rotation member; for errands with a due date, their assignee | 09:00, household timezone | chore or errand id | occurrence or due date |
| `chore_rotation` | On | New assignee of a rotating chore | On completion | chore id | occurrence date that was completed |
| `list_activity` | On | Other members of the household | Debounced (batching rule) | list id | start timestamp of the batch window |
| `meal_reminder` | Off | Opted-in members | 08:00, household timezone, on the meal's date | household id | date |
| `weekly_meal_nudge` | Off | Members opted in for that household | Saturday 09:00, household timezone | household id | date of the coming Sunday |
| `flyer_refresh` | Off | Opted-in members | Next 09:00, household timezone, after the refresh; at most once per day per household | household id | date |

- **Alternate/exception flows:**
  - **Unassigned chore with no rotation, or unassigned errand:** sends no push at all.
  - **Overdue chores:** nothing is sent for the overdue state itself (only the original due-date trigger).
  - **`bill_due` trigger:** `reminder_days_before` days before an unpaid occurrence, and again on its due date if still unpaid; archived bills send nothing; `reminder_days_before = 0` sends only the due-date reminder.
  - **`flyer_refresh` trigger:** fires when a refresh found a new flyer for a favorite merchant (a `flyer_id` with no prior `deal` row); nothing is sent when the postal code had no previous refresh at all (first-ever or first-after-dormancy).
- **Postconditions:** notifications match this table exactly; a missing `notification_preference` row means the type's default applies.

### Use case: Quiet hours

- **Actor:** Member or Owner (sets the window); System (applies it)
- **Preconditions:** the user has set `profile.quiet_hours_start` and `quiet_hours_end` (both set or both null)
- **Main flow:**
  1. The window is evaluated in the user's own stored timezone, refreshed from the browser every app open, and may cross midnight.
  2. A notification whose `send_after` falls inside the window has `send_after` moved to the end of the window — delivered when the window opens, never dropped.
  3. Batching and the outbox key still apply during this shift, so a night's list activity arrives as one morning notification per list.
  4. Every addition to a batch re-applies the window, so the batch's send time always reflects its latest addition, and a batch is never split across two windows.
  5. There is no urgent-override tier — nothing Hearth sends warrants waking someone.
- **Alternate/exception flows:**
  - **Quiet hours changed after a notification was already written:** the change applies only to notifications written after the change; already-written rows keep their original send time.
- **Postconditions:** no notification is delivered inside the recipient's quiet-hours window; it is deferred to the window's end instead.

### Use case: List-activity batching

- **Actor:** System
- **Preconditions:** a member adds one or more items to a list another member can see
- **Main flow:**
  1. The first addition opens a batch row whose `occurrence_key` is the batch's start timestamp.
  2. Each further addition before the row is sent updates the count and sets `send_after = least(last_add + 5 minutes, first_add + 15 minutes)`.
  3. The batch is sent as one push per recipient per list stating a count, e.g. "5 items added to Grocery List" ("1 item added to Grocery List" for a single item) — never one push per item.
- **Alternate/exception flows:**
  - **Addition after the batch row has already been sent:** opens a new batch.
- **Postconditions:** at most one `list_activity` notification is outstanding per (recipient, list) at a time; the count reflects everything added since the batch opened.

### Use case: Push delivery and device registration

- **Actor:** Member or Owner (device); System (push transport)
- **Preconditions:** a notification type is being turned on for the first time on a device
- **Main flow:**
  1. A device registers for push only when a notification type is turned on there — the browser's permission prompt appears at that moment, never on load.
  2. On Android, web push works from a browser tab. On iOS, Safari requires the PWA be installed to the home screen first — installation is a prerequisite for notifications there and should be prompted during onboarding.
  3. Signing out removes the device's push subscription.
- **Alternate/exception flows:**
  - **Permission denied:** the device is told where to change it in system settings and is never prompted again automatically.
  - **Prompt dismissed (not denied):** the device is asked again the next time a type is turned on.
  - **Browser without push support, or iPhone/iPad not yet on the home screen:** told so in place of the per-type toggles.
- **Postconditions:** a `push_subscription` row exists per registered device, unique on (`user_id`, `endpoint`); re-posting the same endpoint updates its keys rather than duplicating the row.

### Use case: Tap a notification (deep link)

- **Actor:** Member or Owner
- **Preconditions:** a push notification has been delivered to the user's device
- **Main flow:**
  1. The user taps the notification.
  2. The app opens the screen the notification refers to, in its household, and switches the active household to it.
- **Alternate/exception flows:**
  - **Recipient can no longer see that household** (they have since left it): the dashboard opens instead of the (now inaccessible) target screen.
- **Postconditions:** the app is on the target screen (or dashboard) with the correct household active.

### Use case: Manage notification preferences

- **Actor:** Member or Owner
- **Preconditions:** the user is signed in
- **Main flow:**
  1. `GET /api/users/me/notification-preferences` returns every type with its effective value (defaults applied to any missing row), listing `weekly_meal_nudge` once for each household the caller belongs to.
  2. The user toggles a type on or off (and, for `weekly_meal_nudge`, per household) via `PATCH`, which takes the type, `enabled`, and, for `weekly_meal_nudge` only, `householdId`.
  3. The toggle is per-user and per-type, not a single global switch — a member may want bill reminders without chore nudges.
- **Alternate/exception flows:**
  - **Repeated `PATCH` of the same preference:** idempotent — no duplicate row.
  - **`householdId` the caller does not belong to:** answers `404`.
- **Postconditions:** `notification_preference` reflects the new effective value for that (user, type[, household]).

