import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Serves committed recipe-page fixtures in place of a real fetch, for the E2E stack only
 * (mirrors `../deals/flipp/fixture-transport.ts`'s Flipp equivalent). `fetchRecipePage`'s
 * private/loopback/link-local refusal exists precisely to stop a fetch from ever reaching an
 * address on the machine or the Compose network — and a same-network fixture server would be
 * exactly that, so it would be refused by design, not bypassable by choosing a "reachable" address.
 * The E2E journey that imports a recipe by URL therefore never calls `fetchRecipePage` at all when
 * `HESTIA_RECIPE_FIXTURE_DIR` is set: the whole fetch step is swapped for this in-process file
 * read, the same way `HESTIA_FLIPP_FIXTURE_DIR` swaps the Flipp transport.
 */

export const RECIPE_FIXTURE_DIR = fileURLToPath(
  new URL('../../../../../e2e/fixtures/recipes/', import.meta.url),
);

/** Maps a fixture page's URL path to the file under `dir` that answers it. */
export const FIXTURE_PAGES: Readonly<Record<string, string>> = {
  '/recipes/baked-cod-with-asparagus': 'full-json-ld-light.html',
  '/recipes/baked-cod-with-broccoli': 'full-json-ld-dark.html',
  '/recipes/no-recipe-markup': 'no-json-ld.html',
};

export interface RecipeFixtureFetchOptions {
  /**
   * Where the fixture pages live. Defaults to the checked-out repo's own copy; the E2E stack
   * instead points this at the read-only mount the Compose overlay gives the built image
   * (`HESTIA_RECIPE_FIXTURE_DIR`), since the image never has the source tree's `e2e/` directory
   * beside it (the same reason `fixture-transport.ts` takes a `dir` option).
   */
  dir?: string;
  pages?: Readonly<Record<string, string>>;
}

/**
 * The `fetchPage` function `parseRecipeUrl` expects: given a URL, resolve it to a page body.
 * A path this fixture set does not recognize rejects, which is never expected to happen in
 * practice — every journey pastes one of the three URLs above.
 */
export function recipeFixtureFetch(
  options: RecipeFixtureFetchOptions = {},
): (url: string) => Promise<{ body: string }> {
  const dir = options.dir ?? RECIPE_FIXTURE_DIR;
  const pages = options.pages ?? FIXTURE_PAGES;
  return (url: string) => {
    const path = new URL(url).pathname;
    const file = pages[path];
    if (file === undefined) {
      return Promise.reject(new Error(`No recipe fixture for ${url}`));
    }
    const base = dir.endsWith('/') ? dir : `${dir}/`;
    return Promise.resolve({ body: readFileSync(`${base}${file}`, 'utf8') });
  };
}
