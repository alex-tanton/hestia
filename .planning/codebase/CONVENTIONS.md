---
last_mapped_commit: b96ca32ac1130c09f8aa3066d715181ddf3fb31a
last_mapped_at: 2026-10-11
---
# Coding Conventions

**Analysis Date:** 2026-10-11

## Naming Patterns

**Files:**
- Service modules (`apps/service/src/**`, `packages/*/src/**`): kebab-case, e.g. `apps/service/src/services/bills.ts`, `apps/service/src/chores/occurrence.ts`, `apps/service/src/deals/flipp/request-queue.ts`.
- Web React components: PascalCase `.tsx` named after the component, e.g. `apps/web/src/components/ui/Button.tsx`, `apps/web/src/components/bills/BillRow.tsx`, `apps/web/src/screens/bills/BillDetailScreen.tsx`.
- Web non-component modules: kebab-case `.ts`, e.g. `apps/web/src/lib/format.ts`, `apps/web/src/lib/offline/write-queue.ts`.
- Web hooks: `use-*.ts` / `use-*.tsx` in kebab-case (`apps/web/src/lib/use-online-status.ts`, `apps/web/src/components/chores/use-chore-completion.ts`), while the API hook modules are `*-hooks.ts` (`apps/web/src/lib/api/bills-hooks.ts`, `apps/web/src/lib/api/list-hooks.ts`).
- Copy/string catalogs: `*-copy.ts` next to the feature, e.g. `apps/web/src/components/bills/bills-copy.ts`, `apps/web/src/components/chores/chore-copy.ts`, `apps/web/src/screens/deals/deal-copy.ts`.
- Screens: `*Screen.tsx` under `apps/web/src/screens/<feature>/`; route wrappers `*Route.tsx` (`apps/web/src/screens/settings/SettingsRoute.tsx`, `apps/web/src/pillars/bills/BillsRoute.tsx`).
- Route handler modules: one per resource in `apps/service/src/routes/` (`bills.ts`, `chores.ts`, `deals.ts`, `meal-plan.ts`).
- Tests: `<name>.test.ts(x)` co-located, or `<name>.integration.test.ts` for database/route integration (see TESTING.md).
- Migrations: timestamped SQL, `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`.

**Functions:**
- camelCase for everything callable. Service and domain functions are verbs: `listBills`, `createHouseholdBill`, `payBill`, `archiveBill` (`apps/service/src/services/bills.ts`).
- React components: PascalCase function declarations with an explicit return type, e.g. `export function Button({...}: ButtonProps): ReactElement` in `apps/web/src/components/ui/Button.tsx`.
- Pure helpers in `packages/recurrence/src/bills.ts`: `billOccurrence`, `planBillMove`, `currentBillOccurrence`.
- Query-key factories live in `apps/web/src/lib/api/keys.ts` (`queryKeys.bills(householdId)`).

**Variables and constants:**
- camelCase locals. Module-level constants are SCREAMING_SNAKE_CASE: `PROBLEM_CONTENT_TYPE`, `SCRUBBED_MESSAGE_MAX_LENGTH`, `BUTTON_BASE`, `DASHBOARD_EMPTY_COPY`, `FIRST_RUN_HEADING`, `DATABASE_PROBLEMS` (`apps/service/src/problem.ts`), `VARIANT_CLASSES` (`apps/web/src/components/ui/Button.tsx`).
- Lookup tables are typed with `Readonly<Record<...>>` (e.g. `DATABASE_PROBLEMS` in `apps/service/src/problem.ts`).

**Types and schemas:**
- Zod schemas are camelCase with a `Schema` suffix; the TypeScript type is the inferred PascalCase name with the same stem: `billSchema` / `type Bill = z.infer<typeof billSchema>` in `packages/shared/src/api/bills.ts`.
- Request/response types follow the same pair: `createBillRequestSchema` / `CreateBillRequest`, `billIdParamsSchema` for path params.
- Props interfaces are named `<Component>Props` and exported when tests or siblings need them (`ButtonProps`, `DashboardScreenProps`).
- Union string types are preferred over enums: `export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';`. Zod enums are declared as `z.enum([...])` and then inferred (`billVisibilitySchema`).

**Database identifiers:**
- Database columns and SQL are snake_case. Responses are camelCase; the mapping is done in one layer (see `docs/architecture.md`). Service code that works with raw rows uses snake_case field names (`recurrence_unit`, `anchor_date`, see `packages/recurrence/src/bills.test.ts`), while the shared/API layer uses camelCase (`recurrenceUnit`, `anchorDate`).
- Kysely types are generated: `apps/service/src/db/types.ts` (do not hand edit; regenerate with `pnpm db:types`).

## Code Style

**Formatting:**
- Prettier 3 with `.prettierrc.json`: `"singleQuote": true`, `"printWidth": 100`. Default trailing commas, semicolons, 2-space indent.
- `.prettierignore` excludes generated and non-source paths. Enforced by `pnpm format:check` in CI (`.github/workflows/ci.yml`).
- Long union or call arguments wrap one per line; JSX props are one per line when wrapping.

**Linting:**
- ESLint flat config at `eslint.config.js`:
  - `js.configs.recommended`
  - `tseslint.configs.strictTypeChecked` and `stylisticTypeChecked` (type-aware rules on)
  - `@typescript-eslint/explicit-module-boundary-types`: error (exported functions need explicit types)
  - `@typescript-eslint/no-non-null-assertion`: error everywhere except tests and `e2e/**`
  - `apps/web/**`: `jsx-a11y` strict and `react-hooks` recommended
  - `apps/service/src/**`: `no-restricted-imports` and `no-restricted-syntax` forbidding imports of `**/privileged/*` (service-role access), except `main.ts`, `cli.ts`, and tests. Type-only imports are allowed.
  - Ignored: `docs/`, `e2e/fixtures/`, `apps/service/src/db/types.ts`, `packages/matching/scripts/`.
- Lint runs with `--max-warnings=0`: `pnpm lint` (CI and pre-commit).
- TypeScript is strict (`tsconfig.base.json`): `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`, `verbatimModuleSyntax`, `erasableSyntaxOnly`. Run with `pnpm typecheck`.
- Type-escape hatches are rare: `eslint-disable` appears only twice in source (`apps/service/src/cli.test.ts:65`, `apps/web/src/components/chores/RotationEditor.tsx:132`), and `any` casts appear in only 3 non-test locations. Prefer a narrowed type or a Zod parse over `as`.

**Module syntax and imports:**
- ESM everywhere (`"type": "module"`). Service and packages use NodeNext resolution: relative imports end in `.js` even though the source is `.ts`, e.g. `import { ProblemError } from '../problem.js';` (`apps/service/src/services/bills.test.ts`).
- Web uses Bundler resolution with explicit `.ts`/`.tsx` extensions: `import { useApi } from './api-context.tsx';` (`apps/web/src/lib/api/bills-hooks.ts`), enabled by `allowImportingTsExtensions`.
- Use `import type { ... }` for type-only imports (`verbatimModuleSyntax`), inline as `import { x, type Y }` when mixed (`apps/web/src/components/ui/Button.tsx`).

## Import Organization

**Order (observed):**
1. Node built-ins with the `node:` prefix (`import { createHash } from 'node:crypto';`, `apps/service/src/services/errors.ts`).
2. Third-party packages (`fastify`, `kysely`, `zod`, `react`, `@tanstack/react-query`, `vitest`, `lucide-react`).
3. Workspace packages (`@hearth/shared`, `@hearth/recurrence`, `@hearth/matching`).
4. Relative imports, parents before siblings (`../http/context.js` before `./bills.js`).

No blank-line grouping is enforced; the ordering above is the convention. Imports are not sorted by a tool.

**Path Aliases:**
- None. All imports are relative within an app, and cross-package imports use the `@hearth/*` workspace names (`pnpm-workspace.yaml`).

**Barrel files:**
- Each package exports from `packages/*/src/index.ts`, a pure re-export barrel. `packages/shared/src/index.ts` re-exports the `api/*` modules; consumers import from `@hearth/shared`.
- `apps/service/src/jobs/index.ts` is also a barrel. Inside the apps, prefer importing the defining file directly.

## Error Handling

**Service (HTTP):**
- Errors are RFC 9457 problem details (`type`, `title`, `status`, `detail`), never bare strings. Build them with `problem(status, detail?)` and throw with `fail(status, detail?)` from `apps/service/src/problem.ts`, which returns a `ProblemError` the global handler sends unchanged.
- Validate inputs at the route boundary with `parse(schema, value)` from `apps/service/src/http/context.ts`, which throws a 400 `fail` whose detail is `"<path>: <message>"`.
- Database failures are mapped by SQLSTATE in the `DATABASE_PROBLEMS` table in `apps/service/src/problem.ts` (`42501` to 403, `23505` to 409, `HR001` to 410, and so on). Add new membership or constraint messages there, not in route code.
- Route handlers are thin: authenticate, parse, call a service function inside `ctx.inHousehold(...)` or `ctx.asUser(...)`, return or `reply.code(201).send(...)`.

Example (`apps/service/src/routes/bills.ts`):

```ts
app.post('/api/households/:id/bills', async (request, reply) => {
  const user = await ctx.authenticate(request);
  const { id } = parse(householdIdParamsSchema, request.params);
  const body = parse(createBillRequestSchema, request.body);
  const bill = await ctx.inHousehold(user, id, (db) =>
    createHouseholdBill(db, id, user.id, body),
  );
  return reply.code(201).send(bill);
});
```

**Service domain logic:**
- Business-rule violations throw `ProblemError` (or `fail`) with a caller-facing message. Example: `apps/service/src/services/bills.test.ts` asserts `ProblemError` for invalid visibility moves.
- Errors are recorded for observability via `buildErrorRecord` and `recordAppError` in `apps/service/src/services/errors.ts`; raw names, messages, and routes are scrubbed first (`scrubErrorReport` in `packages/shared/src/scrub.ts`).

**Web:**
- Server errors arrive as problem bodies and are parsed by `apps/web/src/lib/api/problem.ts`. Show them through `FormMessage` (`apps/web/src/components/ui/FormMessage.tsx`) or a toast (`apps/web/src/components/ui/Toast.tsx`).
- Field-level validation uses `apps/web/src/lib/use-field-errors.ts` and `apps/web/src/lib/validation.ts`.
- Render-time crashes are caught by `apps/web/src/components/states/ErrorBoundary.tsx`.
- Offline-queueable writes (list items, chore and errand writes) go through `apps/web/src/lib/offline/write-queue.ts`; other writes are ordinary online mutations that disable controls while offline.

**Jobs:**
- Scheduled jobs live in `apps/service/src/jobs/*.ts` and are driven by `apps/service/src/jobs/scheduler.ts`; `apps/service/src/jobs/advisory-lock.ts` provides the Postgres advisory-lock helper the scheduler uses.

## Logging

**Framework:** Fastify's built-in pino logger (`request.log`), configured in `apps/service/src/app.ts` (`logger: false | { level: string }` option). Job entry points use the queue logger wired in `apps/service/src/main.ts`.

**Patterns:**
- Log via `request.log.error(...)` in the global error handler (`apps/service/src/app.ts`, around lines 113 to 120). Do not log raw request bodies or secrets.
- `console.log` appears only in `packages/matching/scripts/fuzzy-benchmark.ts`, a throwaway benchmark. Do not add `console.*` to shipped code.
- The in-memory test app in `apps/service/src/test/fake-app.ts` is built with `logger: false`, so tests stay quiet.

## Comments

**When to comment:**
- Explain why, not what. Most comments in this codebase name the spec section they implement, using the form `(Technical Architecture, "API surface" — "Bills")`, `(Requirements, "Bills and subscriptions")`, or `(Design › Accessibility)`. Keep these references when adding to a file that already uses them.
- Document invariants and non-obvious constraints, e.g. why opacity floors are 95%/97% in `apps/web/src/components/ui/Button.tsx`, or why the service role is fenced in `eslint.config.js`.
- Module-level block comments (`/* ... */` or `/** ... */`) open files that carry a rule set, such as `apps/web/src/lib/api/bills-hooks.ts` and `apps/web/src/test/harness.tsx`.

**JSDoc/TSDoc:**
- Used on exported functions and types whose contract is not obvious from the signature, e.g. `errorFingerprint` in `apps/service/src/services/errors.ts` and `ProblemError` in `apps/service/src/problem.ts`. Not required on every export.
- Single-line `//` comments explain a lint or ESLint directive, like `// eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions`, and should always be followed by a reason.

## Function Design

**Size:** Route handlers and service functions stay short (roughly 5 to 15 lines). Pure logic lives in `packages/*` so it can be unit-tested without I/O.

**Parameters:**
- Service functions take the scoped database handle first, then IDs, then a validated body: `createHouseholdBill(db, id, user.id, body)`.
- Components take one typed props object: `renderCard(state)`, `<DashboardCard pillar="bills" title="Bills" state={state} />`.
- Optional props use `?` and are declared with `exactOptionalPropertyTypes` in mind: `disabledReason?: string | undefined`.

**Return values:**
- Explicit return types on exported functions (enforced by `explicit-module-boundary-types`). Return `Promise<T>` for async service functions.
- Prefer returning a value over mutating arguments; pure planners return a plan object (`planBillMove`).

## Module Design

**Exports:**
- Named exports only. `export default` is not used in source (only the declaration file `apps/service/src/push/web-push.d.ts` uses it). Web components are named exports (`export function Button`).

**Barrel files:**
- `packages/*/src/index.ts` and `packages/shared/src/index.ts` are re-export barrels. Do not add logic to them; their coverage is excluded in `packages/*/vitest.config.ts`.

**Route registration:**
- Route plugins are `FastifyPluginAsync<{ ctx: RouteContext }>` values exported as `billRoutes`, `choreRoutes`, etc., and wired in `apps/service/src/app.ts`.

**Web components and state:**
- Server state lives in TanStack Query hooks under `apps/web/src/lib/api/` (`useBills`, `useBill`), keyed by `queryKeys` from `apps/web/src/lib/api/keys.ts`.
- Ambient state is in React context providers (`apps/web/src/lib/api/api-context.tsx`, `apps/web/src/lib/section-context.tsx`, `apps/web/src/components/ui/Toast.tsx`). Dependencies such as the auth client and realtime port are injected through interfaces (`AuthClient`, `RealtimePort`, `PushPort`).

**Styling (web):**
- Tailwind CSS 4 utility classes (`tailwindcss` and `@tailwindcss/vite` in `apps/web/package.json`) composed via `cn()` from `apps/web/src/lib/cn.ts`; design tokens are in `apps/web/src/index.css` and checked by `apps/web/src/tokens.test.ts`. Variant maps are `Record<Variant, string>` constants (`VARIANT_CLASSES` in `apps/web/src/components/ui/Button.tsx`). Accessibility minimums (44px touch targets via `min-h-11 min-w-11`) are built into shared primitives.

---

*Convention analysis: 2026-10-11*
