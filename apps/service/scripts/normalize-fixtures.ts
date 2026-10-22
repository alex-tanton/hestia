import { mkdirSync, writeFileSync } from 'node:fs';
import {
  buildNormalizedFixtures,
  serializeFixture,
} from '../src/deals/flipp/normalized-fixtures.js';
import { NORMALIZED_FIXTURE_DIR } from '../src/deals/flipp/fixture-transport.js';

/**
 * Regenerates `e2e/fixtures/flipp/normalized/` from the committed raw captures
 * (`pnpm fixtures:normalize`). Run deliberately, never automatically: the point is that a
 * change upstream, or in the parsers, lands as a reviewable diff. It reads the raw fixtures from
 * disk and makes no network call.
 */
const { files, skipCounts } = await buildNormalizedFixtures();

mkdirSync(NORMALIZED_FIXTURE_DIR, { recursive: true });
for (const file of files) {
  writeFileSync(`${NORMALIZED_FIXTURE_DIR}${file.name}`, serializeFixture(file.body), 'utf8');
  const count = Array.isArray(file.body) ? file.body.length : 1;
  console.log(`${file.name}: ${String(count)}`);
}
console.log('skip counts:', JSON.stringify(skipCounts, null, 2));
