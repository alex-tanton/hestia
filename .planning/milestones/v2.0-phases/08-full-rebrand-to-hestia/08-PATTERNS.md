# Phase 8: Full Rebrand to Hestia - Pattern Map

**Mapped:** 2026-10-25
**Files analyzed:** 9 logic-bearing or new files (the roughly 338-file mechanical sweep is covered by RESEARCH.md Pattern 1 and needs no analog)
**Analogs found:** 9 / 9 (all are the file itself or a sibling in the same directory; all tracked)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/check-repo-hygiene.mjs` (add legacy-name check) | CI gate script | batch (git index scan) | itself, checks 1 to 3 (`ls-files -ci`, `records()`, `git()`) | exact |
| `scripts/check-repo-hygiene.test.mjs` (add legacy-name cases) | test (node:test) | temp-repo, child process | itself (`newRepo`, `stage`, `hygiene`) | exact |
| `scripts/check-migrations-append-only.mjs` (add `--exemptions`) | CI gate script | batch (git diff) | itself (`parseArguments`, `git`, `parseNameStatus`) | exact |
| `scripts/check-migrations-append-only.test.mjs` (add exemption cases) | test (node:test) | temp-repo, child process | itself (`repoWith`, `check`, `write`) | exact |
| `scripts/migration-exemptions.json` (NEW) | config (data) | file-I/O read | none (no JSON gate-config exists in `scripts/`) | no analog; use RESEARCH Pattern 2 |
| `apps/web/scripts/check-build.mjs` (add manifest and title assertion) | build check | file-I/O (reads `dist/`) | itself (`fail()`, `html`, `contents`) | exact |
| `apps/service/src/env.test.ts` (add 2 cases) | test (Vitest) | transform | itself (`REQUIRED`, `parseEnv` cases) | exact |
| `.planning/phases/08-full-rebrand-to-hestia/08-OWNER-CHECKLIST.md` (NEW) | planning artifact | none | none (only `07-VERIFICATION.md` and `.planning/environment/CLOUD-ENVIRONMENT.md` are prose precedents) | no analog; use RESEARCH Owner checklist |
| `.planning/environment/cloud-setup.sh` and `cloud-check.sh` (modified) | tooling script | none | n/a, hand-edit (RESEARCH Pitfall 8) | n/a |

Tracked check: `scripts/check-repo-hygiene.mjs` and `apps/web/scripts/check-build.mjs` are in `git ls-files`. `scripts/migration-exemptions.json` is not tracked yet (new).

## Pattern Assignments

### `scripts/check-repo-hygiene.mjs` (CI gate, batch)

**Analog:** itself. Add the guard as check 4 inside `main()`'s `try`, before the `catch` at line 154. The header comment (lines 1 to 18) says "three kinds of drift"; update it to four and document the exit codes unchanged.

**Index-read helpers to reuse, not duplicate** (lines 52 to 76):
```js
function git(repo, args, input) {
  const run = spawnSync('git', ['-C', repo, ...args], {
    maxBuffer: MAX_BUFFER,
    ...(input === undefined ? {} : { input }),
  });
  if (run.error !== undefined) { throw new Error(`cannot run git: ${String(run.error)}`, { cause: run.error }); }
  if (run.status !== 0) { throw new Error(`git ${args.join(' ')} exited with status ${String(run.status ?? run.signal)}: ` + run.stderr.toString('utf8').trim()); }
  return run.stdout;
}
function records(buffer) { return buffer.toString('utf8').split('\0').filter((record) => record !== ''); }
```

**Gotcha for the new check:** `git()` throws on any non-zero status, but `git grep` exits 1 when there is no match. Do not call `git()` for `git grep --cached -I -l -i -F -z hearth`; either spawn directly and treat status 1 as empty, or add a small variant that accepts status 0 and 1. Status greater than 1 must still throw so the script exits 2.

**Problem-recording shape to copy** (lines 127 to 129, 142 to 145):
```js
for (const path of records(git(repo, ['ls-files', '-ci', '--exclude-standard', '-z']))) {
  problems.push({ path, text: `tracked but ignored by .gitignore: ${path}` });
}
```
New check pushes `{ path, text: \`legacy name in ${path}\` }` for (a) each `git grep --cached` hit and (b) each `git ls-files -z` path whose name matches `/hearth/i`, skipping any path equal to or under an allowlist entry. Final sort and output (lines 161 to 168) stay as they are, so the `repo-hygiene: N problems` and `repo-hygiene: clean (F files, S scripts)` lines stay byte-identical. Allowlist as an explicit commented constant near line 28:
```js
const LEGACY_NAME_ALLOWLIST = [
  '.planning/', // planning state quotes the old name by design (includes milestones/v1.0)
  'scripts/check-repo-hygiene.mjs', // holds the pattern
  'scripts/check-repo-hygiene.test.mjs',
  'scripts/migration-exemptions.json', // fromPath values keep the old file name; delete with the exemption
];
```
Self-reference caveat: the script and test must contain "hearth" to match; build the regex or fixture strings so the allowlist entry covers them (they are allowlisted, so literals are fine).

**Test cases to add** (RESEARCH Pattern 3): source-file hit fails and names the path; `Hearth` and `HEARTH` hit; hit only in an allowlisted path passes; tracked path whose name contains the word fails; binary file skipped (`-I`); index judged not working tree; non-git dir exit 2 (already covered by the existing exit-2 block).

---

### `scripts/check-repo-hygiene.test.mjs` (test, temp-repo child process)

**Analog:** itself. Copy the helper block and a `describe` block pattern.

**Helpers to use** (lines 52 to 88): `newRepo()`, `stage(repo, path, content, { executable })`, `stageRaw(...)`, `hygiene(repo, ...extra)` returning `{ status, stdout, stderr }`.

**Case pattern** (lines 133 to 142):
```js
describe('check-repo-hygiene: tracked but ignored', () => {
  it('fails on a force-added file that .gitignore ignores and names it', () => {
    const repo = newRepo();
    stage(repo, '.gitignore', '*.log\n');
    stage(repo, 'debug.log', 'noise\n');
    const run = hygiene(repo);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^tracked but ignored by \.gitignore: debug\.log$/m);
    assert.match(run.stdout, /^repo-hygiene: 1 problems$/m);
  });
});
```
**Phase-8 edits to this file itself:** lines 20, 30, 36 carry `hearth-hygiene-`, `HEARTH_TEST_NOW`, `hearth-test`. The sweep turns them into `hestia-*` and `HESTIA_TEST_NOW`; keep the file on the allowlist because new fixtures must contain the old word. Existing clean-repo cases (`stage(repo, 'README.md', '# readme\n')`) contain no old name, so they stay passing.

---

### `scripts/check-migrations-append-only.mjs` (CI gate, batch)

**Analog:** itself. Extend; do not loosen.

**Argument parsing to extend** (lines 40 to 56): add `--exemptions` to the allowed flags and the `options` object. Default `join(REPO_ROOT, 'scripts', 'migration-exemptions.json')`, resolved against the real checkout (not `--repo`), because tests pass a temp repo. Update `USAGE` (lines 30 to 32).
```js
const options = { base: undefined, repo: REPO_ROOT };
...
if (flag !== '--base' && flag !== '--repo') usageError(`unknown flag ${String(flag)}`);
```
Treat the value as a file path only, never interpolated into git (RESEARCH security row).

**Git helper returns `{ status, stdout, stderr }` and does not throw** (lines 59 to 65), so use it for `rev-parse` of blobs:
```js
const mb = git(repo, ['merge-base', base, 'HEAD']);               // status 0 else exit 2
git(repo, ['rev-parse', `${mb}:${fromPath}`]);                     // base blob
git(repo, ['rev-parse', `HEAD:${toPath}`]);                        // head blob
```
Validate `fromBlob`/`toBlob` with a 40-hex pattern before use (mirror `SHA_PATTERN`, line 26).

**Where the filter goes** (lines 127 to 138). Current:
```js
const problems = changes.filter((change) => change.status !== 'A');
for (const { status, path } of problems) { console.error(`${status} ${path}: applied migrations are append-only; only new files may be added`); }
if (problems.length > 0) { console.log(`migrations: ${String(problems.length)} problems`); return 1; }
console.log(`migrations: ${String(changes.length)} added, nothing else changed`);
return 0;
```
Remove exactly the matched changes from `problems` before printing: for a rename entry the `D fromPath` and `A toPath` pair (the diff uses `--no-renames`, line 106); for an equal-path entry the single `M`. Print `exempt: <path> (<reason>)` to stdout per matched entry. Keep the summary line byte-identical when 0 are exempt; append `, N exempt` only when N is above 0. Because a rename's `A` is a normal addition, the count in the summary line should count only non-exempt adds, decide and test it explicitly.

**Error exits** (lines 120 to 125 pattern): malformed or unreadable-but-present exemptions JSON returns 2 inside the same try/catch with the `check-migrations-append-only: <message>` prefix. Missing file means empty list (deleting the file is the removal step).

---

### `scripts/check-migrations-append-only.test.mjs` (test, temp-repo)

**Analog:** itself.

**Fixture helpers** (lines 74 to 112): `write`, `commitAll`, `repoWith(change)` (two applied migrations on `main`, change committed on `feature`), `check(repo, ...args)`. `git(repo, ...args)` here is variadic, unlike the hygiene test's array form.

**Case pattern for the new exemption cases** (modelled on the rename and edit cases, lines 155 to 181):
```js
it('fails on a rename, which is a delete plus an add', () => {
  const { repo, base } = repoWith((dir) => {
    git(dir, 'mv', SECOND, 'supabase/migrations/20260102000000_renamed.sql');
  });
  const run = check(repo, '--base', base);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /^D supabase\/migrations\/20260102000000_b\.sql: /m);
  assert.doesNotMatch(run.stderr, /^A /m);
});
```
Exemption cases need blob SHAs that only exist after the commit. Compute them inside the test: base blob via `git(repo, 'rev-parse', `${base}:${SECOND}`)`, head blob via `git(repo, 'rev-parse', `HEAD:${renamed}`)`, then `write()` a temp exemptions JSON under `scratch` and pass `check(repo, '--base', base, '--exemptions', file)`. Cases (RESEARCH Pattern 2): exempt edit passes (exit 0, stdout contains `exempt:`); wrong `toBlob` fails (1); base blob not `fromBlob` (self-expiry) fails; exempted edit plus an unrelated edit fails and names only the unrelated path; exempted rename passes, rename to a different target fails; absent file is strict (existing cases keep passing with no flag); malformed JSON exits 2.

**Do not break** the existing assertion `/^migrations: 1 added, nothing else changed$/m` (line 121).

**Sweep edits:** line 29 `hearth-migrations-`, line 46 `HEARTH_TEST_NOW`, line 57 `hearth-test` become hestia (the exemptions JSON is the only file needing the old name, and it is allowlisted).

---

### `scripts/migration-exemptions.json` (NEW, data)

**No analog.** Use the shape in RESEARCH Pattern 2 verbatim: an array of `{ fromPath, toPath, fromBlob, toBlob, reason }`. Two entries: `20260919060000_hearth_service_role.sql` to `..._hestia_service_role.sql` (fromBlob `d331585a3c92a71a42bc16c7755f5ae187be4ef0`) and `20260919070000_schema.sql` to itself (fromBlob `8f5c5cdc1249203c9410c5f86f148b77c044452b`). Fill `toBlob` last with `git rev-parse HEAD:<toPath>` after the final migration content is committed; any later edit to those files invalidates it. Re-verify the fromBlobs with `git rev-parse` at execution time (HEAD may have moved). Allowlist it in the hygiene guard (its `fromPath` keeps the old word) and plan its deletion in a later cleanup.

---

### `apps/web/scripts/check-build.mjs` (build check, file-I/O)

**Analog:** itself. Add the assertion after `html` is read (line 56) and before the failure summary (line 95).

**Reuse** (lines 39 to 43, 52 to 56):
```js
const failures = [];
function fail(message) { failures.push(message); }
const textFiles = walk(DIST).filter((path) => /\.(js|css|html|webmanifest)$/.test(path));
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
```
`.webmanifest` is already in the walked set, so the manifest is in `contents`. Add:
```js
const manifestPath = join(DIST, 'manifest.webmanifest');   // confirm filename with `ls apps/web/dist` (RESEARCH A8)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.name !== 'Hestia') fail(`manifest name is ${JSON.stringify(manifest.name)}, expected "Hestia"`);
if (manifest.short_name !== 'Hestia') fail(`manifest short_name is ${JSON.stringify(manifest.short_name)}, expected "Hestia"`);
if (!/<title>Hestia<\/title>/.test(html)) fail('index.html <title> is not Hestia');
```
Use the file's `fail()` accumulator, not `process.exit`, so all failures print together via the existing block (lines 96 to 100). Update the header comment (lines 1 to 9) with check 3. Style note: bracket access `process.env['X']` is used because of `noPropertyAccessFromIndexSignature`; `manifest.name` on parsed JSON in `.mjs` is not type-checked, so dot access is fine.

---

### `apps/service/src/env.test.ts` (test, transform)

**Analog:** itself. Imports and fixture (lines 1 to 13):
```ts
import { describe, expect, it } from 'vitest';
import { parseCliEnv, parseEnv, vapidSubjectFor } from './env.js';
const REQUIRED = { DATABASE_URL: '...', HEARTH_ORIGIN: 'https://hearth.tail1234.ts.net/', GOTRUE_URL: '...', JWT_SECRET: 'x'.repeat(40), ... };
```
After the sweep `REQUIRED` carries `HESTIA_ORIGIN`. Existing pattern for honoured optional var (line 17):
```ts
const env = parseEnv({ ...REQUIRED, HEARTH_TRUSTED_PROXIES: '172.28.0.0/16, 127.0.0.1' });
```
Existing rejection pattern (lines 89, 107):
```ts
expect(() => parseEnv({ ...REQUIRED, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
expect(() => parseEnv({ ...REQUIRED, [key]: undefined })).toThrow(new RegExp(key));
```
Add two cases inside `describe('parseEnv')`:
1. Hard cutover (D-01): build an env from `REQUIRED` with `HESTIA_ORIGIN` removed and old names supplied, then `expect(() => parseEnv(old)).toThrow(/HESTIA_ORIGIN/)`. Old-name keys must be written so the guard does not trip: `env.test.ts` is NOT allowlisted, so build them dynamically, for example ``[`${['HEAR','TH'].join('')}_ORIGIN`]``, or add the file to the allowlist (cheaper but widens it; prefer the dynamic construction).
2. `HESTIA_TRUSTED_PROXIES` honoured: this is already what the renamed line-17 test asserts after the sweep, so a distinct case is only needed to show old-name `*_TRUSTED_PROXIES` is ignored (parsed result `[]`) while the required names are present.
Test-clock fence: no `new Date()` or `Date.now()` here (none are needed).

---

### `.planning/phases/08-full-rebrand-to-hestia/08-OWNER-CHECKLIST.md` (NEW)

**No code analog.** Content is specified in RESEARCH "Owner checklist" (before merge: `/srv/hestia/.env`, runner label `hestia`; at merge: stop old stack, re-run Deploy; after: repo rename, runner reconfigure, cleanup). It lives in `.planning/`, not `docs/` (CLAUDE.md: no review or decision files in `docs/`), and `.planning/` is allowlisted so it may name the old Compose project and paths. Also add the PR-body notes (browser-key cold cache and dropped queued offline writes per D-08; outbound User-Agent `Hearth/1.0` to `Hestia/1.0`; installed PWA name may lag on iOS).

## Shared Patterns

### Git access from gate scripts
**Source:** `scripts/check-repo-hygiene.mjs` lines 52 to 68 and `scripts/check-migrations-append-only.mjs` lines 58 to 65
**Apply to:** both gate edits. Always `spawnSync('git', ['-C', repo, ...args])` from an argument array, never a shell; fail-closed with exit 2 on any inability to decide; exit 1 only for real findings. Both scripts use `console.error` for findings and `console.log` for the one-line summary (these are tooling scripts, so `console` is permitted).

### Node test harness for gates
**Source:** both `.test.mjs` files
**Apply to:** all new gate tests. Temp repo under `mkdtempSync(join(tmpdir(), ...))` removed in `after()`, `childEnvironment()` strips `TZ`, `HEARTH_TEST_NOW`, `GIT_*` and sets `GIT_CONFIG_GLOBAL=/dev/null`, child run via `spawnSync(process.execPath, [SCRIPT, '--repo', repo, ...])`. Both files are already in root `package.json` `test:harness`; no new wiring. Quick run: `node --test scripts/check-repo-hygiene.test.mjs scripts/check-migrations-append-only.test.mjs`.

### Gate ordering trap
Add the legacy-name guard and the exemption JSON last in the commit sequence, after the sweep reaches zero hits, otherwise intermediate commits fail the `hygiene` job. Fill `toBlob` after the final migration content is committed. Commit scopes allowed by commitlint: `web, service, shared, recurrence, matching, db, e2e, docker` or none; use `chore:`, `build:`, `refactor:`, `test:`, `docs:` types, subject at most 71 characters.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/migration-exemptions.json` | config data | file-I/O | No JSON data file read by a `scripts/` gate exists; follow RESEARCH Pattern 2 |
| `08-OWNER-CHECKLIST.md` | planning artifact | none | Prose, follow RESEARCH Owner checklist |

## Metadata

**Analog search scope:** `scripts/`, `apps/web/scripts/`, `apps/service/src/env.test.ts`, `.planning/environment/`, `.planning/phases/07*`
**Files read:** 7 (both gate scripts and tests, `check-build.mjs`, `env.test.ts` head, CONTEXT and RESEARCH)
**Pattern extraction date:** 2026-10-25
