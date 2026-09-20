import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFetchStub, renderScreen, type StubHandler } from '../../test/harness.tsx';
import { deepHealthFixture, profileFixture } from '../../test/fixtures.ts';
import { SystemHealthScreen } from './SystemHealthScreen.tsx';

function render(
  isServerOwner: boolean,
  extra: Readonly<Record<string, StubHandler>> = {},
): {
  calls: { method: string; path: string }[];
} {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: { ...profileFixture, isServerOwner } }),
    'GET /api/health/deep': () => ({ status: 200, body: deepHealthFixture }),
    ...extra,
  });
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(<SystemHealthScreen />);
  return stub;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('System health', () => {
  it('shows job freshness, errors, and skip rates to the server owner', async () => {
    render(true);

    expect(await screen.findByText('Last deal refresh')).toBeInTheDocument();
    expect(screen.getByText('Last notification sent')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
    expect(screen.getByText('Newest backup')).toBeInTheDocument();
    expect(screen.getByText('TypeError at /api/households/:param')).toBeInTheDocument();
    expect(screen.getByText('No refresh has run since the service started.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('never asks for system health when the caller is not the owner', async () => {
    const stub = render(false);

    await waitFor(() => {
      expect(stub.calls.some((call) => call.path === '/api/users/me')).toBe(true);
    });
    expect(stub.calls.some((call) => call.path === '/api/health/deep')).toBe(false);
    expect(screen.queryByText('Last deal refresh')).not.toBeInTheDocument();
  });
});
