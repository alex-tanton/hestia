import { screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  type StubHandler,
} from '../../test/harness.tsx';
import { getMdButton } from '../../test/md-queries.ts';
import { deepHealthFixture, profileFixture } from '../../test/fixtures.ts';
import { Component as SystemHealthRoute } from './SystemHealthRoute.tsx';
import { SystemHealthScreen } from './SystemHealthScreen.tsx';

function render(
  isServerOwner: boolean,
  extra: Readonly<Record<string, StubHandler>> = {},
  element: ReactElement = <SystemHealthScreen />,
): {
  calls: { method: string; path: string }[];
} {
  const stub = createFetchStub({
    'GET /api/users/me': () => ({ status: 200, body: { ...profileFixture, isServerOwner } }),
    'GET /api/health/deep': () => ({ status: 200, body: deepHealthFixture }),
    ...extra,
  });
  vi.stubGlobal('fetch', stub.fetch);
  renderScreen(element);
  return stub;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('System health', () => {
  it('shows service status, telemetry, job freshness, errors, and skip rates to the server owner', async () => {
    render(true);

    // Service status badges
    expect(await screen.findByText('API Gateway')).toBeInTheDocument();
    expect(screen.getByText('Push Notification Service')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL Database')).toBeInTheDocument();
    expect(screen.getByText('Offline Queue & Cache')).toBeInTheDocument();
    expect(screen.getAllByText(/online/i)).toHaveLength(3);
    expect(screen.getByText(/ready/i)).toBeInTheDocument();

    // Telemetry and build
    expect(screen.getByText('Service latency')).toBeInTheDocument();
    expect(screen.getByText('24 ms')).toBeInTheDocument();
    expect(screen.getByText('Software build hash')).toBeInTheDocument();

    // Freshness & errors
    expect(screen.getByText('Last deal refresh')).toBeInTheDocument();
    expect(screen.getByText('Last notification sent')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
    expect(screen.getByText('Newest backup')).toBeInTheDocument();
    expect(screen.getByText('TypeError at /api/households/:param')).toBeInTheDocument();
    expect(screen.getByText('No refresh has run since the service started.')).toBeInTheDocument();
    expect(getMdButton('Refresh')).toBeInTheDocument();
  });

  it('renders Diagnostics unavailable empty state when deep health fails', async () => {
    render(true, {
      'GET /api/health/deep': () => ({
        status: 500,
        body: problemBody(500, 'Health check failed'),
      }),
    });

    expect(await screen.findByText('Diagnostics unavailable')).toBeInTheDocument();
    expect(
      screen.getByText(
        'System health telemetry requires an active connection. Check your network and reload.',
      ),
    ).toBeInTheDocument();
    expect(getMdButton('Reload system health')).toBeInTheDocument();
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

describe('the lazy route module', () => {
  it('wires the settings/system-health route to the system health screen', async () => {
    render(true, {}, <SystemHealthRoute />);
    expect(await screen.findByText('Last deal refresh')).toBeInTheDocument();
  });
});
