import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import type { RecordingPushTransport } from './recording-transport.js';

/*
 * The E2E push seam (Engineering Practices › Testing, "E2E environment"). It is registered only when
 * HEARTH_PUSH_TRANSPORT is `test-double`, so no real deployment has these routes. It does two things
 * the suite cannot do through the product: run the dispatch job at a chosen instant, so a reminder
 * is due without waiting for the wall clock, and read back the pushes that run recorded. Both need
 * the service-role key, which only the suite's generated `.env` holds.
 */

export interface PushTestSeamOptions {
  serviceRoleKey: string;
  transport: RecordingPushTransport;
  /** Runs the dispatch job with `now` as its clock; false when another run holds the job's lock. */
  dispatch: (now: Date) => Promise<boolean>;
}

const dispatchBody = z.object({ now: z.iso.datetime({ offset: true }) });

/** A constant-time comparison, so the key cannot be read back one byte at a time. */
function authorized(header: string | undefined, key: string): boolean {
  const expected = Buffer.from(`Bearer ${key}`);
  const given = Buffer.from(header ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function pushTestSeam(options: PushTestSeamOptions): FastifyPluginCallback {
  return (app, _opts, done) => {
    // Callback style: sending the refusal ends the request, and no route in this plugin runs.
    app.addHook('onRequest', (request, reply, done) => {
      if (authorized(request.headers.authorization, options.serviceRoleKey)) {
        done();
        return;
      }
      void reply.code(401).send({ error: 'unauthorized' });
    });

    app.post('/api/test/push/dispatch', async (request, reply) => {
      const parsed = dispatchBody.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'expected a body of { "now": "<ISO-8601 instant>" }' });
      }
      return { ran: await options.dispatch(new Date(parsed.data.now)) };
    });

    app.get('/api/test/push/deliveries', () => ({ deliveries: options.transport.sent }));
    done();
  };
}
