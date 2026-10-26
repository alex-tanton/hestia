import { describe, expect, it, vi, type Mock } from 'vitest';
import { FALLBACK_NOTIFICATION, NOTIFICATION_ICON } from './push-message.ts';
import {
  handleNotificationClick,
  handlePush,
  openTarget,
  type WindowClientLike,
  type WorkerScopeLike,
} from './service-worker-handlers.ts';

const HOUSEHOLD = '22222222-2222-4222-8222-222222222222';

interface FakeWindow extends WindowClientLike {
  focus: Mock;
  postMessage: Mock;
}

function fakeWindow({
  focused = false,
  visibilityState = 'hidden',
}: { focused?: boolean; visibilityState?: string } = {}): FakeWindow {
  return {
    focused,
    visibilityState,
    focus: vi.fn(() => Promise.resolve()),
    postMessage: vi.fn(),
  };
}

/** A worker scope whose clients API records what it was asked to do. */
function fakeScope(windows: WindowClientLike[] = []) {
  const shown: { title: string; options: { body: string; icon: string; data: unknown } }[] = [];
  const opened: string[] = [];
  const matchAll = vi.fn(() => Promise.resolve(windows));
  const scope: WorkerScopeLike = {
    registration: {
      showNotification: (title, options) => {
        shown.push({ title, options });
        return Promise.resolve();
      },
    },
    clients: {
      matchAll,
      openWindow: (url) => {
        opened.push(url);
        return Promise.resolve(undefined);
      },
    },
  };
  return { scope, shown, opened, matchAll };
}

/** Runs a handler's `waitUntil` promises to completion, as the worker does before it sleeps. */
function pushEvent(text: string | null) {
  const pending: Promise<unknown>[] = [];
  return {
    event: {
      data: text === null ? null : { text: () => text },
      waitUntil: (promise: Promise<unknown>) => {
        pending.push(promise);
      },
    },
    settled: () => Promise.all(pending),
  };
}

function clickEvent(data: unknown) {
  const close = vi.fn();
  return { event: { notification: { close, data } }, close };
}

describe('push', () => {
  it('shows the payload title and body, with the icon and the deep link and household', async () => {
    const { scope, shown } = fakeScope();
    const push = pushEvent(
      JSON.stringify({
        title: 'Rent is due',
        body: 'Due on the 1st.',
        url: '/bills',
        householdId: HOUSEHOLD,
      }),
    );

    handlePush(scope, push.event);
    await push.settled();

    expect(shown).toStrictEqual([
      {
        title: 'Rent is due',
        options: {
          body: 'Due on the 1st.',
          icon: NOTIFICATION_ICON,
          data: { url: '/bills', householdId: HOUSEHOLD },
        },
      },
    ]);
  });

  it('still shows a notification when the body cannot be read, naming nothing private', async () => {
    const { scope, shown } = fakeScope();
    const push = pushEvent('not json');

    handlePush(scope, push.event);
    await push.settled();

    expect(shown[0]?.title).toBe(FALLBACK_NOTIFICATION.title);
    expect(shown[0]?.options.body).toBe(FALLBACK_NOTIFICATION.body);
    expect(shown[0]?.options.data).toStrictEqual({ url: '/', householdId: undefined });
  });

  it('shows the fallback when a push carries no data at all', async () => {
    const { scope, shown } = fakeScope();
    const push = pushEvent(null);

    handlePush(scope, push.event);
    await push.settled();

    expect(shown[0]?.title).toBe('Hestia');
  });

  it('never deep-links off the site', async () => {
    const { scope, shown } = fakeScope();
    const push = pushEvent(
      JSON.stringify({ title: 'Hi', body: 'There', url: 'https://evil.example/' }),
    );

    handlePush(scope, push.event);
    await push.settled();

    expect(shown[0]?.options.data).toStrictEqual({ url: '/', householdId: undefined });
  });
});

describe('notificationclick', () => {
  it('focuses the open window and posts the household and route to it', async () => {
    const window = fakeWindow({ focused: true });
    const { scope, opened } = fakeScope([window]);
    const click = clickEvent({ url: '/chores', householdId: HOUSEHOLD });

    await handleNotificationClick(scope, click.event);

    expect(click.close).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
    expect(window.postMessage).toHaveBeenCalledWith({
      type: 'hestia:notification-click',
      url: '/chores',
      householdId: HOUSEHOLD,
    });
    expect(opened).toStrictEqual([]);
  });

  it('prefers a focused window, then a visible one', async () => {
    const hidden = fakeWindow();
    const visible = fakeWindow({ visibilityState: 'visible' });
    const focused = fakeWindow({ focused: true });

    const first = fakeScope([hidden, visible]);
    await handleNotificationClick(
      first.scope,
      clickEvent({ url: '/', householdId: HOUSEHOLD }).event,
    );
    expect(visible.postMessage).toHaveBeenCalledOnce();
    expect(hidden.postMessage).not.toHaveBeenCalled();

    const second = fakeScope([hidden, visible, focused]);
    await handleNotificationClick(
      second.scope,
      clickEvent({ url: '/', householdId: HOUSEHOLD }).event,
    );
    expect(focused.postMessage).toHaveBeenCalledOnce();
  });

  it('opens the app with the household in the URL when no window is open', async () => {
    const { scope, opened } = fakeScope([]);

    await handleNotificationClick(
      scope,
      clickEvent({ url: '/lists/flyers', householdId: HOUSEHOLD }).event,
    );

    expect(opened).toStrictEqual([`/lists/flyers?household=${HOUSEHOLD}`]);
  });

  it('opens the bare deep link when the notification names no household', async () => {
    const { scope, opened } = fakeScope([]);

    await handleNotificationClick(scope, clickEvent({ url: '/bills' }).event);

    expect(opened).toStrictEqual(['/bills']);
  });

  it('opens the dashboard for a notification whose data is missing', async () => {
    const { scope, opened } = fakeScope([]);

    await handleNotificationClick(scope, clickEvent(undefined).event);

    expect(opened).toStrictEqual(['/']);
  });
});

describe('openTarget', () => {
  it('adds the household to a URL that already has a query', () => {
    expect(openTarget('/bills?view=all', HOUSEHOLD)).toBe(`/bills?view=all&household=${HOUSEHOLD}`);
  });
});
