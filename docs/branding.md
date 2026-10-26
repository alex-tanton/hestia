# Hestia — Branding

Navigation, screen states, empty states, and accessibility patterns: see `docs/design.md`.

## 1. Name and voice

The product is **Hestia** — a household admin tool (shopping lists and deals, meals, bills,
chores). The name is deliberately not matched by the visual style: the brand direction is "a
well-organized kitchen" — bright, uncluttered, fast to find things in — rather than
cozy-rustic literalism.

Voice and tone:

- **State facts, not feelings.** E.g. "3 bills due this week", never "You've got this!"
- **Never nag.** Chores are tracked, not policed — "Last done 3 weeks ago," not "Overdue! Don't
  forget!"
- **No exclamation marks**, outside genuine confirmations, and rarely even there.
- **Second person, present tense.** "Add items to get started," not "Items may be added."
- **Name the thing.** "Add a recipe," not "Get started."
- **No emoji** in product copy.
- **No decorative animation or illustration-heavy empty states** — the app is used one-handed,
  often on a bad connection, so copy and interface stay plain and fast rather than cute.

Color carries section meaning, not decoration (see Color, below); it is never applied purely for
visual interest, and alarm-red is reserved for genuinely overdue/broken states.

## 2. Color

All color tokens live as CSS custom properties in `apps/web/src/index.css`, scoped under Tailwind
v4's `@theme`. Tailwind's own default color palette is explicitly disabled (`--color-*: initial`)
so every color reachable from a utility class is one of these roles — nothing is hand-hex'd in
components.

### Neutrals and surfaces

| Token | Light | Dark |
| --- | --- | --- |
| `--bg-base` | `#FFFFFF` | `#0F172A` (slate-900) |
| `--bg-raised` | `#F8FAFC` (slate-50) | `#1E293B` (slate-800) |
| `--border` | `#E2E8F0` (slate-200) | `#334155` (slate-700) |
| `--border-input` | `#64748B` (slate-500) | `#94A3B8` (slate-400) |
| `--text-primary` | `#0F172A` (slate-900) | `#F1F5F9` (slate-100) |
| `--text-secondary` | `#475569` (slate-600) | `#CBD5E1` (slate-300) |
| `--text-muted` | `#64748B` (slate-500) | `#94A3B8` (slate-400) |
| `--overlay` | `rgb(15 23 42 / 0.4)` | `rgb(2 6 23 / 0.6)` |

Theme switching is `prefers-color-scheme`-driven only (`@media (prefers-color-scheme: dark)`); there
is no manual toggle. `--border` is decorative (dividers, card edges); `--border-input` outlines
interactive controls and is the one with a contrast guarantee.

### Section colors

Each pillar owns a hue, exposed through a `--section*` alias set that a `data-section` attribute
on the route/card switches between. Values pulled from `apps/web/src/index.css`:

| Section | Light text/fill (`--<section>`) | Light icon/accent (`--<section>-accent`) | Dark (both roles) | Tint (bg) | Badge bg / text |
| --- | --- | --- | --- | --- | --- |
| Dashboard (`dashboard`) | `#475569` (slate-600) | `#475569` | `#94A3B8` (slate-400) | slate-100 / slate-800 | slate-100 / slate-700 (light); slate-800 / slate-200 (dark) |
| Lists (Deals & Lists) | `#15803D` (green-700) | `#16A34A` (green-600) | `#4ADE80` (green-400) | green-50 / green-950 | green-100 / green-800 (light); green-950 / green-300 (dark) |
| Meals | `#B45309` (amber-700) | `#D97706` (amber-600) | `#FBBF24` (amber-400) | amber-50 / amber-950 | amber-100 / amber-800 (light); amber-950 / amber-300 (dark) |
| Bills | `#2563EB` (blue-600) | `#2563EB` (blue-600) | `#60A5FA` (blue-400) | blue-50 / blue-950 | blue-100 / blue-800 (light); blue-950 / blue-300 (dark) |
| Chores | `#7C3AED` (violet-600) | `#7C3AED` (violet-600) | `#A78BFA` (violet-400) | violet-50 / violet-950 | violet-100 / violet-800 (light); violet-950 / violet-300 (dark) |

In dark mode every section's fill/icon color uses the 400 stop of its ramp, with `on-<section>`
text set to slate-900 (not white) for contrast on the lighter dark-mode fill. Each ramp (50–950)
is the published Tailwind v3 hex scale for that hue (green/amber/blue/violet/slate), hard-coded in
`:root` in `index.css` rather than generated, so the measured contrast figures stay fixed to
those exact values.

### Semantic colors

| Role | Light (`--<role>`) | Light accent | Dark | Badge (light bg/text) | Badge (dark bg/text) |
| --- | --- | --- | --- | --- | --- |
| Danger | `#DC2626` | `#DC2626` | `#F87171` | `#FEE2E2` / `#991B1B` | `#450A0A` / `#FCA5A5` |
| Warning | `#A16207` | `#A16207` | `#FACC15` | `#FEF9C3` / `#854D0E` | `#422006` / `#FDE047` |
| Success | `#047857` | `#059669` | `#34D399` | — (no badge role defined) | — |
| Info | `#0E7490` | `#0891B2` | `#22D3EE` | — (no badge role defined) | — |

Note: unlike the section colors, Success and Info have no `-badge` tokens in `index.css` — badge
color CSS variables only exist for danger, warning, and the sections/neutral. Warning's light
`--warning-accent` is `#A16207` (not the 600 stop `#CA8A04`), because the 600 stop fails the 3:1
contrast requirement on white — the implementation deliberately uses the 700 stop for both text
and accent roles in light mode. `--warning-accent` therefore equals `--warning` in light mode,
unlike every other role pair; this is intentional and documented in a code comment next to the
declaration.

All token definitions: `apps/web/src/index.css` (see the `:root` ramp block, the light `:root`
role block, and the `@media (prefers-color-scheme: dark)` block).

## 3. Typography

System fonts only — no web fonts are loaded. The stack, defined as `--font-sans` in the `@theme`
block of `apps/web/src/index.css`:

```
ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
'Helvetica Neue', Arial, sans-serif
```

Tailwind's default type scale is disabled (`--text-*: initial`) and replaced with this custom
scale, also in `index.css`:

| Token | Size | Line height | Weight |
| --- | --- | --- | --- |
| `display` | 1.875rem (30px) | 1.2 | 700 |
| `h1` | 1.5rem (24px) | 1.3 | 600 |
| `h2` | 1.25rem (20px) | 1.35 | 600 |
| `h3` | 1.0625rem (17px) | 1.4 | 600 |
| `body` | 1rem (16px) | 1.5 | 400 |
| `body-sm` | 0.875rem (14px) | 1.5 | 400 |
| `caption` | 0.8125rem (13px) | 1.4 | 600 |

These are used as Tailwind text utilities (`text-display`, `text-h1`, etc.) via `@theme`'s
`--text-<name>`/`--text-<name>--line-height`/`--text-<name>--font-weight` triplets, so a component
writes `className="text-h2"` and gets size, line-height, and weight together.

## 4. Spacing

There is no custom spacing scale in `index.css` or a Tailwind config override — no
`tailwind.config.*` file exists in `apps/web` at all (Tailwind v4 is configured entirely through
the `@theme` block in CSS). Only color, type, radius, shadow, and animation tokens are reset or
customized there (`--color-*`, `--text-*`, `--radius-*`, `--shadow-*` are set to `initial` and
redefined; `--spacing-*` is not touched). Spacing therefore uses Tailwind's default 4px-based
scale (`p-4` = 1rem, etc.) unmodified.

## 5. Iconography

Icons come from **Lucide**, via the `lucide-react` package (`apps/web/package.json`,
`"lucide-react": "1.47.0"`). There is no hand-drawn/custom SVG icon set or
`components/icons` directory in the web app — Lucide's React components are used directly.

The one enforced convention found in code: the tab bar (`apps/web/src/components/shell/TabBar.tsx`)
renders its icons at `size={24}` with `strokeWidth={1.5}`. Other usages vary by context (a smaller
20px size is common elsewhere in list rows and inline controls), but the 24px/1.5 stroke pairing
for primary navigation is the one place a specific size/stroke pair is hard-coded and consistent.

## 6. Motion

There is no separate motion-token file; the handful of animation primitives that exist are defined
directly in the `@theme` block of `apps/web/src/index.css`:

| Token | Definition |
| --- | --- |
| `--animate-sheet-in` | `sheet-in 200ms ease-out` (translateY(100%) → 0) |
| `--animate-sheet-out` | `sheet-out 150ms ease-out` (0 → translateY(100%)) |
| `--animate-fade-in` | `fade-in 150ms ease-out` (opacity 0 → 1) |
| `--animate-fade-out` | `fade-out 150ms ease-out` (opacity 1 → 0) |

These back the bottom-sheet component (`apps/web/src/components/ui/Sheet.tsx`), which applies
`animate-sheet-in`/`animate-sheet-out` to the sheet panel and `animate-fade-in`/`animate-fade-out`
to its overlay, keyed off Radix's `data-state` attribute. Outside of sheets, interactive elements
use an ad hoc Tailwind transition rather than a named token — e.g. `Button.tsx` applies
`transition-colors duration-150 ease-out` directly in its class string. There is no broader
formal motion system beyond these: no shared set of easing/duration tokens for arbitrary
component transitions, just the sheet/fade keyframes plus scattered `duration-150`-style
utility classes.

Both the named animations and any transition are force-disabled under reduced motion: `index.css`
sets `animation: none !important; transition: none !important;` inside
`@media (prefers-reduced-motion: reduce)`. The e2e animation-settling helper
(`e2e/support/axe.ts`, `settleAnimations`) confirms the only kind of animation the app produces is
finite (it explicitly filters out infinite-iteration animations like spinners and waits for every
other running `Animation`'s `finished` promise), consistent with there being no continuous
decorative motion — only these discrete enter/exit transitions.

## 7. Copy conventions

- **Notification length limit.** Notification title and body are each capped at **60 characters**,
  enforced in the shared zod schema: `title: z.string().trim().min(1).max(60)` and
  `body: z.string().trim().min(1).max(60)` (`notificationCopySchema` in
  `packages/shared/src/api/notifications.ts`).
  A producer that would exceed this doesn't truncate — `apps/service/src/notifications/copy.ts`
  validates the built copy against this schema and returns `null` if it fails, and the row is
  simply never enqueued (the caller logs only the notification's `type` and `id`, via
  `logDroppedCopy`, never the content).
- **Error messages never interpolate household content.** `apps/service/src/services/errors.ts`
  builds every stored error message through `scrubErrorReport` (`packages/shared/src/scrub.ts`)
  before it's recorded. The scrubber works by shape, not an allow-list of fields: it strips every
  email address, JWT/bearer token, decimal number, long number, and any value following a
  key name that denotes money or household content (the `RULES`, `SECRET_KEYS` and `CONTENT_KEYS`
  lists in `packages/shared/src/scrub.ts`), then hard-truncates the result to 500 characters
  (`SCRUBBED_MESSAGE_MAX_LENGTH` in the same file). The file's header comment states the rule
  directly: a recorded error "must never carry a bill amount, list or pantry contents, recipe
  data, an email address, or an auth token".
- **Queued/dropped-change copy counts, never names.** The PWA's refused-write message
  ("1 change couldn't be saved...", `apps/web/src/lib/offline/chore-errand-writes.ts`) is
  mirrored in the dropped-notification path: the service
  reports what was dropped by type and id only, never by content, matching the same
  "count, don't name" rule.
- **Notification wording patterns** (`apps/service/src/notifications/copy.ts`): a bill due
  notification reads "<bill> due <weekday>" (or "<bill> due today"
  on the due date), with the amount as body (plus "· autopay" when autopay is on); a chore/errand
  notification uses the chore or errand's own name as the title; a rotation notification reads
  "<chore> is yours"; batched notifications (e.g. list activity) state a count rather than listing
  individual items. These all fit under the global 60-character cap above.

## 8. Where tokens live

- **Color** — `apps/web/src/index.css` (ramps in the first `:root` block; light-theme roles in the
  second `:root` block; dark-theme overrides in the `@media (prefers-color-scheme: dark)` block).
- **Type** (family and scale) — `apps/web/src/index.css`, inside the `@theme { ... }` block
  (`--font-sans`, `--text-*` tokens).
- **Icons** — `apps/web/package.json` (`lucide-react` dependency) and the individual component
  files that import icons from it (e.g. `apps/web/src/components/shell/TabBar.tsx` for the
  size/stroke convention used in navigation).
- **Motion** — `apps/web/src/index.css` (`--animate-*` tokens and their `@keyframes` in the
  `@theme` block), plus ad hoc `transition-*`/`duration-*` utility classes in individual
  components such as `apps/web/src/components/ui/Button.tsx`.
- **Notification copy and its length limit** — `packages/shared/src/api/notifications.ts` (schema)
  and `apps/service/src/notifications/copy.ts` (producers).
- **Error scrubbing rule** — `packages/shared/src/scrub.ts` and
  `apps/service/src/services/errors.ts`.
