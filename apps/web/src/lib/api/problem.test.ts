import { describe, expect, it } from 'vitest';
import { ApiError, OFFLINE_MESSAGE, isPlainDetail, userMessage } from './problem.ts';

function withDetail(status: number, detail: string): ApiError {
  return new ApiError(status, { type: 'about:blank', title: 'Error', status, detail });
}

describe('isPlainDetail', () => {
  it.each([
    'The current password is incorrect.',
    'Use at least 8 characters.',
    'Reassign everything the member owns before they leave.',
  ])('accepts the service’s own copy: %s', (detail) => {
    expect(isPlainDetail(detail)).toBe(true);
  });

  it.each([
    'duplicate key value violates unique constraint "household_name_key"',
    'invalid input for household {name: Oak Street}',
    'could not reach https://example.com/api',
    'no account for alex@example.com',
    '',
  ])('refuses anything that could be carrying content: %s', (detail) => {
    expect(isPlainDetail(detail)).toBe(false);
  });
});

describe('userMessage', () => {
  it('prefers the screen’s own copy for a status', () => {
    const error = withDetail(410, 'This invite has expired or was revoked.');
    expect(userMessage(error, { byStatus: { 410: 'Ask for a new link or code.' } })).toBe(
      'Ask for a new link or code.',
    );
  });

  it('shows a plain detail as written', () => {
    expect(userMessage(withDetail(403, 'The current password is incorrect.'))).toBe(
      'The current password is incorrect.',
    );
  });

  it('never shows a detail that quotes something', () => {
    const message = userMessage(
      withDetail(409, 'duplicate key value violates unique constraint "household_pkey"'),
    );
    expect(message).not.toContain('household_pkey');
    expect(message).toBe('That conflicts with something that has changed. Reload and try again.');
  });

  it('calls a failed request offline rather than broken', () => {
    expect(userMessage(new ApiError(0, undefined, true))).toBe(OFFLINE_MESSAGE);
  });

  it('falls back for anything that is not an API error', () => {
    expect(userMessage(new Error('boom'), { fallback: 'Could not save.' })).toBe('Could not save.');
  });
});
