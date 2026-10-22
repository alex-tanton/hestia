import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { endpoints, problemDetailsSchema, type Endpoint } from '@hearth/shared';

/**
 * The OpenAPI 3.1 document, generated from the shared Zod schemas. `pnpm build` writes it to
 * dist/openapi.json; the running service serves that file, and falls back to generating it when run
 * from source.
 */

type JsonSchema = Record<string, unknown>;

function jsonSchema(schema: z.ZodType, io: 'input' | 'output'): JsonSchema {
  const result: JsonSchema = { ...z.toJSONSchema(schema, { io, unrepresentable: 'any' }) };
  // Each schema is embedded in the document, which names the dialect once.
  delete result['$schema'];
  return result;
}

function openApiPath(path: string): string {
  return path.replace(/:([A-Za-z]\w*)/g, '{$1}');
}

const PROBLEM_RESPONSE = {
  description: 'Problem details (RFC 9457)',
  content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } },
};

function operation(endpoint: Endpoint): Record<string, unknown> {
  const parameters =
    endpoint.params === undefined
      ? []
      : Object.entries(
          (jsonSchema(endpoint.params, 'input')['properties'] ?? {}) as Record<string, JsonSchema>,
        ).map(([name, schema]) => ({ name, in: 'path', required: true, schema }));

  const success =
    endpoint.response.schema === undefined
      ? { description: 'No content' }
      : {
          description: 'Success',
          content: {
            'application/json': { schema: jsonSchema(endpoint.response.schema, 'output') },
          },
        };

  return {
    summary: endpoint.summary,
    ...(endpoint.access === 'public' ? { security: [] } : {}),
    ...(parameters.length === 0 ? {} : { parameters }),
    ...(endpoint.body === undefined
      ? {}
      : {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: jsonSchema(endpoint.body, 'input') } },
          },
        }),
    responses: { [String(endpoint.response.status)]: success, default: PROBLEM_RESPONSE },
  };
}

export function buildOpenApiDocument(list: readonly Endpoint[] = endpoints): JsonSchema {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of list) {
    const path = openApiPath(endpoint.path);
    paths[path] ??= {};
    paths[path][endpoint.method.toLowerCase()] = operation(endpoint);
  }
  return {
    openapi: '3.1.0',
    info: { title: 'Hearth API', version: '1' },
    security: [{ bearer: [] }],
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: { Problem: jsonSchema(problemDetailsSchema, 'output') },
    },
    paths,
  };
}

/** The document written at build time, or a freshly generated one when running from source. */
export function loadOpenApiDocument(): JsonSchema {
  try {
    return JSON.parse(
      readFileSync(new URL('./openapi.json', import.meta.url), 'utf8'),
    ) as JsonSchema;
  } catch {
    return buildOpenApiDocument();
  }
}
