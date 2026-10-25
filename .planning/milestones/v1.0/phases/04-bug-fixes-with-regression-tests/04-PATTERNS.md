# Phase 4: Bug Fixes With Regression Tests - Pattern Map

**Mapped:** 2026-10-20
**Files analyzed:** 17 (new or modified)
**Analogs found:** 17 / 17 (all git-tracked; verified with `git ls-files`)

Note: `04-RESEARCH.md` plus `04-prototype.patch` already hold full prototype bodies for the new files. This map points each file at the in-repo analog to copy structure from and quotes the exact lines the edits anchor to. Where RESEARCH.md quotes a prototype, use it.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/src/lib/api/deals.ts` (mod, `useAddDealToList`) | hook | request-response | itself (lines 244-260) | exact |
| `apps/web/src/screens/deals/deal-card.test.tsx` (mod) | test | request-response | itself, `describe('adding a deal to a list')` line 123 | exact |
| `apps/service/src/services/add-to-list.ts` (mod) | service | CRUD | `apps/service/src/services/list-activity.ts:47` | exact (lock pattern) |
| `apps/service/src/meal-plan.integration.test.ts` (mod) | test | CRUD | itself, `describe('add missing to list')` line 341 | exact |
| `packages/shared/src/api/patch-schemas.test.ts` (new) | test | transform | `packages/shared/src/api/schemas.test.ts`, `bills.test.ts` | role-match |
| `apps/web/src/components/chores/RotationEditor.tsx` (mod) | component | event-driven | itself, lines 127-154 | exact |
| `apps/web/src/components/chores/RotationEditor.test.tsx` (new) | test | event-driven | `apps/web/src/screens/deals/deal-card.test.tsx` (userEvent style) | role-match |
| `test/eslint-service-role-fence.test.mjs` (new) | test | batch | `test/eslint-clock-ban.test.mjs` | exact |
| `scripts/deploy.sh` (mod, lines 95-97) | config/script | request-response | itself | exact |
| `scripts/deploy.test.mjs` (new) | test | file-I/O (spawn) | `scripts/test-sweep.test.mjs` | exact |
| `docker/kong.yml` (mod) | config | request-response | itself (`auth-v1-open` and `realtime-v1-rest-tenants` blocks) | exact |
| `test/kong-routes.test.mjs` (new) | test | transform | `test/eslint-clock-ban.test.mjs` (harness style) | role-match |
| `e2e/tests/08-caddy-refuses-gotrue-endpoints.spec.ts` (mod) | test | request-response | itself | exact |
| `package.json` (mod, `test:harness` line 16, `yaml` devDep) | config | n/a | itself | exact |
| `.claude/CLAUDE.md` (mod, lines ~199, 236) | docs | n/a | itself | exact |
| `docs/testing.md`, `docs/deploy.md` (mod) | docs | n/a | themselves | exact |
| `.planning/cleanup/FIX-LEDGER.md` (new, not in a PR) | docs | n/a | Phase 3 ledger under `.planning/cleanup/` | role-match |

## Pattern Assignments

### `apps/web/src/lib/api/deals.ts` (hook, request-response) - FIX-01

**Analog:** itself, current code lines 244-260:
```typescript
export function useAddDealToList(
  householdId: string,
): UseMutationResult<void, Error, AddDealToList> {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, dealId }: AddDealToList) =>
      api.send({
        method: 'POST',
        path: `/api/lists/${listId}/items`,
        body: { source: 'from_deal', id: crypto.randomUUID(), dealId },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dealKeys.lists(householdId) });
    },
  });
}
```
**Edit:** replace per RESEARCH Pattern 1 (a `useRef<{listId, dealId, id} | null>`; reuse when list+deal match; clear in `onSuccess`). Add `useRef` to the react import. Keep named exports, explicit types, and the `.ts`/`.tsx` extension imports as the file already does.

### `apps/web/src/screens/deals/deal-card.test.tsx` (test) - FIX-01

**Analog:** itself. Imports (lines 1-5) and the stub helper (lines 17-27) are reused as is:
```typescript
function stubFetch(handlers: Readonly<Record<string, StubHandler>>): ReturnType<typeof createFetchStub> {
  const stub = createFetchStub(handlers);
  vi.stubGlobal('fetch', stub.fetch);
  return stub;
}
afterEach(() => { vi.unstubAllGlobals(); });
```
Test shape (lines 124-146): `userEvent.setup()`, `stubFetch({ 'GET /api/households/:id/lists': ..., 'POST /api/lists/:id/items': () => ({ status: 201, body: {} }) })`, `renderScreen(<DealCard householdId={OAK_STREET_ID} deal={eggsDeal} />)`, click `findByRole('button', { name: "Add ... to a list" })`, read `stub.calls` (`call.method`, `call.path`, `call.body`). New cases go inside `describe('adding a deal to a list')`. The first POST handler throws `new TypeError('Failed to fetch')` after recording the row (lost response). No clock reads.

### `apps/service/src/services/add-to-list.ts` (service, CRUD) - FIX-02

**Analog:** `apps/service/src/services/list-activity.ts:44-49` (same lock primitive):
```typescript
  await sql`select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(${`list-activity:${list.id}`}, 0))`.execute(
    db,
  );
```
Anchor in the target: `const list = await requireList(db, listId);` at line 26; imports at lines 1-10 (`import type { Kysely } from 'kysely';` must become `import { sql, type Kysely } from 'kysely';`). Insert the lock right after `requireList`, keyed `add-to-list:${listId}`, with a why-comment (transaction-scoped, released at the end of the caller's `withUserDb` transaction).

### `apps/service/src/meal-plan.integration.test.ts` (test, CRUD) - FIX-02

**Analog:** itself, `describe('add missing to list')` (line 341). Pattern (lines 343-372): `const home = await household(app); const list = await createList(home); const recipe = await createRecipe(home, 'Cheese Toast', [{ itemName: 'Bread', quantity: 2 }]);` then `await as(app, home.user, 'POST', \`/api/recipes/${recipe.id}/add-to-list\`, { listId: list.id });`, `expectStatus(response, 200)`, `response.json<ShoppingListDetail>()`, helpers `allItems`, `itemNamed` (lines 124-128). Add a nested `describe('when the same call arrives again')` with the three cases from RESEARCH Pattern 2 (`Promise.all` of two `as(...)` calls for the overlap case). Needs the Supabase stack (PR CI `test-integration`).

---

### `packages/shared/src/api/patch-schemas.test.ts` (test, transform) - FIX-03

**Analogs:** `packages/shared/src/api/schemas.test.ts` (asserts `departRequestSchema.parse({})` stays `{ reassignments: {} }`), `packages/shared/src/api/contract.ts` (`endpoints` registry; each PATCH entry has `method: 'PATCH'`, `path`, `body`). Schema the guard must accept (`bills.ts:106-121`): fields built from `.unwrap()` of the create fields, then `.partial().refine(...)`:
```typescript
export const updateBillRequestSchema = z
  .object({
    name: billFieldsSchema.shape.name,
    category: billFieldsSchema.shape.category.unwrap(),
    autopay: billFieldsSchema.shape.autopay.unwrap(),
    ...
  })
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Change at least one field.',
  });
```
Use RESEARCH Pattern 3: `endpoints.filter((e) => e.method === 'PATCH')`, `_zod.def` wrapper walk flagging `default|prefault|catch`, cross-check of `/^update[A-Z]\w*RequestSchema$/` exports from `../index.js`, and a "guard the guard" mutant block. Co-located `*.test.ts`, vitest imports, relative imports ending `.js`.

---

### `apps/web/src/components/chores/RotationEditor.tsx` (component, event-driven) - FIX-04

**Analog:** itself, lines 128-154 (the suppression and the draggable `<li>`):
```tsx
{order.map((userId, index) => (
  // Drag is a pointer convenience ... (comment)
  // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
  <li key={userId} data-member={userId} draggable={!isUnavailable}
    onDragStart={() => { setDragIndex(index); }}
    onDragOver={(event) => { event.preventDefault(); }}
    onDrop={handleDrop(index)}
    onDragEnd={() => { setDragIndex(null); }}
    className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-base px-2 py-1.5">
    <GripVertical aria-hidden size={20} strokeWidth={1.5} className="shrink-0 cursor-grab text-muted" />
    <span className="min-w-0 flex-1 truncate text-body text-primary">...
    <Button variant="ghost" isIconOnly data-member={userId} data-control="up" ...>
```
**Edit:** RESEARCH Pattern 4 (lint-verified): `<li>` keeps `key`, `data-member`, border classes and no handlers; inner `<div role="presentation" onDragOver onDrop className="flex min-h-11 items-center gap-2 px-2 py-1.5">`; grip becomes `<button type="button" draggable tabIndex={-1} aria-label=... onDragStart onDragEnd>`. Retype `handleDrop` to `DragEvent<HTMLDivElement>`. Delete the three comment lines at 129-132 (replace with one why-comment, no `eslint-disable`). Do not touch the `focusRequest` effect or `data-control` attributes.

### `apps/web/src/components/chores/RotationEditor.test.tsx` (test, event-driven) - FIX-04

**Analog:** `deal-card.test.tsx` for imports/style (`@testing-library/react`, `userEvent.setup()`, `vitest`). The editor is controlled and needs no providers: use a small stateful `Harness` wrapper and plain `render`. Use the 7 cases listed in RESEARCH Pattern 4. Query by accessible names (`Move Sam Chen down`, `Remove Sam Chen from rotation`); drag path via `fireEvent.dragStart/dragOver/drop` and `closest('[role="presentation"]')`.

---

### `test/eslint-service-role-fence.test.mjs` (test, batch) - FIX-05

**Analog:** `test/eslint-clock-ban.test.mjs`. Copy lines 13-33 verbatim in shape:
```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { REPO_ROOT } from './support/vitest-project.mjs';

const eslint = new ESLint({
  cwd: REPO_ROOT,
  overrideConfig: tseslint.config(tseslint.configs.disableTypeChecked),
});

async function clockMessages(code, filePath) {
  const [result] = await eslint.lintText(code, { filePath });
  assert.ok(result, 'no lint result');
  const fatal = result.messages.filter((message) => message.fatal);
  assert.deepEqual(fatal, [], `the probe did not parse: ${JSON.stringify(fatal)}`);
  return result.messages.filter((message) => message.ruleId === 'no-restricted-syntax');
}
```
Change the rule-id filter to `@typescript-eslint/no-restricted-imports` and `no-restricted-syntax`; keep the BAD / GOOD / "files it covers" array-driven `describe` + `for ... it(code, ...)` layout and the header comment listing known gaps. Also assert `severity === 2`. The fence under test is `eslint.config.js:96-133` (`files: ['apps/service/src/**/*.ts']`; ignores `main.ts`, `cli.ts`, `privileged/**`, `**/*.test.ts`, `test/**`; `group: ['**/privileged/*']`, `allowTypeImports: true`; selector `ImportExpression > Literal[value=/privileged/]`).

---

### `scripts/deploy.sh` (script) - FIX-06

**Analog:** itself, lines 94-97 (current exposure on line 96):
```bash
log "applying pending migrations"
supabase migration up --workdir "$repo_root" \
  --db-url "postgresql://postgres:$(env_value POSTGRES_PASSWORD)@${db_ip}:5432/postgres?sslmode=disable" ||
  fail "migration failed; nothing restarted (the backup above is the restore point)"
```
**Edit:** prefix `PGPASSWORD="$(env_value POSTGRES_PASSWORD)"` on the `supabase` command and drop `:password` from the URL (`postgresql://postgres@${db_ip}:5432/...`). Keep the `|| fail` tail and the surrounding lines unchanged (D-10: no restructuring).

### `scripts/deploy.test.mjs` (test, file-I/O) - FIX-06

**Analog:** `scripts/test-sweep.test.mjs`. Copy header and scaffolding (lines 7-31):
```javascript
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const scratch = mkdtempSync(join(tmpdir(), 'hearth-sweep-'));
after(() => { rmSync(scratch, { recursive: true, force: true }); });

// child env built by filtering process.env:
env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'TZ' && ...)),
```
Use `spawnSync('bash', [DEPLOY], { cwd: REPO_ROOT, encoding: 'utf8', env })` with stubs first on `PATH`, `HEARTH_ENV_FILE`, `HEARTH_DEPLOY_SHA`, and `PGPASSWORD` deleted from the child env. Six assertions per RESEARCH Pattern 6. Add the file to `test:harness`.

---

### `docker/kong.yml` (config, request-response) - FIX-07

**Analog:** itself. Header and consumers/acls (lines 4-19) stay; change line 4 to `_format_version: '3.0'`. Replace `auth-v1-open` and `auth-v1`/`auth-v1-all` (lines 22-47) with per-route services per RESEARCH Pattern 7. Copy structure from:
- Open route style (lines 23-29): `url: http://auth:9999/verify`, route `strip_path: true`, `paths`.
- Protected route plugin block (lines 38-47):
```yaml
    plugins:
      - name: key-auth
        config:
          hide_credentials: false
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin
            - anon
```
- Refusal block (lines 98-101): `request-termination` with `status_code: 403`, `message: Access is forbidden.` (reuse for `auth-v1-denied`).
Leave lines 49-114 (`realtime-v1-*`) untouched. One list item per YAML line.

### `test/kong-routes.test.mjs` (test, transform) - FIX-07

**Analog:** `test/eslint-clock-ban.test.mjs` for harness style (`node:test` `describe`/`it`, `assert/strict`, `REPO_ROOT` from `./support/vitest-project.mjs`, header comment). Parse `docker/kong.yml` and `docker/docker-compose.yml` (`KONG_PLUGINS`, `docker-compose.yml:165`) with `yaml`. Assertions per RESEARCH "Static test". Needs the `yaml@2.9.1` devDependency (human-verify checkpoint first).

### `e2e/tests/08-caddy-refuses-gotrue-endpoints.spec.ts` (test, request-response) - FIX-07

**Analog:** itself. Reuse imports (lines 1-4: `expect, test`, `accessToken`, `rawRequest`, `SEED, readStackEnv`), the spelling-array + loop style (lines 18-58):
```typescript
test('POST /auth/v1/signup is refused in every spelling', async () => {
  for (const path of SIGNUP_SPELLINGS) {
    const response = await rawRequest('POST', path);
    expect(response.status, `POST ${path}`).toBe(403);
  }
});
```
and the positive-flow style (lines 60-70) with `rawRequest('GET', '/auth/v1/user', { apikey })` and `accessToken(request, SEED.alex.email)`. New tests assert status 403 plus body containing `Access is forbidden.` (Kong), with and without `apikey`, and that allowed calls are not Kong-refused.

---

## Shared Patterns

### Harness tests (`node --test` at the repo root)
**Source:** `package.json:16`
`"test:harness": "node --test test/clock-setup.test.mjs test/global-tz.test.mjs scripts/test-sweep.test.mjs test/eslint-clock-ban.test.mjs"`
**Apply to:** `test/eslint-service-role-fence.test.mjs`, `scripts/deploy.test.mjs`, `test/kong-routes.test.mjs`. Append all three or CI never runs them. These files are `.mjs` with a block-comment header, `node:assert/strict`, no clock reads (ESLint bans bare `new Date()`/`Date.now()` in test files and helpers; `test/probe.mjs` paths are covered).

### Advisory lock inside the request transaction
**Source:** `apps/service/src/services/list-activity.ts:47`. **Apply to:** `add-to-list.ts`.

### Web test harness
**Source:** `apps/web/src/test/harness.tsx` (`createFetchStub`, `renderScreen`, `StubHandler`), `apps/web/src/test/fixtures.ts` (`OAK_STREET_ID`). **Apply to:** `deal-card.test.tsx` additions. `RotationEditor.test.tsx` needs plain RTL `render` only.

### Commit scopes
`commitlint.config.js` scope enum: `web, service, shared, recurrence, matching, db, e2e, docker` (scope optional; `test(scripts): ...` fails). Examples in RESEARCH Wave 0 Gaps.

### Conventions to keep
Named exports only; relative imports end in `.js` in service and shared, `.ts`/`.tsx` in web; `import type` for type-only imports; explicit return types on exports; Prettier single quotes, width 100; comments explain why.

## No Analog Found

None. Closest-to-new items, using RESEARCH.md bodies instead of an in-repo analog:

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Zod `_zod.def` introspection in `patch-schemas.test.ts` | test helper | transform | No existing test walks Zod internals; use RESEARCH Pattern 3 |
| Stub-binary `bash` script inside `deploy.test.mjs` | test helper | file-I/O | `test-sweep.test.mjs` spawns Node, not shell stubs; `chmodSync`/`mkdirSync` imports are already in its import block, so the style fits |

## Metadata

**Analog search scope:** `apps/web/src/{lib/api,screens/deals,components/chores,test}`, `apps/service/src/{services,*.integration.test.ts}`, `packages/shared/src/api`, `test/`, `scripts/`, `docker/`, `e2e/tests/`, `eslint.config.js`, `package.json`
**Files scanned:** about 20 read or grepped; 04-prototype.patch deliberately not re-read (reference only)
**Pattern extraction date:** 2026-10-20
