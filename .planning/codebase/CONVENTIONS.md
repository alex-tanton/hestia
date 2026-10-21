---
last_mapped_commit: 431e646ab110c804b7229cecc9e151d343790b3a
last_mapped_at: 2026-10-21
---
# Coding Conventions

**Analysis Date:** 2026-10-21

## Naming Patterns

**Files:**
- Service and package modules are kebab-case: `apps/service/src/services/bills.ts`, `apps/service/src/deals/flipp/request-queue.ts`, `packages/recurrence/src/bills.ts`.
- React components are PascalCase `.tsx` named after the component: `apps/web/src/components/ui/Button.tsx`, `apps/web/src/components/bills/BillRow.tsx`.
- Non-component web modules are kebab-case `.ts`: `apps/web/src/lib/format.ts`, `apps/web/src/lib/offline/write-queue.ts`.
- Web hooks: `use-*.ts(x)` (`apps/web/src/lib/use-online-status.ts`, `apps/web/src/components/chores/use-chore-completion.ts`). API hook modules are `*-hooks.ts` (`apps/web/src/lib/api/bills-hooks.ts`, `apps/web/src/lib/api/list-hooks.ts`).
- Copy catalogs sit next to the feature as `*-copy.ts`: `apps/web/src/components/bills/bills-copy.ts`, `apps/web/src/screens/deals/deal-copy.ts`.
- Screens are `*Screen.tsx` under `apps/web/src/screens/<feature>/`; route wrappers are `*Route.tsx` (`apps/web/src/screens/settings/SettingsRoute.tsx`, `apps/web/src/pillars/bills/BillsRoute.tsx`).
- Service route modules are one per resource in `apps/service/src/routes/` (`bills.ts`, `chores.ts`, `deals.ts`, `meal-plan.ts`).
- Migrations are timestamped: `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`.
- Tests are co-located `<name>.test.ts(x)`; database and route integration tests are `<name>.integration.test.ts` (for example `apps/service/src/bills.integration.test.ts`, `apps/service/src/db/rls-isolation.integration.test.ts`).

**Functions:**
- camelCase everywhere. Service and domain functions are verbs: `listBills`, `createHouseholdBill`, `payBill`, `archiveBill` (`apps/service/src/services/bills.ts`).
- Pure planners and calculators are verb or noun phrases: `billOccurrence`, `planBillMove`, `currentBillOccurrence` (`packages/recurrence/src/bills.ts`).
- React components are PascalCase function declarations with an explicit return type: `export function Button({...}: ButtonProps): ReactElement` (`apps/web/src/components/ui/Button.tsx`).
- Route plugins are named `<resource>Routes`: `billRoutes`, `choreRoutes` (`apps/service/src/routes/bills.ts`).

**Variables and constants:**
- camelCase locals.
- Module-level constants are SCREAMING_SNAKE_CASE: `PROBLEM_CONTENT_TYPE`, `DATABASE_PROBLEMS` (`apps/service/src/problem.ts`), `VARIANT_CLASSES` and `BUTTON_BASE` (`apps/web/src/components/ui/Button.tsx`), `DAY_MS` (`apps/service/src/test/zone-dates.ts`).
- Lookup tables are typed `Readonly<Record<...>>`: `const DATABASE_PROBLEMS: Readonly<Record<string, readonly [number, string | null]>>`.
- Query-key factories live in `apps/web/src/lib/api/keys.ts` (`queryKeys.bills(householdId)`).

**Types:**
- Union string types are preferred over enums: `export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';` (`apps/web/src/components/ui/Button.tsx`). Zod enums are declared with `z.enum([...])` and then inferred (`billVisibilitySchema`).
- Props interfaces are `<Component>Props`, exported when tests or siblings need them (`ButtonProps`, `DashboardScreenProps`).
- Zod schemas are camelCase with a `Schema` suffix and the inferred type is the PascalCase stem: `billSchema` / `type Bill = z.infer<typeof billSchema>` in `packages/shared/src/api/bills.ts`. Request and response pairs follow the same rule: `createBillRequestSchema` / `CreateBillRequest`; path params use `billIdParamsSchema`.
- Service-layer row interfaces are named `<Thing>Row` and declared in the service file (`BillRow` in `apps/service/src/services/bills.ts`).
- Generated Kysely types in `apps/service/src/db/types.ts` are never hand-edited; regenerate with `pnpm db:types`. ESLint ignores that file.

**Casing across layers:**
- Database columns and raw rows are snake_case (`recurrence_unit`, `anchor_date`, `household_id`). Service code that works with raw rows uses snake_case field names (`packages/recurrence/src/bills.test.ts`).
- The shared/API layer and responses are camelCase (`recurrenceUnit`, `anchorDate`). The mapping happens in one layer; do not mix the two inside a single object.

## Code Style

**Formatting:**
- Prettier 3.9.8, config `.prettierrc.json`: `"singleQuote": true`, `"printWidth": 100`. Trailing commas, semicolons and 2-space indentation are Prettier defaults.
- Ignore list: `.prettierignore`. Enforced by `pnpm format:check` in CI (`.github/workflows/ci.yml`).
- Long unions and argument lists wrap one item per line; JSX props wrap one per line.
- Lint-staged runs `eslint --max-warnings=0 --fix` and `prettier --write` on staged `*.{ts,tsx,js,mjs}` and Prettier alone on JSON, Markdown, YAML, CSS and HTML (`.lintstagedrc.json`).

**Linting:**
- ESLint 10 flat config at `eslint.config.js`. It composes `js.configs.recommended`, `tseslint.configs.strictTypeChecked`, and `tseslint.configs.stylisticTypeChecked`, then `eslint-config-prettier` last.
- `pnpm lint` runs with `--max-warnings=0`; warnings fail the build.
- Web source (`apps/web/**`) adds `jsx-a11y` strict and `react-hooks` recommended rules.
- Explicit boundary types are required: `@typescript-eslint/explicit-module-boundary-types` is an error.
- `@typescript-eslint/no-non-null-assertion` is an error everywhere except tests and `e2e/**`. The source contains no non-null `!` assertions.
- Service-role fence: `apps/service/src/**/*.ts` forbids importing `privileged/` modules, except type-only imports, from anything other than `main.ts`, `cli.ts`, and `privileged/` itself (`no-restricted-imports` plus a `no-restricted-syntax` rule for dynamic `import()`). See `eslint.config.js`.
- Clock fence: test files, `apps/service/src/test/**`, `apps/web/src/test/**`, `e2e/**`, and `test/**/*.mjs` ban bare `new Date()`, `Date.now()`, and `Intl.DateTimeFormat().format()` without an instant. The rule is enforced by `no-restricted-syntax` selectors.

**TypeScript strictness (`tsconfig.base.json`):**
- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`, `verbatimModuleSyntax`, `erasableSyntaxOnly`.
- Run with `pnpm typecheck`.
- Optional props are typed with `exactOptionalPropertyTypes` in mind: `disabledReason?: string | undefined` (`apps/web/src/components/ui/Button.tsx`).

**Escape hatches are rare:**
- `eslint-disable` appears in source only where a real-clock read is unavoidable or a lint rule needs a reason: `apps/service/src/cli.test.ts`, `apps/service/src/deals/flipp/request-queue.test.ts`, `apps/service/src/test/zone-dates.ts`, `e2e/support/clock.ts`. Each carries a reason after `--`.
- No `@ts-expect-error` or `@ts-ignore` appears in `apps/*/src` or `packages/*/src`.
- Two `as unknown as` casts exist in non-test source: `apps/service/src/services/deals/storage.ts`. Prefer a narrowed type or a Zod parse over `as`.

**Module system:**
- ESM everywhere (`"type": "module"`). Service and packages use NodeNext resolution: relative imports end in `.js` even though the source is `.ts` (`apps/service/src/services/bills.test.ts` imports `'../problem.js'`).
- Web uses Bundler resolution with explicit `.ts` / `.tsx` extensions: `import { useApi } from './api-context.tsx';` (`apps/web/src/lib/api/bills-hooks.ts`), enabled by `allowImportingTsExtensions`.
- Type-only imports use `import type { ... }`, or inline `import { x, type Y }` when mixed (`verbatimModuleSyntax`).

## Import Organization

**Order (observed):**
1. External packages (`fastify`, `kysely`, `react`, `@tanstack/react-query`, `vitest`).
2. Workspace packages (`@hearth/shared`, `@hearth/recurrence`).
3. Relative imports, parent directories before siblings, with type-only imports mixed in by name.

Examples: `apps/service/src/services/bills.ts`, `apps/service/src/routes/bills.ts`, `apps/web/src/lib/api/bills-hooks.ts`.

**Path aliases:**
- None. Cross-package imports use the workspace names from `pnpm-workspace.yaml` (`@hearth/*`). Within an app all imports are relative.

**Barrels:**
- Each package exports from `packages/*/src/index.ts`, a pure re-export barrel. Do not add logic to barrels.
- `apps/service/src/jobs/index.ts` is also a barrel. Inside the apps, import the defining file directly.

## Error Handling

**Service (`apps/service`):**
- Errors are RFC 9457 problem details, never bare strings. Build with `problem(status, detail?)` and throw with `fail(status, detail?)` from `apps/service/src/problem.ts`. `fail` returns a `ProblemError`, which the global handler sends unchanged.
- Validate inputs at the route boundary with `parse(schema, value)` from `apps/service/src/http/context.ts`. It throws a 400 whose detail is `"<path>: <message>"`.
- Database failures map by SQLSTATE in the `DATABASE_PROBLEMS` table in `apps/service/src/problem.ts` (`42501` to 403, `23505` to 409, `HR001` to 410). Add new membership or constraint messages to that table, not to route code.
- Route handlers stay thin: authenticate, parse, call a service inside `ctx.inHousehold(...)` or `ctx.asUser(...)`, return or `reply.code(201).send(...)`. Example from `apps/service/src/routes/bills.ts`:

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

- Business-rule violations throw `ProblemError` or `fail` with a caller-facing message. `apps/service/src/services/bills.test.ts` asserts `ProblemError` for invalid visibility moves.
- Server errors are recorded through `buildErrorRecord` and `recordAppError` in `apps/service/src/services/errors.ts`. Names, messages and routes are scrubbed first by `scrubErrorReport` in `packages/shared/src/scrub.ts`.
- Service functions take the scoped Kysely handle first, then IDs, then a validated body: `createHouseholdBill(db, id, user.id, body)`.

**Web (`apps/web`):**
- Server errors arrive as problem bodies and are parsed by `apps/web/src/lib/api/problem.ts`. The client throws `ApiError` (status 0 for network failures).
- Show errors through `FormMessage` (`apps/web/src/components/ui/FormMessage.tsx`) or a toast (`apps/web/src/components/ui/Toast.tsx`).
- Field-level validation uses `apps/web/src/lib/use-field-errors.ts` and `apps/web/src/lib/validation.ts`.
- Render-time crashes are caught by `apps/web/src/components/states/ErrorBoundary.tsx` and the router's `errorElement` (`RouteError` in `apps/web/src/routes.tsx`).
- Offline-queueable writes (list items, chore and errand writes) go through `apps/web/src/lib/offline/write-queue.ts`. Other writes are ordinary online mutations that disable their controls while offline (`apps/web/src/lib/api/bills-hooks.ts`).

## Logging

- Log through `request.log` in the global error handler (`apps/service/src/app.ts`). Do not log raw request bodies or secrets.
- `console.*` does not appear in `apps/*/src`, `packages/*/src`, or `e2e`. Only tooling scripts (`scripts/`, `test/`, `apps/*/scripts/`, `supabase/seed/`) use it. Do not add `console.*` to shipped code.
- The test app in `apps/service/src/test/fake-app.ts` is built with `logger: false`, so tests stay quiet.

## Comments

**Style:**
- Explain why, not what. Most substantive comments in this codebase cite the spec section they implement, in the form `(Technical Architecture, "API surface" — "Bills")`, `(Requirements, "Bills and subscriptions")`, or `(Design › Accessibility)`. Keep these references when editing a file that already uses them.
- Document invariants and non-obvious constraints. Example: the opacity floors (95% hover, 97% active) in `apps/web/src/components/ui/Button.tsx` explain the WCAG contrast arithmetic behind each value.
- Module-level block comments (`/* ... */` or `/** ... */`) open files that carry a rule set: `apps/service/src/services/bills.ts`, `apps/web/src/lib/api/bills-hooks.ts`, `apps/web/src/test/harness.tsx`.
- Single-line `//` comments above a lint directive must carry a reason after `--`: `// eslint-disable-next-line no-restricted-syntax -- the one clock read: ...` (`apps/service/src/test/zone-dates.ts`).

**JSDoc/TSDoc:**
- Used on exported functions and types whose contract is not obvious from the signature, for example `ProblemError` and `problem` in `apps/service/src/problem.ts`, and `errorFingerprint` in `apps/service/src/services/errors.ts`. Not required on every export.
- Field-level doc comments are used on interface members that carry a semantic rule (`BillRow.timezone` in `apps/service/src/services/bills.ts`).

## Function Design

**Size:** Route handlers are short (a few lines). Service functions are longer and split by concern in the same file. Pure helpers stay small and are unit tested directly.

**Parameters:**
- Service functions take `db` first, then IDs, then the validated body.
- Components take one typed props object: `<DashboardCard pillar="bills" title="Bills" state={state} />`.
- Dependencies are injected through interfaces and factories, not imported singletons. Examples: `AuthClient`, `RealtimePort`, `PushPort` (`apps/web/src/lib/auth/auth-client.ts`, `apps/web/src/lib/realtime/realtime-port.ts`, `apps/web/src/lib/push/push-port.ts`).

**Return values:**
- Explicit return types on every exported function (`explicit-module-boundary-types`). Async service functions return `Promise<T>`.
- Prefer returning a value over mutating an argument. Pure planners return a plan object (`planBillMove` in `packages/recurrence/src/bills.ts`).

## Module Design

**Exports:**
- Named exports only. `export default` does not appear in source; the sole exception is the declaration file `apps/service/src/push/web-push.d.ts`.
- Web components are named exports: `export function Button`.

**Barrel files:**
- `packages/*/src/index.ts` and `packages/shared/src/index.ts` re-export `api/*` modules only. Their coverage is excluded in `packages/*/vitest.config.ts`.

**Route plugins:**
- `FastifyPluginAsync<{ ctx: RouteContext }>` values exported as `billRoutes`, `choreRoutes`, etc., and registered in `apps/service/src/app.ts`.

**Server state (web):**
- TanStack Query hooks live in `apps/web/src/lib/api/` (`useBills`, `useBill`), keyed by `queryKeys` from `apps/web/src/lib/api/keys.ts`. Each `*-hooks.ts` module opens with a block comment naming the mutations' offline behavior.

**Ambient state (web):**
- React context providers: `apps/web/src/lib/api/api-context.tsx`, `apps/web/src/lib/section-context.tsx`, `apps/web/src/components/ui/Toast.tsx`.

**Styling (web):**
- Tailwind CSS 4 utility classes composed with `cn()` from `apps/web/src/lib/cn.ts`. Design tokens live in `apps/web/src/index.css` and are checked by `apps/web/src/tokens.test.ts`.
- Variant maps are `Record<Variant, string>` constants (`VARIANT_CLASSES` in `apps/web/src/components/ui/Button.tsx`).
- Touch targets use `min-h-11 min-w-11` (44px) in shared primitives.

## Commits and Branches

- Conventional Commits, with the closed type and scope lists in `commitlint.config.js`. Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`. Scopes: `web`, `service`, `shared`, `recurrence`, `matching`, `db`, `e2e`, `docker`.
- Subject at most 71 characters with no trailing full stop; body lines at most 100 characters. Enforced by `@commitlint/config-conventional` via the Husky `commit-msg` hook.
- Branch names follow `{type}/{topic}` with one worktree per branch (`CONTRIBUTING.md`).

---

*Convention analysis: 2026-10-21*
