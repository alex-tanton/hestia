# Hearth — Seed Data

2026-09-17 · @Someone

Realistic fixtures for development, mockups, and tests. Use this instead of inventing placeholder content, so mockups show what the app will actually look like in use.

## Using this data

Seeding runs in two steps:

1. `supabase/seed/seed-users.ts` creates the users through the GoTrue admin API, passing each user's display name and timezone as `user_metadata`, which fires the `profile` trigger.
2. `supabase/seed/seed.sql` inserts everything else. `seed-users.ts` applies it with `psql` once the users exist; `pnpm db:seed` runs both. The SQL runs once per database, so a second seeding starts from `supabase db reset`. Both steps refuse a database that has any user besides the five below, which keeps the seed users and their published password off any stack real people use.

Every seed user has the development-only password `hearth-seed-pass-2026`.

There are two kinds of deal fixtures, both under `e2e/fixtures/flipp/`:

| Kind | Path | Contents | Used by |
| --- | --- | --- | --- |
| Raw | `raw/` | Flipp responses exactly as returned, for all four modes (search, flyers, flyer items, merchants), first captured for postal code 27514 by the Phase 0 spike | Parser and wrapper unit tests |
| Normalized | `normalized/` | `NormalizedDeal` JSON, the output the wrapper must produce from the raw fixtures | Seed SQL, service tests, E2E |

The raw fixtures are real captures, so their exact item names may differ from the tables below. When they do, the normalized fixtures and the tables below are updated together to match the capture.

### Three uses

| Use | What it provides |
| --- | --- |
| Development | A populated app on first run, without waiting on a live Flipp fetch |
| Mockups | Real names, real prices, real messy strings — mockups show the actual product |
| Tests | Deterministic fixtures for unit and E2E tests |

### Principles

- **Plausible, not tidy.** Real deal names are inconsistent marketing copy with abbreviations and package descriptors. Data that is too clean hides the problems the parsers exist to solve.
- **Includes the hard cases.** Multi-buy pricing, BOGO, conditional prices, rebates, per-weight prices, and unparseable strings all appear, because every screen state and parser path needs something to exercise it.
- **Covers every state.** Enough data to show a populated app, and specific fixtures for empty, expired, and error cases.
- **No real people.** Names and emails are fictional and use `@example.com`, which is reserved for this purpose.

### Scale

Enough to feel real without being unwieldy:

- 3 households, 5 users, 6 stores
- 36 deal fixtures: 26 current deals, 3 expired, and 7 that must be skipped
- 14 recipes (12 for Oak Street, 2 for Rivera Family), 20 pantry items, 4 shopping lists
- 9 bills, 6 chores, 6 errands, and 3 `app_error` rows

### Dates

Seed dates are relative to the seed run, not hardcoded, so the data never goes stale. "Today" means the seed-run date in the household's timezone. Deal validity spans the current week, bills sit across overdue, this-week, and later, and chores cover the same spread. Three deals are deliberately expired to exercise all three repricing outcomes.

## Households, users, and stores

### Users

| Name | Email | Timezone |
| --- | --- | --- |
| Alex Rivera | `alex@example.com` | `America/New_York` |
| Sam Chen | `sam@example.com` | `America/New_York` |
| Jordan Blake | `jordan@example.com` | `America/New_York` |
| Morgan Reed | `morgan@example.com` | `America/Chicago` |
| Casey Nguyen | `casey@example.com` | `America/Los_Angeles` |

`HEARTH_OWNER_EMAIL` in the development `.env` is `alex@example.com`, so Alex sees System health and nobody else does.

### Households

| Household | Postal code | Timezone | Members |
| --- | --- | --- | --- |
| Oak Street | 27514 (Chapel Hill, NC) | `America/New_York` | Alex (admin), Sam, Jordan |
| Rivera Family | 27601 (Raleigh, NC) | `America/New_York` | Alex (admin), Morgan |
| Empty House | 27705 (Durham, NC) | `America/Los_Angeles` | Casey (admin) |

Alex belongs to two households, which exercises multi-household switching, isolation, and the requirement that no view spans households. Alex's `active_household_id` is Oak Street. Morgan's timezone differs from the Rivera Family household timezone. That exercises the split between the two: household dates follow the household, while quiet hours and personal send times follow the user. Casey's Empty House has no data at all, for first-run and empty-state screens. Casey is also a **former member of Oak Street**, having left 5 weeks ago, so Oak Street's history has records by a departed member, which render as "Former member".

Notification settings:

- Jordan has "Remind me about all household bills" on; nobody else does.
- Sam has quiet hours of 22:00–07:00.
- Alex has opted into `weekly_meal_nudge` for Oak Street only.

### Stores

The six that match the target area:

| Merchant | Type |
| --- | --- |
| Harris Teeter | Grocery |
| Food Lion | Grocery |
| Publix | Grocery |
| Lowes Foods | Grocery |
| Walmart | Supercenter |
| CVS Pharmacy | Convenience |

Oak Street favorites: Harris Teeter, Food Lion, CVS. Rivera Family favorites: Publix, Walmart. Empty House favorites: Harris Teeter, Food Lion.

Empty House (27705) is also the dormant-postal-code fixture. Its `last_active_at` is 20 days ago, there is no `postal_code_refresh` row for 27705, and there are no `deal` rows for it. Opening its flyers shows the "no cache, refreshing" state and queues one on-demand refresh. That first refresh enqueues no `flyer_refresh`.

The remaining stores stay unfavorited so browse-all has something to show beyond the favorites, and so the favorites filter is visibly doing work.

### Edge-case fixtures

- A postal code (`99999`) that returns no merchants, for that error state
- An outstanding invite to Oak Street, created 2 days ago, with code `K7M2Q9XA`; the development token is printed by the seed script
- An expired Oak Street invite, created 9 days ago, with code `EXP9RD2Z`
- A revoked Oak Street invite, created 4 days ago and revoked 3 days ago, with code `RVK4D3NM`, for the revoked-invite state

### E2E-only fixtures

Two things the E2E suite needs that `pnpm db:seed` does not create.

**Accounts journey 1 creates.** Signing up is the journey, so the account cannot already exist, and it runs once per theme. The two are Riley Park (`riley@example.com`, household "Maple Court") and Drew Alvarez (`drew@example.com`, household "Birch Lane"), both in 27514 and both with the seed password.

**Departure rows**, applied by `e2e/fixtures/e2e-seed.sql` after the seed. The departure preview asks for a new owner for the lists a member created, the chores and open errands assigned to them, and the unarchived household bills they own, so journey 8 and the last-member departure need at least one of each to exist before the pillars that own them ship. Each row is one of this document's own fixtures, and moves into `supabase/seed/seed.sql` when its pillar's phase seeds the rest:

| Row | Owner | Why |
| --- | --- | --- |
| Oak Street list "This Week" | created by Sam | Journey 8 reassigns it |
| Oak Street list "Weekend Cookout" | created by Jordan | Journey 8's second removal |
| Oak Street errand "Renew car registration" | Sam, open, due in 3 weeks | The open-errand group of the preview |
| Oak Street bill "Duke Energy" | Sam, household | The household-bill group |
| Oak Street bill "Water and Sewer" | Jordan, household | The household-bill group |
| Oak Street chore "Take out trash" | rotation Alex → Sam → Jordan | The rotation note, which has no picker |
| Personal bill "Car Insurance", $128.00, monthly | Casey | Survives Empty House's deletion |

Casey's Car Insurance is the personal bill the last-member departure leaves behind. Personal bills belong to the user rather than the household, so it must still be there, still personal, and still Casey's once Empty House is gone.

## Deal fixtures

The most important fixtures in the set. Every parser path and every deal-related UI state needs a representative here. Prices are shown as they normalize: unit price with its `price_unit`, original price, and `discount_percent` (floored). Normalized names assume the matcher's descriptor list includes at least "boneless", "skinless", "family pack", "large", "grade a", "shredded", "fresh", "crowns", "crumbles", "frozen", "sweet", "red or green", and "bag", and its brand list includes at least "Kraft", "Barilla", "Dave's Killer", "Progresso", "Tropicana", "Publix", "Tide", "Coca-Cola", and "Lowes Foods".

The raw captures for 27514 are in `e2e/fixtures/flipp/raw/`: `search-27514-{milk,chicken,harris-teeter,food-lion,publix,lowes-foods,aldi,cvs}.json`, `flyers-27514.json`, `data-27514.json` (the `flyers-ng.flippback.com` flyers-and-coupons variant), `merchants-27514.json`, `flyer-items-{harris-teeter-8132883,food-lion-8128502,publix-8128353,lowes-foods-8132169,aldi-8131738,cvs-8139694}.json`, `flyer-items-ng-harris-teeter-8132883.json` (the `flyers-ng` equivalent), and `item-{harris-teeter-1040206756,food-lion-1039547929,publix-1039945367,lowes-foods-1039938734,cvs-1041117892}.json` (item detail). Item ids change weekly, but merchant ids are stable, so fixtures and tests may rely on them: Harris Teeter 2431, Food Lion 2100, Publix 2361, Lowes Foods 2469, ALDI 2353, CVS Pharmacy 2264, and Walmart 2175 (the directory's other "Walmart", 234, is Walmart Canada).

### Clean prices

The straightforward path.

| Raw name | Merchant | Unit price | Original | Discount | Normalized name |
| --- | --- | --- | --- | --- | --- |
| Boneless Skinless Chicken Breast, Family Pack | Harris Teeter | $2.49/lb | $4.99/lb | 50% | chicken breast |
| Large Grade A Eggs, 12 ct | Food Lion | $2.79 | $3.99 | 30% | egg |
| Barilla Pasta, 16 oz | Publix | $1.29 | $1.99 | 35% | pasta |
| Yellow Onions, 3 lb bag | Lowes Foods | $2.49 | $3.49 | 28% | yellow onion |
| Lowes Foods Whole Milk, 1 gal | Lowes Foods | $3.49 | $3.99 | 12% | whole milk |
| Roma Tomatoes | Walmart | $1.28/lb | — | — | roma tomato |

### Multi-buy

Parsed by division, with the unit price rounded half-up; `displayPrice` keeps the original copy.

| Raw copy | Merchant | Parses to | Normalized name |
| --- | --- | --- | --- |
| 2 for $5 — Kraft Shredded Cheese, 8 oz | Harris Teeter | $2.50 each | cheese |
| 3/$10 — Ground Beef 80/20, 1 lb | Food Lion | $3.33 each | ground beef |
| 5 for $5 — Progresso Soup | Publix | $1.00 each | soup |
| 2/$7.00 Tropicana Orange Juice 52 oz | Walmart | $3.50 each | orange juice |

### BOGO

Every BOGO fixture has a base price, so each parses to half of it (rounded half-up) at 50% off. The BOGO-with-no-base-price skip case is covered by the parser's unit tests over the raw fixtures.

| Raw copy | Merchant | Base price | Parses to |
| --- | --- | --- | --- |
| BOGO Free — Publix Deli Subs, reg $8.99 | Publix | $8.99 | $4.50 each |
| Buy 1 Get 1 Free Barilla Sauce 24oz, reg $3.49 | Publix | $3.49 | $1.75 each |
| B1G1 — Cheerios, 12 oz, reg $4.99 | Harris Teeter | $4.99 | $2.50 each |

### Conditional price

Parsed, with `conditionalPrice: true` and a `conditionalReason`, so the UI badges them.

| Raw copy | Merchant | Unit price | `conditionalReason` |
| --- | --- | --- | --- |
| $3.99 with digital coupon — Tide Pods 42ct | Harris Teeter | $3.99 | `coupon` |
| $1.99 ea. w/ MVP Card — Coca-Cola 2L | Food Lion | $1.99 | `loyalty_card` |

Coca-Cola 2L exercises the empty-normalization fallback. Removing the brand "Coca-Cola" and the size "2L" leaves nothing, so its normalized name is "coca cola 2l": the lowercased original with only punctuation stripped. Tide Pods 42ct normalizes to "pod".

### Amount-off

| Raw copy | Merchant | Parses to |
| --- | --- | --- |
| $1.00 off — Dave's Killer Bread, reg $5.49 | Harris Teeter | $4.49, 18% off, normalized "bread" |

### Favorite-store groceries

Everyday deals at Oak Street's favorite merchants. These are what the recipe readiness scores below are computed against.

| Raw name | Merchant | Unit price | Original | Discount | Normalized name |
| --- | --- | --- | --- | --- | --- |
| Fresh Broccoli Crowns | Harris Teeter | $1.49/lb | $2.49/lb | 40% | broccoli |
| Bell Peppers, Red or Green | Harris Teeter | $0.99 | $1.49 | 33% | bell pepper |
| Russet Potatoes, 5 lb bag | Harris Teeter | $2.99 | $4.49 | 33% | russet potato |
| Feta Cheese Crumbles, 6 oz | Harris Teeter | $2.50 | $3.99 | 37% | feta cheese |
| Egg Noodles, 12 oz | Harris Teeter | $1.50 | $2.29 | 34% | egg noodle |
| Carrots, 2 lb bag | Food Lion | $1.69 | $2.29 | 26% | carrot |
| Flour Tortillas, 10 ct | Food Lion | $2.00 | $2.79 | 28% | flour tortilla |
| Chuck Roast | Food Lion | $4.99/lb | $6.99/lb | 28% | chuck roast |
| Cucumbers | Food Lion | $0.50 | — | — | cucumber |
| Frozen Sweet Peas, 12 oz | Food Lion | $1.00 | $1.79 | 44% | pea |

### Expired

All three have `valid_to` of yesterday and are attached to items on the "This Week" list. Together they exercise the three repricing outcomes.

| Raw name | Merchant | Unit price | Original | Repricing outcome |
| --- | --- | --- | --- | --- |
| Boneless Skinless Chicken Breast, Family Pack (last week) | Harris Teeter | $1.99/lb | $4.99/lb | Re-matches the current Harris Teeter chicken breast deal by merchant plus normalized name: $2.49/lb, showing $1.99 struck through |
| Bananas | Food Lion | $0.44/lb | $0.59/lb | No current deal: falls back to the regular price, $0.59/lb |
| Gold Emblem Trail Mix, 10 oz | CVS Pharmacy | $2.99 | — | No current deal and no regular price: the price is cleared, and the item shows "No price" with $2.99 struck through |

### Must be skipped

These exist specifically to assert the skip path. None should appear in results, and each should increment the skip counter.

| Raw copy | Merchant | Why |
| --- | --- | --- |
| Look for great savings in store! | Lowes Foods | No price at all |
| Prices vary by location | Lowes Foods | Unparseable |
| Save $2 on Tillamook Cheese Block | Lowes Foods | Amount-off with no original price |
| See store for details — Weekly Produce | Food Lion | No price |
| Mix & Match 10/$10 with card, limit 2, select varieties | Harris Teeter | Ambiguous enough that a confident parse would be wrong |
| $5.00 with ExtraBucks Rewards — CVS Health Vitamins | CVS Pharmacy | Rebate, not a shelf price |
| FREE with $25 purchase — Publix Paper Towels | Publix | Rebate conditional on basket total, not a shelf price |

### State-specific fixtures

- **Lowes Foods has a 60% skip rate** in its flyer-items fixture: 5 items, 3 skipped (the three Lowes Foods rows above). That exercises the high-skip warning and System health's skip-rate display.
- **An empty result set** for the query `"saffron"`, for the filtered-empty state
- **A stale `deal_query_cache` row** for 27514 and the query `"chicken"`, with `cached_at` 7 hours ago (the TTL is 6 hours) and no live fetch available, for the as-of-date path

## Recipes, pantry, and lists

### Pantry

Twenty items for Oak Street: olive oil, salt, black pepper, garlic, rice, flour, sugar, butter, milk, bread, soy sauce, cumin, paprika, canned tomatoes, black beans, chicken broth, parmesan, eggs, yellow onions, pasta.

Three pantry items also match current deals at Oak Street's favorite merchants:

- eggs, against Food Lion's eggs
- bread, against Harris Teeter's Dave's Killer Bread
- flour, against Food Lion's flour tortillas, by token containment

Each exercises pantry-beats-sale: the ingredient counts once, in the pantry bucket. The seed tests assert it is not double-counted. Pasta and yellow onions are on sale only at non-favorite merchants (Publix and Lowes Foods), so they never count as on sale for Oak Street.

### Recipes

Twelve for Oak Street, chosen so readiness scores spread across the full range rather than clustering. Buckets use the matching rules in the Requirements document: token containment at 0.85, only current deals from favorite merchants (Harris Teeter, Food Lion, CVS), and pantry beats sale. Percentages round half-up.

Legend: **S** on sale, **P** in pantry, **B** to buy. A deal is named where it decides the bucket.

| Recipe | Ingredients and expected bucket | Readiness |
| --- | --- | --- |
| Sheet Pan Chicken and Vegetables | chicken breast S (HT), broccoli S (HT), bell pepper S (HT), olive oil P, garlic P, paprika P, lemon B | 6 of 7 — 86% (3 on sale, 3 pantry) |
| Spaghetti with Meat Sauce | pasta P, ground beef S (FL), canned tomatoes P, onion P, garlic P, tomato paste B, parmesan P, dried oregano B | 6 of 8 — 75% (1 on sale, 5 pantry) |
| Vegetable Fried Rice | rice P, eggs P (also on sale; pantry wins), frozen peas S (FL), carrots S (FL), soy sauce P, green onions B, sesame oil B, garlic P | 6 of 8 — 75% (2 on sale, 4 pantry) |
| Black Bean Tacos | black beans P, flour tortillas S (FL), cumin P, avocado B, lime B, salsa B, cheese S (HT), red onion B | 4 of 8 — 50% (2 on sale, 2 pantry) |
| Chicken Noodle Soup | chicken breast S (HT), egg noodles S (HT), carrots S (FL), celery B, onion P, garlic P, chicken broth P, thyme B, bay leaves B | 6 of 9 — 67% (3 on sale, 3 pantry) |
| Greek Salad | cucumber S (FL), roma tomatoes B (Walmart is not a favorite), red onion B, feta cheese S (HT), kalamata olives B, olive oil P, red wine vinegar B | 3 of 7 — 43% (2 on sale, 1 pantry) |
| Baked Ziti | pasta P, ground beef S (FL), canned tomatoes P, mozzarella B, ricotta B, parmesan P, garlic P | 5 of 7 — 71% (1 on sale, 4 pantry) |
| Breakfast Burritos | eggs P (also on sale; pantry wins), flour tortillas S (FL), cheese S (HT), potatoes S (HT russet potatoes), bell pepper S (HT), salsa B | 5 of 6 — 83% (4 on sale, 1 pantry) |
| Lentil Curry | lentils B, coconut milk B, onion P, garlic P, ginger B, curry powder B, cumin P, canned tomatoes P, basmati rice B, cilantro B | 4 of 10 — 40% (0 on sale, 4 pantry) |
| Grilled Cheese and Tomato Soup | bread P (also on sale; pantry wins), butter P, cheese S (HT), canned tomatoes P, milk P | 5 of 5 — 100% (1 on sale, 4 pantry) |
| Shrimp Pad Thai | rice noodles B, shrimp B, tamarind paste B, fish sauce B, bean sprouts B, peanuts B, lime B, green onions B | 0 of 8 — 0% |
| Sunday Pot Roast | chuck roast S (FL), russet potatoes S (HT), carrots S (FL), onion P, beef broth B, rosemary B, worcestershire sauce B, flour P (also matches flour tortillas; pantry wins) | 5 of 8 — 63% (3 on sale, 2 pantry) |

Rivera Family has two recipes, **Tuna Poke Bowl** (ahi tuna, sushi rice, soy sauce, avocado, cucumber, sesame seeds) and **Miso Soup** (miso paste, tofu, green onions, dashi, wakame). Rivera Family has no pantry, and nothing on sale at Publix or Walmart matches either recipe. Both score 0%, which exercises the suggestions screen's "all recipes at 0%" state: shown normally, ranked by title.

The suggestions screen's "no deals available" state has a test-only fixture, not part of `seed.sql`: an E2E setup that empties `deal` and `deal_query_cache` for 27601 and stubs the `DealSource` double to fail. Rivera Family's suggestions screen then has recipes but no deals and no cache.

Grilled Cheese at 100% and Shrimp Pad Thai at 0% bracket the range, so the suggestions screen has both extremes without contrived data. Nothing in Pad Thai matches: "rice noodles" needs both tokens, and neither pantry "rice" nor the "egg noodle" deal supplies both. "bean sprouts" fails against pantry "black beans" for the same reason.

The Recipe detail screen needs one override fixture: Oak Street has a force-no-match override for ingredient "cheese" against deal "feta cheese". It demonstrates the "Corrected" label, and it changes no score above, because "cheese" already matches Kraft Shredded Cheese.

### Recipe sources

- **Ten with a `source_url`** pointing at sites publishing schema.org JSON-LD, for the parse path. Each ingredient keeps its original line in `raw_text`.
- **Two entered manually** (Lentil Curry, Shrimp Pad Thai), with no source URL and null `raw_text`
- **One fixture of a page with no JSON-LD**, for the parse-failure fallback
- **One fixture with partial JSON-LD** — title and ingredients but no instructions — for the incomplete-parse path
- **One fixture with awkward ingredient lines** ("1 (14.5 oz) can diced tomatoes, drained", "salt and pepper to taste", "2-3 cloves garlic") for the parser split and the editable preview

### Meal plan

Oak Street's current week has seven entries, including two entries in Wednesday's dinner slot (Baked Ziti and Greek Salad). The previous week has five entries, one of which has a null `recipe_id` and `recipe_title` "Mushroom Stroganoff". It stands for a deleted recipe, for the snapshot-title display. The coming week is empty, which makes Alex's `weekly_meal_nudge` for Oak Street eligible on Saturday.

### Matching test cases

Deliberately included to exercise the matcher:

| Recipe ingredient | Candidate | Should match |
| --- | --- | --- |
| chicken breast | Boneless Skinless Chicken Breast, Family Pack | Yes |
| chicken breast | Chicken Broth, 32 oz | **No** — the named false-positive case |
| eggs | Large Grade A Eggs, 12 ct | Yes |
| eggs | Egg Noodles, 12 oz | Yes — containment; pantry still wins for Oak Street |
| pasta | Barilla Pasta, 16 oz | Yes |
| onion | Yellow Onions, 3 lb bag | Yes — singular against plural |
| tomatoes | Roma Tomatoes | Yes |
| tomato sauce | Roma Tomatoes | **No** — different product |
| cheese | Kraft Shredded Cheese, 8 oz | Yes |
| bell pepper | black pepper (pantry) | **No** — "bell" is not "black" |
| rice noodles | rice (pantry) | **No** — "noodles" unmatched |
| potatoes | Russet Potatoes, 5 lb bag | Yes |

### Shopping lists

**"This Week"** for Oak Street, 15 items:

| Item | Source | Store | Price | Qty | Status |
| --- | --- | --- | --- | --- | --- |
| Chicken breast | Deal (expired, repriced) | Harris Teeter | $2.49/lb, was $1.99 | 2 lb | Needed |
| Kraft Shredded Cheese | Deal | Harris Teeter | $2.50 | 2 | Bought |
| Tide Pods 42ct | Deal, coupon | Harris Teeter | $3.99 | 1 | Needed |
| Trash bags | Manual | Harris Teeter | — | 1 | Needed |
| Ground beef | Deal | Food Lion | $3.33 | 2 | In cart |
| Coca-Cola 2L | Deal, card | Food Lion | $1.99 | 3 | Needed |
| Bananas | Deal (expired, repriced to regular) | Food Lion | $0.59/lb, was $0.44 | — | Needed |
| Apples | Manual | Food Lion | — | 3 lb (note) | Needed |
| Paper towels | Manual | CVS Pharmacy | $5.99 (entered) | 1 | Needed |
| Gold Emblem Trail Mix | Deal (expired, price cleared) | CVS Pharmacy | No price, was $2.99 | 1 | Needed |
| Red onion | Recipes, matching units | Anywhere | — | 2 (Black Bean Tacos + Greek Salad) | Needed |
| Salsa | Recipes, mismatched units | Anywhere | — | "1 cup + 16 oz" (Black Bean Tacos + Breakfast Burritos) | Needed |
| Celery | Recipe | Anywhere | — | 1 | Needed |
| Lemon | Recipe | Anywhere | — | 1 | Bought |
| Dish soap | Manual | Anywhere | — | 1 | Bought |

Expected store headers, from needed and in-cart items only:

| Store | Subtotal | Unpriced |
| --- | --- | --- |
| Harris Teeter | $8.97 (2 lb × $2.49 + $3.99) | +1 unpriced |
| Food Lion | $12.63 (2 × $3.33 + 3 × $1.99) | +2 unpriced (bananas, per-lb with no quantity; apples, no price) |
| CVS Pharmacy | $5.99 | +1 unpriced (trail mix, price cleared) |
| Anywhere | $0.00 | +3 unpriced |

This gives 7 items from deals, 4 from recipes, and 4 manual; 3 bought, 1 in cart, and 11 needed. The three bought items sit in the collapsed "Bought (3)" group.

**"Weekend Cookout"**, active, 4 items all bought (hot dogs, buns, charcoal, ketchup) — for the all-bought summary and "Add bought items to pantry".

**"Party Supplies"**, archived, 8 items all bought — for the archived-list view.

**Rivera Family** has one empty list, for the empty-list state.

## Bills, chores, and errands

### Bills

Nine, spread across states and both visibilities. Dates are relative to the seed run; "C" is each bill's current occurrence. Every bill has `reminder_days_before` 3 and interval 1.

| Name | Amount | Current occurrence (C) | `anchor_date` | `created_at` | Unit | Autopay | Visibility | Owner | `is_subscription` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rent | $1,850.00 | 1st of next month | 1st of the month 5 months ago | 7 days before the anchor | Month | No | Household (Oak Street) | Alex | No |
| Duke Energy | $142.30 | 5 days ago (overdue) | C − 6 months | 3 days before the anchor | Month | No | Household (Oak Street) | Sam | No |
| Spectrum Internet | $74.99 | In 3 days | C − 3 months | The anchor date | Month | Yes | Household (Oak Street) | Alex | Yes |
| Water and Sewer | $58.40 | In 9 days | C − 3 months | 5 days before the anchor | Month | No | Household (Oak Street) | Jordan | No |
| Renters Insurance | $186.00 | In 40 days | C | 10 days ago | Year | Yes | Household (Oak Street) | Alex | No |
| Spotify | $11.99 | In 12 days | C − 3 months | The anchor date | Month | Yes | **Personal** | Alex | Yes |
| Adobe Creative Cloud | $59.99 | In 20 days | C − 3 months | The anchor date | Month | Yes | **Personal** | Sam | Yes |
| Gym Membership | $34.00 | In 6 days | C − 3 months | The anchor date | Month | Yes | **Personal** | Jordan | Yes |
| Old Phone Plan | $45.00 | — (archived 30 days ago) | 1st of the month 8 months ago | 7 days before the anchor | Month | No | Household (Oak Street) | Sam | No |

**Every occurrence from `anchor_date` up to, but not including, C has a paid or skipped `bill_payment_log` row.** Only Duke Energy's C is past due and unlogged. No bill has an unintended overdue occurrence. Old Phone Plan has paid rows for its first 7 occurrences, and is archived, so it appears in no view and sends no reminders.

Personal bills have a null `household_id`. Sam's Adobe subscription has `last_used_confirmed_at` 70 days ago, which triggers the "Still using this?" prompt. Sam's personal bills must be invisible to Alex and Jordan, and the seed data is what the RLS isolation tests assert against.

**Payment history:**

- Rent and Duke Energy each have six paid rows, one per occurrence from the anchor, each with `recorded_by` set.
- One Duke Energy payment was recorded four days after its occurrence date. Its `occurrence_date` is still the anchor day, and the occurrence after it is still exactly one month later. This exercises the anchored-recurrence rule.
- Duke Energy's current occurrence, 5 days ago, has no log row, so it stays overdue.
- Spectrum Internet, Spotify, Adobe, and Gym each have three `is_auto` paid rows (`recorded_by` null), for the three occurrences from the anchor. Each bill's `created_at` is its anchor date, so every auto-logged occurrence is on or after `created_at`, as the no-backfill rule requires.
- Water and Sewer's three past occurrences are C − 3 months (paid), C − 2 months (skipped: `is_skipped` true, for the skip display), and C − 1 month (paid).
- Renters Insurance has no history; its first occurrence is C.

**Subscriptions view.** Each figure is per user, in the active household:

| Viewer | Household | Subscriptions shown | Monthly total |
| --- | --- | --- | --- |
| Alex | Oak Street | Spectrum Internet, Spotify | $86.98 |
| Sam | Oak Street | Spectrum Internet, Adobe Creative Cloud | $134.98 |
| Jordan | Oak Street | Spectrum Internet, Gym Membership | $108.99 |
| Alex | Rivera Family | Spotify | $11.99 |
| Morgan | Rivera Family | None — empty state | $0.00 |

**Reminders.** Spectrum Internet's advance reminder (3 days ahead) is due today for Alex, as owner, and for Jordan, through the household-bills setting; it is labelled "autopay". Sam receives no Spectrum reminder.

### Chores

Six for Oak Street, covering every recurrence and rotation case. Occurrence dates are evaluated in `America/New_York`. Every chore has interval 1 unless stated.

| Chore | Unit | Anchor | Rotation / assignee | Completions | State |
| --- | --- | --- | --- | --- | --- |
| Take out trash | Week | 56 days ago | Alex → Sam → Jordan, `rotation_offset` 2 | 8, one per past occurrence | Sam's turn, due today |
| Clean bathroom | Week | 5 days ago | Alex → Sam → Jordan, `rotation_offset` 1 | 1 (the occurrence 5 days ago) | Jordan's turn, due in 2 days |
| Vacuum common areas | Week | 38 days ago | None, unassigned | 1 (the occurrence 38 days ago, by Casey, now a former member) | Overdue 3 days; last done 5 weeks ago |
| Replace HVAC filter | Month | 11 days from now | None, `assigned_to` Alex | 0 | Due in 11 days |
| Deep clean fridge | Month | 6 days from now | Alex → Sam, `rotation_offset` 0 | 0 | Alex's turn, due in 6 days |
| Water plants | Day, interval 3 | Creation date, 8 days ago | None, unassigned | 3 (8, 5, and 2 days ago) | Due tomorrow |

Checks on the rotation formula:

- Take out trash: (2 + 8) mod 3 = 1, which is Sam.
- Clean bathroom: (1 + 1) mod 3 = 2, which is Jordan.
- Deep clean fridge: (0 + 0) mod 2 = 0, which is Alex.

**Completion history:** Take out trash has eight weeks of completions, one recorded three days after its `occurrence_date`. The next occurrence after that late completion is still seven days after its `occurrence_date`, not three days on. This is the fixture the recurrence E2E journey asserts against.

Vacuum common areas missed four occurrences, which rolled forward without stacking. It shows "last done 5 weeks ago" without any nagging copy, and it sends no push, because it is unassigned. Its one completion was by Casey, who has since left Oak Street, so the chore history shows "Former member".

For unit tests only, a variant Deep clean fridge fixture is anchored on January 31 of a fixed non-leap year and a fixed leap year, to exercise month-end clamping through February.

### Errands

Six for Oak Street:

| Errand | Due | Assignee | Status |
| --- | --- | --- | --- |
| Return Amazon package | In 2 days | Alex | Open |
| Pick up dry cleaning | 2 days ago (overdue) | Unassigned | Open |
| Renew car registration | In 3 weeks | Sam | Open |
| Buy birthday card | None | Unassigned | Open |
| Mail rent check | 3 days ago | Alex | Done — `completed_by` Alex, `completed_at` 4 days ago |
| Replace porch light bulb | None | Jordan | Done — `completed_by` Sam, `completed_at` 6 days ago |

The mix gives the errands screen open items with and without due dates, an overdue one, an unassigned one, and a collapsed done group, including one errand completed by someone other than its assignee.

## App errors

Three `app_error` rows, for System health:

| Fingerprint source | Message | Count | `first_seen` | `last_seen` |
| --- | --- | --- | --- | --- |
| `service`, `refresh-deals` | "FlippFetchError: 503 from flyers endpoint" | 14 | 3 days ago | 2 hours ago |
| `web`, `/lists/:id` | "TypeError: Cannot read properties of undefined (reading 'merchantName')" | 3 | 1 day ago | 5 hours ago |
| `service`, `POST /api/households/:id/recipes/parse` | "RecipeParseError: no JSON-LD found" | 1 | 30 days ago | 30 days ago |

The first two appear in the last-24-hours list; the third is outside the window.
