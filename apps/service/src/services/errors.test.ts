import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildErrorRecord, errorFingerprint } from './errors.js';

describe('errorFingerprint', () => {
  it('is SHA-256 hex of source, name, and route joined by newlines', () => {
    expect(errorFingerprint('web', 'TypeError', '/lists/:id')).toBe(
      createHash('sha256').update('web\nTypeError\n/lists/:id').digest('hex'),
    );
    expect(errorFingerprint('service', 'TypeError', '/lists/:id')).not.toBe(
      errorFingerprint('web', 'TypeError', '/lists/:id'),
    );
  });
});

describe('buildErrorRecord', () => {
  it('scrubs every field and fingerprints the scrubbed name and route', () => {
    const record = buildErrorRecord('web', {
      name: 'TypeError',
      message: 'Cannot add "Oat milk" ($4.99) for alex@example.com',
      route: '/lists/3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b?q=milk',
    });
    expect(record.message).toBe(
      'TypeError at /lists/3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b: Cannot add [text] ([amount]) for [email]',
    );
    expect(record.fingerprint).toBe(
      errorFingerprint('web', 'TypeError', '/lists/3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b'),
    );
  });

  it('falls back for missing fields and caps the message', () => {
    const record = buildErrorRecord('service', { message: 'x '.repeat(1000) });
    expect(record.message.startsWith('Error at unknown: ')).toBe(true);
    expect(record.message.length).toBeLessThanOrEqual(500);
  });
});
