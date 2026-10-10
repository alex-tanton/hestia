import { rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buildOpenApiDocument, loadOpenApiDocument } from './openapi.js';

/**
 * `loadOpenApiDocument` (Technical Architecture, "Conventions"): `pnpm build` writes
 * `dist/openapi.json` next to the compiled bundle, and the running service serves that file; from
 * source (as every test runs) there is no `src/openapi.json`, so only the fallback branch is ever
 * exercised incidentally. This drives both branches directly: a written file is read back
 * verbatim, and its absence falls back to generating the document fresh.
 */
describe('loadOpenApiDocument', () => {
  const fixturePath = fileURLToPath(new URL('./openapi.json', import.meta.url));

  afterEach(() => {
    rmSync(fixturePath, { force: true });
  });

  it('reads a written document back verbatim, rather than generating one', () => {
    const marker = { openapi: '3.1.0', info: { title: 'Fixture Marker', version: 'pinned' } };
    writeFileSync(fixturePath, JSON.stringify(marker));

    expect(loadOpenApiDocument()).toEqual(marker);
  });

  it('falls back to generating the document fresh when no file exists', () => {
    rmSync(fixturePath, { force: true });

    expect(loadOpenApiDocument()).toEqual(buildOpenApiDocument());
  });
});
