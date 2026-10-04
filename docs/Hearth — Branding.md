# Hearth — Branding

2026-09-17 · @Someone

Fresh and modern, with each section of the app carrying its own color. System fonts, comfortable density, light and dark following system preference.

## Brand direction

Hearth should feel like a well-organized kitchen: bright, uncluttered, and quick to find things in. Fresh and modern rather than cozy-rustic, despite the name.

### Principles

- **Color carries meaning, not decoration.** Each section owns a hue so a glance at the tab bar or a dashboard card tells you which pillar you are looking at. Color is never applied for visual interest alone.
- **Bright, but not loud.** Saturated accents on neutral surfaces. The interface itself stays quiet; the content is what should be colorful.
- **Fast over fancy.** System fonts, no web-font loading, no decorative animation. The app is used standing in a grocery aisle on bad signal.
- **Legible at arm's length.** Comfortable density, generous tap targets, high contrast. Shopping-list checkoff happens one-handed while holding something else.

### What to avoid

- Alarm-red anywhere that is not genuinely overdue or broken
- Gradients, glassmorphism, heavy shadows, or other styling that costs render time
- Illustration-heavy empty states that push the actual action below the fold

## Color

### Section colors

Each pillar owns a hue, applied to its tab icon, screen headers, primary buttons within that section, and its dashboard card accent. The Deals & Lists pillar's tab is labelled "Lists".

| Section | Hue | Light text and filled buttons | Light icons and large accents (600) | Dark (400) | Rationale |
| --- | --- | --- | --- | --- | --- |
| Deals & Lists | Green | `#15803D` | `#16A34A` | `#4ADE80` | Fresh, grocery-adjacent, growth |
| Meals | Amber | `#B45309` | `#D97706` | `#FBBF24` | Warmth and food; the hearth itself |
| Bills | Blue | `#2563EB` | `#2563EB` | `#60A5FA` | Calm and trustworthy — deliberately unalarming for money |
| Chores | Purple | `#7C3AED` | `#7C3AED` | `#A78BFA` | Distinct and sentiment-neutral; avoids reading as a warning |
| Dashboard | Slate | `#475569` | `#475569` | `#94A3B8` | Hosts all four, so it stays neutral and lets section colors show |

In the light theme, section-colored text and filled buttons with white text use the "Light text and filled buttons" value. The 600 value is used only for icons and large accents (large text, focus rings, the tab-bar active icon), where 3:1 is the requirement. In the dark theme, filled buttons use the 400 value as the fill with `#0F172A` text.

Each section color needs a full ramp (50–900) generated from the listed 600 value, since tints are needed for backgrounds and badges. Every listed 600 value is the 600 stop of a Tailwind v3 palette (green, amber, blue, violet, slate), so those palettes, in their published hex values, are the ramps. Tints use the 50 stop in the light theme and the 950 stop in the dark theme. Dashboard slate is also the neutral scale, whose 50 stop is `bg-raised`, so its tint is its badge background instead.

### Semantic colors

Reserved across the whole app; never used as a section color.

| Role | Light text and filled buttons | Light icons and large accents | Dark | Used for |
| --- | --- | --- | --- | --- |
| Danger | `#DC2626` | `#DC2626` | `#F87171` | Overdue bills and chores, destructive actions, errors |
| Warning | `#A16207` | `#A16207` | `#FACC15` | Conditional-price deals (coupon or card), expiring-soon flags |
| Success | `#047857` | `#059669` | `#34D399` | Confirmations, synced state |
| Info | `#0E7490` | `#0891B2` | `#22D3EE` | Offline banner, neutral system notices |

Filled buttons and banners on the dark fills use `#0F172A` text, as with the section colors.

Danger is reserved exclusively for overdue and error states so it never competes with a section hue. Note that Success green and the Deals section green are deliberately different shades; Success is only ever used for transient confirmation, never as surface color inside Deals.

### Neutrals and theming

Both themes ship, following `prefers-color-scheme` with no manual toggle in v1.

| Token | Light | Dark |
| --- | --- | --- |
| `bg-base` | `#FFFFFF` | `#0F172A` |
| `bg-raised` | `#F8FAFC` | `#1E293B` |
| `border` | `#E2E8F0` | `#334155` |
| `border-input` | `#64748B` | `#94A3B8` |
| `text-primary` | `#0F172A` | `#F1F5F9` |
| `text-secondary` | `#475569` | `#CBD5E1` |
| `text-muted` | `#64748B` | `#94A3B8` |

`border` is for decorative dividers only: card edges, list separators, and section rules. It carries no meaning and needs no contrast minimum. `border-input` outlines every control whose boundary the user must find: inputs, textareas, selects, checkboxes, and segmented controls. It meets the 3:1 requirement for UI components in both themes, measured on each theme's surfaces:

| Theme | `border-input` on `bg-base` | on `bg-raised` |
| --- | --- | --- |
| Light `#64748B` | 4.76:1 | 4.55:1 |
| Dark `#94A3B8` | 6.96:1 | 5.71:1 |

### Badges

Badges are a tinted background with a darker text shade of the same hue (lighter in the dark theme). Every pair meets 4.5:1, since badge text is `caption` size.

| Badge | Light background / text | Ratio | Dark background / text | Ratio |
| --- | --- | --- | --- | --- |
| Section: Deals & Lists | `#DCFCE7` / `#166534` | 6.49:1 | `#052E16` / `#86EFAC` | 10.62:1 |
| Section: Meals | `#FEF3C7` / `#92400E` | 6.37:1 | `#451A03` / `#FCD34D` | 10.39:1 |
| Section: Bills | `#DBEAFE` / `#1E40AF` | 7.15:1 | `#172554` / `#93C5FD` | 8.15:1 |
| Section: Chores | `#EDE9FE` / `#5B21B6` | 7.57:1 | `#2E1065` / `#C4B5FD` | 8.25:1 |
| Section: Dashboard | `#F1F5F9` / `#334155` | 9.45:1 | `#1E293B` / `#E2E8F0` | 11.87:1 |
| Warning (conditional price) | `#FEF9C3` / `#854D0E` | 6.38:1 | `#422006` / `#FDE047` | 11.06:1 |
| Danger (overdue) | `#FEE2E2` / `#991B1B` | 6.80:1 | `#450A0A` / `#FCA5A5` | 8.51:1 |
| Neutral | `#F1F5F9` / `#334155` | 9.45:1 | `#334155` / `#E2E8F0` | 8.40:1 |
| Personal | `#F1F5F9` / `#334155`, with a Lucide `user` icon | 9.45:1 | `#334155` / `#E2E8F0`, with the icon | 8.40:1 |

The Personal badge uses the neutral colors so it never competes with a section hue. The icon and the word "Personal" carry its meaning.

### Contrast requirements

WCAG AA is the target: 4.5:1 for body text, 3:1 for large text and UI component boundaries. The pairs that carry text meet 4.5:1 on `bg-base`:

| Value | Light, on `#FFFFFF` |
| --- | --- |
| Deals green `#15803D` | 5.02:1 |
| Meals amber `#B45309` | 5.02:1 |
| Warning `#A16207` | 4.92:1 |
| Success `#047857` | 5.48:1 |
| Info `#0E7490` | 5.36:1 |
| Blue `#2563EB`, purple `#7C3AED`, slate `#475569`, danger `#DC2626` | Pass as-is |
| `text-muted` `#64748B` | 4.76:1 |

In the dark theme, `text-muted` `#94A3B8` is 6.96:1 on `#0F172A`. The 400 values are used for text and fills on dark surfaces, and filled buttons carry `#0F172A` text. The light-theme 600 values `#16A34A` (3.30:1), `#D97706` (3.19:1), `#059669` (3.77:1), and `#0891B2` (3.68:1) do not reach 4.5:1 on white, so they are never used for body text or for white text on a fill. They are kept only for icons and large accents, which need 3:1. Warning 600 `#CA8A04` reaches only 2.94:1, so it is not used in the light theme at all; warning icons use `#A16207` too. **Color is never the sole carrier of meaning** — overdue state gets an icon and a text label alongside the red, and section identity is reinforced by icon and heading, not hue alone.

## Typography

System fonts only. No web fonts are loaded, which removes a render-blocking request and makes the PWA feel native on each platform.

### Stack

```
font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
             "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

Tailwind's `font-sans` default already resolves to this stack, so no configuration is needed unless it is overridden.

Numerals in prices, totals, and quantities use `font-variant-numeric: tabular-nums` so columns of prices align.

### Scale

| Token | Size | Weight | Use |
| --- | --- | --- | --- |
| `display` | 30px / 1.2 | 700 | Dashboard greeting, onboarding headline |
| `h1` | 24px / 1.3 | 600 | Screen titles |
| `h2` | 20px / 1.35 | 600 | Section headings within a screen |
| `h3` | 17px / 1.4 | 600 | Card titles, list group headers |
| `body` | 16px / 1.5 | 400 | Default text |
| `body-sm` | 14px / 1.5 | 400 | Secondary detail, metadata |
| `caption` | 13px / 1.4 | 600 | Badges, timestamps, helper text |

Body text never goes below 14px. 16px is the minimum for any text input, since smaller values trigger zoom-on-focus in iOS Safari.

### Rules

- Three weights only: 400, 600, 700
- Paragraph text has a maximum line length of `70ch`
- No letter-spacing adjustments except on all-caps badges (`0.04em`)
- Text never relies on italics for emphasis; use weight

## Spacing, shape, and icons

### Spacing

4px base unit, matching Tailwind's default scale. Comfortable density means the mid-range values do the work.

| Context | Value |
| --- | --- |
| Screen horizontal padding | 16px |
| Gap between cards | 12px |
| Card internal padding | 16px |
| Gap between a label and its field | 6px |
| Vertical rhythm between sections | 24px |
| List row vertical padding | 12px |

### Tap targets

Minimum 44×44px for anything interactive. This is a hard requirement, not a guideline — the primary use case is one-handed operation while holding a shopping basket. Checkboxes on shopping-list rows get the full row as their tap target, not just the box.

### Shape and elevation

| Token | Value |
| --- | --- |
| `radius-sm` | 6px (badges, inputs) |
| `radius-md` | 10px (cards, buttons) |
| `radius-lg` | 16px (sheets, modals) |
| `shadow-sm` | `0 1px 2px rgb(15 23 42 / 0.06)`; cards on the dashboard only |
| `shadow-md` | `0 4px 12px rgb(15 23 42 / 0.12)`; bottom sheets and modals only |

Borders carry most of the separation work rather than shadows. Flat surfaces with a 1px border read better in dark mode and cost less to render.

### Icons

**Lucide** — open source, MIT licensed, tree-shakeable, and already idiomatic in React. 20px default, 24px in the tab bar, 1.5px stroke.

Tab icons: Dashboard `layout-dashboard`, Lists `shopping-cart`, Meals `utensils-crossed`, Bills `receipt`, Chores `clipboard-check`. The same icon marks its section on dashboard cards and the coming-soon state. Icons in the tab bar are always paired with a text label. Standalone icon buttons carry an `aria-label`.

### Motion

Minimal. 150ms ease-out for state changes, 200ms for sheet entry. All motion respects `prefers-reduced-motion` and drops to instant when it is set. No loading spinners where a skeleton is possible.

## Voice and tone

Plain, brief, and never cute. Hearth is a tool for household admin — it should sound like a competent housemate, not a mascot.

### Rules

- **State facts, not feelings.** "3 bills due this week", not "You've got this!"
- **Never nag.** Chores are tracked, not policed. "Last done 3 weeks ago" is the right register; "Overdue! Don't forget!" is not.
- **No exclamation marks** outside genuine confirmations, and rarely there.
- **Second person, present tense.** "Add items to get started", not "Items may be added".
- **Name the thing.** "Add a recipe", not "Get started".
- **No emoji** in product copy.

### Copy patterns

| Situation | Pattern | Example |
| --- | --- | --- |
| Empty state | What this holds + the action | "No recipes yet. Paste a link or add one by hand." |
| Loading | Nothing — use skeletons | — |
| Error, recoverable | What failed + what to do | "Couldn't reach the store data. Showing last week's deals." |
| Error, unrecoverable | What failed + how to report | "Something went wrong loading this list. Try again, or reload." |
| Offline | State + reassurance | "Offline. Changes will sync when you reconnect." |
| Queued change refused | What could not be saved, counted, naming no one | "1 change couldn't be saved. The chore or errand is no longer available." |
| Confirmation | Past tense, brief | "Added to Grocery List." |
| Destructive confirm | Name the consequence | "Remove Sam from this household? Their chores and lists need reassigning first." |

### Notification copy

Notifications are interruptions, so they must earn the tap. Lead with the specific. The title and the body are each at most 60 characters.

| Type | Title | Body |
| --- | --- | --- |
| `bill_due` | "Internet due Friday" | "$74.99" |
| `bill_due` (autopay) | "Internet due Friday" | "$74.99 · autopay" |
| `chore_due` | "Trash night" | "Your turn this week" |
| `chore_rotation` | "Trash duty is yours" | "Starting today, rotating from Sam" |
| `list_activity` | "5 items added to Grocery List" | "by Sam and Alex" |
| `meal_reminder` | "Today: Baked Ziti for dinner" | "Plus 1 more meal planned" |
| `weekly_meal_nudge` | "Next week isn't planned" | "12 recipes have sale ingredients" |
| `flyer_refresh` | "New weekly ads" | "Harris Teeter, Food Lion, CVS" |

Batched notifications always state a count rather than listing items. Never send a notification a user cannot act on.

The examples above name the items they were written for. In a live notification, the name of the chore, errand, bill, list, or recipe, and any count, take the place of the example's own, and the wording otherwise stays as written. A bill's title reads "<bill> due <weekday>" before the due date and "<bill> due today" on it. A chore's title is the chore's name and its body is "Your turn this week". An errand's title is its name and its body is "Due today". A rotation's title is "<chore> is yours". A meal reminder whose day holds one meal reads "Only meal planned today" as its body. A count of one reads "1 item" or "1 recipe has", as the count requires.
