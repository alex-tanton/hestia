// Build step: writes the OpenAPI document next to the bundle (pnpm build).
import { writeFileSync } from 'node:fs';
import { buildOpenApiDocument } from './openapi.js';

const target = new URL('../dist/openapi.json', import.meta.url);
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
