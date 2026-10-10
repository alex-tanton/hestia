import { describe, expect, it } from 'vitest';
import { emptyDb } from '../test/fake-app.js';
import { departurePreview, depart } from './membership.js';

/**
 * `departurePreview` and `depart` call a Postgres function and trust it to return exactly one row
 * (Technical Architecture, "Membership lifecycle functions"). No real caller ever sees a missing
 * row — `public.departure_preview`/`depart_household` always return one, which is why no
 * integration test can reach this guard either. `emptyDb()`'s `DummyDriver` answers every query
 * with zero rows, which is the one way to exercise "the database answered nothing" directly.
 */
describe('departurePreview', () => {
  it('throws when the database answers with no row at all', async () => {
    await expect(departurePreview(emptyDb(), 'household-id', 'user-id')).rejects.toThrow(
      'departure_preview returned nothing',
    );
  });
});

describe('depart', () => {
  it('throws when the database answers with no row at all', async () => {
    await expect(depart(emptyDb(), 'household-id', 'user-id', {}, undefined)).rejects.toThrow(
      'depart_household returned nothing',
    );
  });
});
