import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NORMALIZED_FIXTURE_DIR } from './fixture-transport.js';
import { buildNormalizedFixtures, serializeFixture } from './normalized-fixtures.js';

/**
 * The committed normalized fixtures are the wrapper's output over the committed raw captures
 * (Technical Architecture, "Development"). If this fails, either the wrapper changed on purpose
 * — run `pnpm fixtures:normalize` and review the diff — or it changed by accident.
 */
describe('the normalized fixtures', () => {
  it('match what the wrapper produces from the raw captures', async () => {
    const { files } = await buildNormalizedFixtures();
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const committed = readFileSync(`${NORMALIZED_FIXTURE_DIR}${file.name}`, 'utf8');
      expect(serializeFixture(file.body), `${file.name} is out of date`).toBe(committed);
    }
  });
});
