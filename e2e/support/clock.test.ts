import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, currentInstant, dateInZone, hourInZone } from './clock.ts';

// node:test returns a promise from each call; the runner collects them, so nothing is awaited here.
void describe('dateInZone', () => {
  void it('is the previous day in New York when UTC has already turned over (Saturday UTC, Friday)', () => {
    assert.equal(
      dateInZone('America/New_York', new Date('2026-10-17T02:30:00.000Z')),
      '2026-10-16',
    );
  });

  void it('is the next day in a UTC+14 zone', () => {
    assert.equal(
      dateInZone('Pacific/Kiritimati', new Date('2026-10-18T22:30:00.000Z')),
      '2026-10-19',
    );
  });

  void it('stays in the old year across a UTC year boundary west of Greenwich', () => {
    assert.equal(
      dateInZone('America/Los_Angeles', new Date('2027-01-01T00:30:00.000Z')),
      '2026-12-31',
    );
  });
});

void describe('hourInZone', () => {
  void it('reads the local hour in New York', () => {
    assert.equal(hourInZone('America/New_York', new Date('2026-10-14T12:00:00.000Z')), 8);
  });

  void it('jumps from 1 to 3 across the spring-forward gap', () => {
    assert.equal(hourInZone('America/New_York', new Date('2026-03-08T07:30:00.000Z')), 3);
  });
});

void describe('addDays', () => {
  void it('rolls over a year boundary', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  });

  void it('moves across a DST change by calendar days', () => {
    assert.equal(addDays('2026-03-07', 1), '2026-03-08');
  });

  void it('moves backwards', () => {
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });
});

void describe('currentInstant', () => {
  void it('returns a Date with a finite time', () => {
    const now = currentInstant();
    assert.ok(now instanceof Date);
    assert.ok(Number.isFinite(now.getTime()));
  });
});
