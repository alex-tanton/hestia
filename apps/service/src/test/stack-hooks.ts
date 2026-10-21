import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, expect } from 'vitest';
import { startStack, type Stack } from './service-stack.js';

/**
 * The per-file stack lifecycle every `*.integration.test.ts` shares: one `supabase start` stack per
 * file, a fresh app per test, and the stack closed at the end.
 *
 * `stack` and `app` are live bindings, so a test file imports them and reads them at call time;
 * its call sites stay `as(app, …)`. Call `registerStackHooks()` once, at the top level of the file,
 * where the file's own hooks would go. A file that builds its apps differently (injected
 * dependencies, several apps per test) keeps its own hooks and imports only `expectStatus`.
 */
export let stack: Stack;
export let app: FastifyInstance;

export function registerStackHooks(): void {
  beforeAll(async () => {
    stack = await startStack();
  });

  beforeEach(async () => {
    // A fresh app per test, so the in-memory per-IP rate limits never carry over.
    app = await stack.newApp();
  });

  afterAll(async () => {
    await stack.close();
  });
}

export function expectStatus(response: LightMyRequestResponse, status: number): void {
  expect(response.statusCode, response.body).toBe(status);
}
