import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../lib/api/keys.ts';
import {
  createFetchStub,
  problemBody,
  renderScreen,
  testQueryClient,
  type StubHandler,
} from '../../test/harness.tsx';
import { createPushDouble, type PushDoubleOptions } from '../../test/push-double.ts';
import { OAK_STREET_ID, RIVERA_FAMILY_ID, profileFixture } from '../../test/fixtures.ts';
import { IOS_INSTALL_MESSAGE } from '../onboarding/InstallStep.tsx';
import { NotificationTypes } from './NotificationTypes.tsx';
import {
  BROWSER_SETTINGS_HELP_LABEL,
  BROWSER_SETTINGS_HELP_URL,
  DEVICE_MESSAGES,
  NOTIFICATION_TYPES_EMPTY,
  NOTIFICATION_TYPES_LOADING,
  NOTIFICATION_TYPES_LOAD_ERROR,
  NOTIFICATION_TYPES_OFFLINE,
  SAVE_ERROR_MESSAGE,
  SAVED_MESSAGE,
  SAVING_MESSAGE,
  UNSUPPORTED_MESSAGE,
  WRITE_NEEDS_CONNECTION,
} from './notification-copy.ts';

/*
 * Settings › Notifications, per type. Each state runs in both themes. The colors are checked by axe
 * in the E2E suite, which renders the real stylesheet; here the theme is set so the same states are
 * exercised under each.
 */

type Theme = 'light' | 'dark';
const THEMES: Theme[] = ['light', 'dark'];

const PREFERENCES = {
  preferences: [
    { type: 'bill_due', householdId: null, enabled: true },
    { type: 'chore_due', householdId: null, enabled: false },
    { type: 'chore_rotation', householdId: null, enabled: true },
    { type: 'list_activity', householdId: null, enabled: true },
    { type: 'meal_reminder', householdId: null, enabled: false },
    { type: 'weekly_meal_nudge', householdId: OAK_STREET_ID, enabled: false },
    { type: 'weekly_meal_nudge', householdId: RIVERA_FAMILY_ID, enabled: true },
    { type: 'flyer_refresh', householdId: null, enabled: false },
  ],
};

/**
 * The handlers every test starts from. Writes echo what was asked, the way the service stores it,
 * and every request lands in `log` so ordering across the network and the push port can be read.
 */
function handlers(
  log: string[],
  extra: Readonly<Record<string, StubHandler>> = {},
): Record<string, StubHandler> {
  return {
    'GET /api/users/me/notification-preferences': () => ({ status: 200, body: PREFERENCES }),
    'PATCH /api/users/me/notification-preferences': ({ body }) => {
      log.push('PATCH');
      const sent = body as { type: string; enabled: boolean; householdId?: string };
      return {
        status: 200,
        body: { type: sent.type, enabled: sent.enabled, householdId: sent.householdId ?? null },
      };
    },
    'POST /api/users/me/push-subscriptions': () => {
      log.push('POST');
      return { status: 204 };
    },
    ...extra,
  };
}

function renderTypes({
  extra = {},
  push = {},
  queryClient = testQueryClient(),
}: {
  extra?: Readonly<Record<string, StubHandler>>;
  push?: PushDoubleOptions;
  queryClient?: ReturnType<typeof testQueryClient>;
} = {}) {
  const log: string[] = [];
  const stub = createFetchStub(handlers(log, extra));
  vi.stubGlobal('fetch', stub.fetch);
  const pushPort = createPushDouble({ log, ...push });
  const rendered = renderScreen(<NotificationTypes profile={profileFixture} />, {
    pushPort,
    queryClient,
  });
  return { stub, log, pushPort, unmount: rendered.unmount };
}

function setTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete document.documentElement.dataset['theme'];
});

describe.each(THEMES)('Notification types in the %s theme', (theme) => {
  beforeEach(() => {
    setTheme(theme);
  });

  describe('states', () => {
    it('shows skeleton rows while the preferences load', () => {
      renderTypes({
        extra: { 'GET /api/users/me/notification-preferences': () => new Promise(() => undefined) },
      });
      expect(screen.getByText(NOTIFICATION_TYPES_LOADING)).toBeInTheDocument();
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    it('lists every type with its effective value, and the weekly nudge once per household', async () => {
      renderTypes();

      expect(await screen.findByRole('switch', { name: 'Bill reminders' })).toBeChecked();
      expect(screen.getByRole('switch', { name: 'Chore reminders' })).not.toBeChecked();
      expect(screen.getByRole('switch', { name: 'New weekly ads' })).not.toBeChecked();
      expect(screen.getByRole('switch', { name: 'Plan next week: Oak Street' })).not.toBeChecked();
      expect(screen.getByRole('switch', { name: 'Plan next week: Rivera Family' })).toBeChecked();
      expect(screen.getAllByRole('switch')).toHaveLength(8);
    });

    it('gives each toggle its description, linked to it', async () => {
      renderTypes();
      expect(
        await screen.findByRole('switch', { name: 'Bill reminders' }),
      ).toHaveAccessibleDescription(
        'Before a bill is due, and on its due date while it is unpaid.',
      );
    });

    it('says so when there is nothing to turn on', async () => {
      renderTypes({
        extra: {
          'GET /api/users/me/notification-preferences': () => ({
            status: 200,
            body: { preferences: [] },
          }),
        },
      });
      expect(await screen.findByText(NOTIFICATION_TYPES_EMPTY)).toBeInTheDocument();
    });

    it('offers a retry when the preferences fail, and retries', async () => {
      const user = userEvent.setup();
      let attempts = 0;
      const { stub } = renderTypes({
        extra: {
          'GET /api/users/me/notification-preferences': () => {
            attempts += 1;
            return attempts === 1
              ? { status: 500, body: problemBody(500, 'Server Error') }
              : { status: 200, body: PREFERENCES };
          },
        },
      });

      expect(await screen.findByText(NOTIFICATION_TYPES_LOAD_ERROR)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Try again' }));

      expect(await screen.findByRole('switch', { name: 'Bill reminders' })).toBeInTheDocument();
      expect(stub.calls.filter((call) => call.method === 'GET')).toHaveLength(2);
    });

    it('says it needs a connection when the preferences cannot be read and nothing is cached', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
      );
      renderScreen(<NotificationTypes profile={profileFixture} />, {
        pushPort: createPushDouble(),
      });
      expect(await screen.findByText(NOTIFICATION_TYPES_OFFLINE)).toBeInTheDocument();
    });

    it('shows cached values offline, with every toggle disabled and the reason beside each', async () => {
      const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      const queryClient = testQueryClient();
      queryClient.setQueryData(queryKeys.notificationPreferences, PREFERENCES);
      renderTypes({ queryClient });

      const toggle = await screen.findByRole('switch', { name: 'Bill reminders' });
      expect(toggle).toBeDisabled();
      expect(toggle).toBeChecked();
      expect(toggle).toHaveAccessibleDescription(
        `Before a bill is due, and on its due date while it is unpaid. ${WRITE_NEEDS_CONNECTION}`,
      );
      expect(screen.getAllByText(WRITE_NEEDS_CONNECTION)).toHaveLength(8);
      onLine.mockRestore();
    });

    it('says unsupported browsers cannot take push, and hides the toggles', () => {
      renderTypes({ push: { support: 'unsupported' } });
      expect(screen.getByText(UNSUPPORTED_MESSAGE)).toBeInTheDocument();
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    it('shows the install sequence on iOS before the app is on the home screen', () => {
      renderTypes({ push: { support: 'ios-not-installed' } });
      expect(screen.getByText(IOS_INSTALL_MESSAGE)).toBeInTheDocument();
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });
  });

  describe('saving', () => {
    it('reports saving while the write is in flight, then the result', async () => {
      const user = userEvent.setup();
      let release: (() => void) | undefined;
      renderTypes({
        extra: {
          'PATCH /api/users/me/notification-preferences': ({ body }) =>
            new Promise((resolve) => {
              release = () => {
                const sent = body as { type: string; enabled: boolean };
                resolve({ status: 200, body: { ...sent, householdId: null } });
              };
            }),
        },
      });

      await user.click(await screen.findByRole('switch', { name: 'Chore reminders' }));
      expect(screen.getByRole('status')).toHaveTextContent(SAVING_MESSAGE);

      release?.();
      expect(await screen.findByText(SAVED_MESSAGE)).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Chore reminders' })).toBeChecked();
    });

    it('keeps the toggle where the server left it when the save fails', async () => {
      const user = userEvent.setup();
      renderTypes({
        extra: {
          'PATCH /api/users/me/notification-preferences': () => ({
            status: 500,
            body: problemBody(500, 'Server Error'),
          }),
        },
      });

      await user.click(await screen.findByRole('switch', { name: 'Chore reminders' }));

      expect(await screen.findByText(SAVE_ERROR_MESSAGE)).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Chore reminders' })).not.toBeChecked();
    });

    it('sends the household only for the weekly nudge', async () => {
      const user = userEvent.setup();
      const { stub } = renderTypes();

      await user.click(await screen.findByRole('switch', { name: 'Plan next week: Oak Street' }));
      await waitFor(() => {
        expect(screen.getByRole('switch', { name: 'Plan next week: Oak Street' })).toBeChecked();
      });
      await user.click(screen.getByRole('switch', { name: 'Chore reminders' }));

      const patches = stub.calls.filter((call) => call.method === 'PATCH');
      expect(patches.map((call) => call.body)).toStrictEqual([
        { type: 'weekly_meal_nudge', enabled: true, householdId: OAK_STREET_ID },
        { type: 'chore_due', enabled: true },
      ]);
    });
  });

  describe('push permission', () => {
    it('does not prompt on load, before any type is turned on', async () => {
      const { log } = renderTypes({ push: { permission: 'default' } });
      await screen.findByRole('switch', { name: 'Bill reminders' });
      expect(log).toStrictEqual([]);
    });

    it('asks for permission only after the first type is saved on, then registers the device', async () => {
      const user = userEvent.setup();
      const { log } = renderTypes({ push: { permission: 'default', answer: 'granted' } });

      await user.click(await screen.findByRole('switch', { name: 'Chore reminders' }));

      await waitFor(() => {
        expect(log).toContain('POST');
      });
      expect(log).toStrictEqual([
        'PATCH',
        'requestPermission',
        `subscribe:test-vapid-public-key`,
        'POST',
      ]);
    });

    it('does not prompt when a type is turned off', async () => {
      const user = userEvent.setup();
      const { log } = renderTypes({ push: { permission: 'default' } });

      await user.click(await screen.findByRole('switch', { name: 'Bill reminders' }));
      expect(await screen.findByText(SAVED_MESSAGE)).toBeInTheDocument();

      expect(log).toStrictEqual(['PATCH']);
    });

    it('explains a refused browser, links to its settings, and does not prompt again', async () => {
      const user = userEvent.setup();
      const { log } = renderTypes({ push: { permission: 'denied' } });

      await user.click(await screen.findByRole('switch', { name: 'Chore reminders' }));

      expect(await screen.findByText(DEVICE_MESSAGES.denied)).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: `${BROWSER_SETTINGS_HELP_LABEL} (opens in a new tab)` }),
      ).toHaveAttribute('href', BROWSER_SETTINGS_HELP_URL);
      expect(log).toStrictEqual(['PATCH']);
    });

    it('explains a dismissed prompt without subscribing', async () => {
      const user = userEvent.setup();
      const { log } = renderTypes({ push: { permission: 'default', answer: 'default' } });

      await user.click(await screen.findByRole('switch', { name: 'Chore reminders' }));

      expect(await screen.findByText(DEVICE_MESSAGES.dismissed)).toBeInTheDocument();
      expect(log).not.toContain('POST');
    });

    it('asks again on the next type-on after a dismissed prompt', async () => {
      const user = userEvent.setup();
      const { log } = renderTypes({ push: { permission: 'default', answer: 'default' } });

      await user.click(await screen.findByRole('switch', { name: 'Chore reminders' }));
      await waitFor(() => {
        expect(log.filter((entry) => entry === 'requestPermission')).toHaveLength(1);
      });
      await user.click(screen.getByRole('switch', { name: 'Meal reminders' }));

      await waitFor(() => {
        expect(log.filter((entry) => entry === 'requestPermission')).toHaveLength(2);
      });
      expect(log).not.toContain('POST');
    });

    it('shows the denied explanation again when Settings is reopened', async () => {
      const first = renderTypes({ push: { permission: 'denied' } });
      expect(await screen.findByText(DEVICE_MESSAGES.denied)).toBeInTheDocument();
      first.unmount();

      renderTypes({ push: { permission: 'denied' } });

      expect(await screen.findByText(DEVICE_MESSAGES.denied)).toBeInTheDocument();
    });

    it('shows the dismissed explanation again when Settings is reopened', async () => {
      const first = renderTypes({ push: { permission: 'default' } });
      expect(await screen.findByText(DEVICE_MESSAGES.dismissed)).toBeInTheDocument();
      first.unmount();

      renderTypes({ push: { permission: 'default' } });

      expect(await screen.findByText(DEVICE_MESSAGES.dismissed)).toBeInTheDocument();
    });

    it('re-registers an already-allowed device on open, without prompting', async () => {
      const { log } = renderTypes({ push: { permission: 'granted' } });

      await waitFor(() => {
        expect(log).toContain('POST');
      });
      expect(log).not.toContain('requestPermission');
    });
  });
});

describe('Notification types keyboard and live region', () => {
  it('keeps the save result region mounted and empty until something happens', async () => {
    renderTypes();
    await screen.findByRole('switch', { name: 'Bill reminders' });

    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement();
    expect(window.getComputedStyle(region).display).not.toBe('none');
  });

  it('is operated by the keyboard', async () => {
    const user = userEvent.setup();
    renderTypes();

    const chore = await screen.findByRole('switch', { name: 'Chore reminders' });
    chore.focus();
    await user.keyboard(' ');

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Chore reminders' })).toBeChecked();
    });
  });
});
