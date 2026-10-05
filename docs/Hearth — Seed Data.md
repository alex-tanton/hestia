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

Deal validity is a calendar date in the store's local offset, so the seed computes it in `America/New_York`, which every 27514 household uses, rather than from the server's `current_date`. A seed run made in the evening Eastern time would otherwise date the expired deals to the household's today, and repricing — which evaluates `deal_valid_to` in the household timezone — would leave them alone.

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

Alex belongs to two households, which exercises multi-household switching, isolation, and the requirement that no view spans households. Alex's `active_household_id` is Oak Street. Morgan's timezone differs from the Rivera Family household timezone. That exercises the split between the two: every date and send time follows the household, and only quiet hours follow the user. Casey's Empty House has no data at all, for first-run and empty-state screens. Casey is also a **former member of Oak Street**, having left 5 weeks ago, so Oak Street's history has records by a departed member, which render as "Former member".

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

27514 and 27601 each get a `postal_code_refresh` row with `last_refreshed_at` six hours ago, so they read as covered by this morning's daily run and no on-demand refresh is queued for them in development.

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

Casey's Car Insurance is the personal bill the last-member departure leaves behind. Personal bills belong to the user rather than the household, so it must still be there, still personal, and still Casey's once Empty House is gone. While Casey belongs to no household, the bill is not dated or sent, is not overdue, and cannot be paid until Casey joins one.

## Deal fixtures

The most important fixtures in the set. Every parser path and every deal-related UI state needs a representative here. Prices are shown as they normalize: unit price with its `price_unit`, original price, `discount_percent` (floored), and the `conditional_reason` where the price is conditional. Normalized names assume the matcher's descriptor list includes at least "boneless", "skinless", "family pack", "large", "extra large", "grade a", "shredded", "sliced", "fresh", "crowns", "crumbles", "frozen", "organic", "sweet", "red or green", and "bag", and its brand list includes at least "Kraft", "Barilla", "Dave's Killer", "Progresso", "Tropicana", "Publix", "Tide", "Coca-Cola", "Harris Teeter", "Food Lion", "ALDI", "CVS", and "Lowes Foods".

Every row below is a real item from the 27514 captures, quoted by its normalized values. Grocery flyers price most of their stock behind a loyalty card, so most of these rows are conditional; that is what the captures contain, not a choice made here.

The raw captures for 27514 are in `e2e/fixtures/flipp/raw/`: `search-27514-{milk,chicken,harris-teeter,food-lion,publix,lowes-foods,aldi,cvs}.json`, `flyers-27514.json`, `data-27514.json` (the `flyers-ng.flippback.com` flyers-and-coupons variant), `merchants-27514.json`, `flyer-items-{harris-teeter-8132883,food-lion-8128502,publix-8128353,lowes-foods-8132169,aldi-8131738,cvs-8139694}.json`, `flyer-items-ng-harris-teeter-8132883.json` (the `flyers-ng` equivalent), and `item-{harris-teeter-1040206756,food-lion-1039547929,publix-1039945367,lowes-foods-1039938734,cvs-1041117892}.json` (item detail). Item ids change weekly, but merchant ids are stable, so fixtures and tests may rely on them: Harris Teeter 2431, Food Lion 2100, Publix 2361, Lowes Foods 2469, ALDI 2353, CVS Pharmacy 2264, and Walmart 2175 (the directory's other "Walmart", 234, is Walmart Canada).

### Clean prices

The straightforward path: a shelf price with nothing attached to it, and an original where the flyer gives one.

| Raw name | Merchant | Unit price | Original | Discount | Normalized name |
| --- | --- | --- | --- | --- | --- |
| Harris Teeter Peanut Butter Chocolate Puffs Cereal | Harris Teeter | $3.19 | — | — | peanut butter chocolate puff cereal |
| Woodbridge Cabernet or Chardonnay | Harris Teeter | $7.19 | $8.99 | 20% | woodbridge cabernet or chardonnay |
| Sargento Balanced Breaks | Food Lion | $3.49 | $3.99 | 12% | sargento balanced break |
| JUMBO YELLOW ONIONS | Lowes Foods | $1.49/lb | — | — | jumbo yellow onion |
| HASS AVOCADOS | Lowes Foods | $1.79 | — | — | hass avocado |

### Multi-buy

Parsed by division, with the unit price rounded half-up; `displayPrice` keeps the original copy. The last two carry an original that is also a bundle total, so both figures divide.

| Raw copy | Merchant | Parses to | `conditionalReason` | Normalized name |
| --- | --- | --- | --- | --- |
| 2/$5.00 — Egg-Land's Best Extra Large Eggs | Harris Teeter | $2.50 each | `loyalty_card` | egg land s best egg |
| 5/$5.00 — Farmers Market Cucumbers | Harris Teeter | $1.00 each | `loyalty_card` | farmer market cucumber |
| MVP 2/$5.00 — Food Lion Mini Potatoes | Food Lion | $2.50 each | `loyalty_card` | mini potato |
| 3/$5.00 — Harris Teeter 100% Pure Pumpkin, original $5.96 | Harris Teeter | $1.67 each, original $1.99, 16% off | `loyalty_card` | pure pumpkin |
| FINAL PRICE 2/$4.00 — Stouffer's Entrees, original $6.00 | Lowes Foods | $2.00 each, original $3.00, 33% off | `coupon` | stouffer s entree |

"3/$5.00" is the half-up rounding case: 500 ÷ 3 = 167 cents, and 596 ÷ 3 = 199.

### BOGO

The capture contains exactly one buy-one-get-one with a base price to halve. It parses to half of it, rounded half-up, at 50% off — the discount the offer states, not the 49% that halving an odd base would otherwise floor to.

| Raw copy | Merchant | Base price | Parses to | Normalized name |
| --- | --- | --- | --- | --- |
| Buy 1 Get 1 FREE* — Mifroma Le Gruyère AOP Cheese† BOGO* | Publix | $9.49 | $4.75 each, 50% off | mifroma le gruyère aop cheese bogo |

Every other captured BOGO is printed with no price at all, which is the skip case below. Publix prints 48 of them.

### Conditional price

Parsed, with `conditionalPrice: true` and a `conditionalReason`, so the UI badges them.

| Raw copy | Merchant | Unit price | Original | `conditionalReason` | Normalized name |
| --- | --- | --- | --- | --- | --- |
| 2/$6.00 with your VIC card — Harris Teeter Snack Cheese | Harris Teeter | $3.00 | — | `loyalty_card` | snack cheese |
| FINAL PRICE $3.99, "$1 OFF ONE DIGITAL COUPON" — Fa!rlife Milk | Lowes Foods | $3.99 | $4.99 | `coupon` | fa rlife milk |
| $4.79 WITH CARD — Colgate Optic White Advanced | CVS Pharmacy | $4.79 | — | `loyalty_card` | colgate optic white advanced charcoal purple sensitive total or hello adult toothpaste |

The Colgate row is also the secondary-rebate case: its sale story is "Also get savings with $5.00 on 2 Digital mfr coupon + Buy 2 get $6 ExtraBucks Rewards®". The shelf price parses and the rebate is ignored, and the card wins over the coupon because the card is what the $4.79 requires. Its captured name is the full "Colgate Optic White Advanced 3.2 oz, Charcoal, Purple, Sensitive 3.8-4.2 oz, Total 3 oz or hello adult toothpaste.", which is where that normalized name comes from, and the capture prints no original price beside it. The "This Week" list item still carries a $9.79 `regular_price`, because a list item's deal fields are a snapshot taken when it was added rather than a live reference.

The capture has no amount-off deal with a known original to subtract from — every "$1 OFF" in it is printed without a price — so the subtracting branch is covered by the parser's own unit test against the Requirements table, and the skip branch appears below.

### Favorite-store groceries

Everyday deals at Oak Street's favorite merchants, which is what the recipe readiness scores below are computed against. All but one are MVP or VIC prices, because that is how these flyers price groceries.

| Raw name | Merchant | Unit price | `conditionalReason` | Normalized name |
| --- | --- | --- | --- | --- |
| Broccoli Crowns | Food Lion | $1.99/lb | `loyalty_card` | broccoli |
| Food Lion Rainbow Bell Peppers | Food Lion | $2.99 | `loyalty_card` | rainbow bell pepper |
| Food Lion Baby Cut Carrots | Food Lion | $0.99 | `loyalty_card` | baby cut carrot |
| Food Lion Mini Cucumbers | Food Lion | $2.49 | `loyalty_card` | mini cucumber |
| Nature's Promise Organic Potatoes | Food Lion | $3.99 | `loyalty_card` | nature s promise potato |
| Food Lion Pasta | Food Lion | $0.99 | `loyalty_card` | pasta |
| Food Lion Chunk or Shredded Cheese | Food Lion | $3.49 | `loyalty_card` | chunk or cheese |
| Nature's Promise Jumbo Chicken Breast | Food Lion | $3.49/lb | `loyalty_card` | nature s promise jumbo chicken breast |
| 93% Lean Fresh Ground Beef | Food Lion | $7.29/lb | `loyalty_card` | lean ground beef |
| Beef Chuck Roast | Food Lion | $7.99/lb | `loyalty_card` | beef chuck roast |
| Bone-In Pork Chops | Harris Teeter | $3.49/lb | — | bone in pork chop |
| 2/$7.00 — Artesano Bakery Bread | Harris Teeter | $3.50 | `loyalty_card` | artesano bakery bread |

Bone-In Pork Chops is the OCR case: its post-price text reads "per Ib", not "per lb", and it still prices per pound. It is also the one unconditional row here — the capture prints it with no card or coupon wording at all — so the list and deal screens have a grocery deal with no badge beside the badged ones.

### Expired

All three have `valid_to` of yesterday and are attached to items on the "This Week" list. Together they exercise the three repricing outcomes.

| Raw name | Merchant | Unit price | Original | Repricing outcome |
| --- | --- | --- | --- | --- |
| Broccoli Crowns (last week) | Food Lion | $1.49/lb | — | Re-matches the current Food Lion broccoli deal by merchant plus normalized name: $1.99/lb, showing $1.49 struck through |
| Oscar Mayer Sliced Bacon | Food Lion | $5.99 | $6.99 | No current deal: falls back to the regular price, $6.99 |
| GARNIER Fructis shampoo/conditioner | CVS Pharmacy | $4.49 | — | No current deal and no regular price: the price is cleared, and the item shows "No price" with $4.49 struck through |

### Must be skipped

These exist specifically to assert the skip path. None should appear in results, and each should increment the skip counter under the reason named here. Together they cover every skip reason the captures contain.

| Raw copy | Merchant | Why |
| --- | --- | --- |
| CLR Cleaner or Lime & Rust Remover, with an empty price | Harris Teeter | No price at all, and no detail request is spent on it |
| BUY 1 GET 1 FREE each item rings at half price with your VIC card — Chicken Breast or Tenderloins | Harris Teeter | BOGO with no base price to halve |
| MVP $1.99 EA, "BUY 2 GET 1 FREE" — Food Lion Cream Cheese | Food Lion | Buy-N-get-M other than BOGO: $1.99 is not the price of one |
| $1.95 ea MUST BUY 2 — Liquid Death Sparkling Energy | Lowes Foods | Minimum-quantity pricing |
| 25% OFF WITH CARD — ALL Hyland's Naturals kids cold or sleep products | CVS Pharmacy | Percent off with no base price |
| Spend $25 get $5 ExtraBucks Rewards®◆ WITH CARD — ANY CVS Brand diabetes care | CVS Pharmacy | Rebate, not a shelf price |
| $5.00 off WITH MFR DIGITAL COUPON Any 1 — Zyrtec Allergy Shield Spray | Publix | Amount-off with no original price |

Mix-and-match with a purchase limit is the one skip rule with no representative in the 27514 capture; the parser's unit test uses the Requirements table's own example.

### State-specific fixtures

- **CVS Pharmacy and Publix are the high-skip merchants.** Over the captured search responses the chain skips 78% of CVS items and 46% of Publix items, against 19% for Harris Teeter, 19% for Food Lion, 14% for Lowes Foods, and none at all for ALDI, whose flyer is plain shelf prices throughout. The first two exercise the above-40% warning and System health's skip-rate display; ALDI's zero is the control that says the warning is not firing on everything.
- **An empty result set** for the query `"saffron"`, for the filtered-empty state
- **A stale `deal_query_cache` row** for 27514 and the query `"chicken"`, with `cached_at` 7 hours ago (the TTL is 6 hours) and no live fetch available, for the as-of-date path

## Recipes, pantry, and lists

### Pantry

Twenty items for Oak Street: olive oil, salt, black pepper, garlic, rice, flour, sugar, butter, milk, bread, soy sauce, cumin, paprika, canned tomatoes, black beans, chicken broth, parmesan, eggs, yellow onions, pasta.

Three pantry items also match current deals at Oak Street's favorite merchants:

- eggs, against Harris Teeter's Egg-Land's Best Extra Large Eggs
- bread, against Harris Teeter's Artesano Bakery Bread
- pasta, against Food Lion's Pasta

Each exercises pantry-beats-sale: the ingredient counts once, in the pantry bucket. The seed tests assert it is not double-counted. Yellow onions are on sale only at Lowes Foods, which Oak Street has not favorited, so they never count as on sale for it.

### Recipes

Twelve for Oak Street, chosen so readiness scores spread across the full range rather than clustering. Buckets use the matching rules in the Requirements document: token containment at 0.85, only current deals from favorite merchants (Harris Teeter, Food Lion, CVS), and pantry beats sale. Percentages round half-up.

Legend: **S** on sale, **P** in pantry, **B** to buy. A deal is named where it decides the bucket.

| Recipe | Ingredients and expected bucket | Readiness |
| --- | --- | --- |
| Sheet Pan Chicken and Vegetables | chicken breast S (FL), broccoli S (FL), bell pepper S (FL), olive oil P, garlic P, paprika P, lemon B | 6 of 7 — 86% (3 on sale, 3 pantry) |
| Spaghetti with Meat Sauce | pasta P (also on sale; pantry wins), ground beef S (FL), canned tomatoes P, onion P, garlic P, tomato paste B, parmesan P, dried oregano B | 6 of 8 — 75% (1 on sale, 5 pantry) |
| Vegetable Fried Rice | rice P, eggs P (also on sale; pantry wins), frozen peas B, carrots S (FL), soy sauce P, green onions B, sesame oil B, garlic P | 5 of 8 — 63% (1 on sale, 4 pantry) |
| Black Bean Tacos | black beans P, flour tortillas B, cumin P, avocado B, lime B, salsa B, cheese S (FL), red onion B | 3 of 8 — 38% (1 on sale, 2 pantry) |
| Chicken Noodle Soup | chicken breast S (FL), egg noodles B, carrots S (FL), celery B, onion P, garlic P, chicken broth P, thyme B, bay leaves B | 5 of 9 — 56% (2 on sale, 3 pantry) |
| Greek Salad | cucumber S (FL), roma tomatoes B, red onion B, feta cheese B, kalamata olives B, olive oil P, red wine vinegar B | 2 of 7 — 29% (1 on sale, 1 pantry) |
| Baked Ziti | pasta P, ground beef S (FL), canned tomatoes P, mozzarella B, ricotta B, parmesan P, garlic P | 5 of 7 — 71% (1 on sale, 4 pantry) |
| Breakfast Burritos | eggs P (also on sale; pantry wins), flour tortillas B, cheese S (FL), potatoes S (FL), bell pepper S (FL), salsa B | 4 of 6 — 67% (3 on sale, 1 pantry) |
| Lentil Curry | lentils B, coconut milk B, onion P, garlic P, ginger B, curry powder B, cumin P, canned tomatoes P, basmati rice B, cilantro B | 4 of 10 — 40% (0 on sale, 4 pantry) |
| Grilled Cheese and Tomato Soup | bread P (also on sale; pantry wins), butter P, cheese S (FL), canned tomatoes P, milk P | 5 of 5 — 100% (1 on sale, 4 pantry) |
| Shrimp Pad Thai | rice noodles B, shrimp B, tamarind paste B, fish sauce B, bean sprouts B, peanuts S (HT), lime B, green onions B | 1 of 8 — 13% (1 on sale) |
| Sunday Pot Roast | chuck roast S (FL), russet potatoes B, carrots S (FL), onion P, beef broth B, rosemary B, worcestershire sauce B, flour P | 4 of 8 — 50% (2 on sale, 2 pantry) |

Ingredients that the 27514 capture happens not to put on sale at a favorite merchant — frozen peas, flour tortillas, egg noodles, feta cheese, and russet potatoes specifically — sit in the buy bucket. That is the capture, not an omission: a week where every ingredient is on sale would test nothing.

Rivera Family has two recipes, **Tuna Poke Bowl** (ahi tuna, sushi rice, soy sauce, avocado, cucumber, sesame seeds) and **Miso Soup** (miso paste, tofu, green onions, dashi, wakame). Rivera Family has no pantry, and nothing on sale at Publix or Walmart matches either recipe. Both score 0%, which exercises the suggestions screen's "all recipes at 0%" state: shown normally, ranked by title.

The suggestions screen's "no deals available" state has a test-only fixture, not part of `seed.sql`: an E2E setup that empties `deal` and `deal_query_cache` for 27601 and stubs the `DealSource` double to fail. Rivera Family's suggestions screen then has recipes but no deals and no cache.

Grilled Cheese at 100% brackets the range against Tuna Poke Bowl and Miso Soup at 0% (Rivera Family, below), so the suggestions screens have both extremes without contrived data. Within Pad Thai, "rice noodles" needs both tokens and pantry "rice" supplies only one, and "bean sprouts" fails against pantry "black beans" for the same reason — but "peanuts" does contain-match Harris Teeter's real captured "Peanut Butter Chocolate Puffs Cereal" deal, both normalizing to share the token "peanut". That is the same direction of match the Matching test cases table already endorses ("eggs" against "Egg Noodles, 12 oz"), not a defect, so Pad Thai is genuinely 13%, not 0%: the raw capture decides the score, per "Using this data" above, even where it produces a coincidental match nobody chose on purpose.

The Recipe detail screen needs one override fixture: Oak Street has a force-no-match override for ingredient "cheese" against deal "snack cheese", Harris Teeter's. It demonstrates the "Corrected" label, and it changes no score above, because "cheese" already matches Food Lion's "chunk or cheese".

### Recipe sources

- **Ten with a `source_url`** pointing at sites publishing schema.org JSON-LD, for the parse path. Each ingredient keeps its original line in `raw_text`.
- **Two entered manually** (Lentil Curry, Shrimp Pad Thai), with no source URL and null `raw_text`
- **Rivera Family's two recipes** (Tuna Poke Bowl, Miso Soup) are manual too, with no source URL and null `raw_text`. The ten-plus-two count above already accounts for all of Oak Street's twelve; Rivera's are the simpler, unspecified case rather than two more invented source pages.
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
| Broccoli | Deal (expired, repriced), card | Food Lion | $1.99/lb, was $1.49 | 2 lb | Needed |
| Shredded cheese | Deal, card | Food Lion | $3.49 | 2 | Bought |
| Ground beef | Deal, card | Food Lion | $7.29/lb | 1 lb | In cart |
| Oscar Mayer Sliced Bacon | Deal (expired, repriced to regular), card | Food Lion | $6.99, was $5.99 | 1 | Needed |
| Apples | Manual | Food Lion | — | 3 lb (note) | Needed |
| Artesano Bakery Bread | Deal, card | Harris Teeter | $3.50 | 2 | Needed |
| Trash bags | Manual | Harris Teeter | — | 1 | Needed |
| Colgate Optic White | Deal, card | CVS Pharmacy | $4.79 | 1 | Needed |
| GARNIER Fructis shampoo | Deal (expired, price cleared) | CVS Pharmacy | No price, was $4.49 | 1 | Needed |
| Paper towels | Manual | CVS Pharmacy | $5.99 (entered) | 1 | Needed |
| Red onion | Recipes, matching units | Anywhere | — | 2 (Black Bean Tacos + Greek Salad) | Needed |
| Salsa | Recipes, mismatched units | Anywhere | — | "1 cup + 16 oz" (Black Bean Tacos + Breakfast Burritos) | Needed |
| Celery | Recipe | Anywhere | — | 1 | Needed |
| Lemon | Recipe | Anywhere | — | 1 | Bought |
| Dish soap | Manual | Anywhere | — | 1 | Bought |

Expected store headers, from needed and in-cart items only:

| Store | Subtotal | Unpriced |
| --- | --- | --- |
| Food Lion | $18.26 (2 lb × $1.99 + 1 lb × $7.29 + $6.99) | +1 unpriced (apples, no price) |
| Harris Teeter | $7.00 (2 × $3.50) | +1 unpriced (trash bags) |
| CVS Pharmacy | $10.78 ($4.79 + $5.99) | +1 unpriced (shampoo, price cleared) |
| Anywhere | $0.00 | +3 unpriced |

This gives 7 items from deals, 4 from recipes, and 4 manual; 3 bought, 1 in cart, and 11 needed. The three bought items sit in the collapsed "Bought (3)" group.

The capture has no Walmart search response, so no deal fixture is a Walmart one. Rivera Family still favorites Walmart, which is what makes its suggestions score 0%.

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
