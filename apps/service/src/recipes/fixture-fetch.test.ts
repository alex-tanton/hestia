import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recipeFixtureFetch } from './fixture-fetch.js';

/**
 * `recipeFixtureFetch` is what stands in for `fetchRecipePage` in the E2E stack (see the file's
 * own comment), so it needs its own unit coverage independent of the real fixture files it reads
 * in that stack: a temp directory keeps this test from depending on `e2e/fixtures/recipes/`
 * existing or having any particular content.
 */
describe('recipeFixtureFetch', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hearth-recipe-fixtures-'));
    writeFileSync(join(dir, 'a.html'), '<html>fixture a</html>', 'utf8');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('serves the mapped file for a known path', async () => {
    const fetchPage = recipeFixtureFetch({ dir, pages: { '/recipes/a': 'a.html' } });
    const page = await fetchPage('https://fixtures.hearth-e2e.test/recipes/a');
    expect(page.body).toBe('<html>fixture a</html>');
  });

  it('rejects a path with no mapped fixture, rather than guessing at one', async () => {
    const fetchPage = recipeFixtureFetch({ dir, pages: { '/recipes/a': 'a.html' } });
    await expect(fetchPage('https://fixtures.hearth-e2e.test/recipes/unknown')).rejects.toThrow(
      'No recipe fixture for https://fixtures.hearth-e2e.test/recipes/unknown',
    );
  });

  it('works whether or not the configured directory has a trailing slash', async () => {
    const withSlash = recipeFixtureFetch({ dir: `${dir}/`, pages: { '/recipes/a': 'a.html' } });
    const page = await withSlash('https://fixtures.hearth-e2e.test/recipes/a');
    expect(page.body).toBe('<html>fixture a</html>');
  });
});
