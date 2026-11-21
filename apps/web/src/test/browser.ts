import { onlineManager } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { findMdButton, type TextMatcher } from './md-queries.ts';

/*
 * The browser state a component test controls: whether the device is online, and whether the
 * pointer is coarse. Registering helpers (`register…`) are called at the top level of a test file,
 * exactly where the file's own `beforeEach`/`afterEach` pair would sit, so hook order is the
 * file's own.
 */

/** Both halves of "offline": the banner reads `navigator`, the queue reads TanStack's manager. */
export function setOnline(isOnline: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(isOnline);
  act(() => {
    onlineManager.setOnline(isOnline);
    window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'));
  });
}

/**
 * Makes `(pointer: coarse)` match, as on a phone; every other media query does not match. The
 * phone layout is the primary design target: day tabs, not the desktop grid, and Select renders
 * the platform picker.
 */
export function stubCoarsePointer(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(pointer: coarse)',
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

/** Online with a coarse pointer before each test; online again and every stub undone after. */
export function registerBrowserStubs(): void {
  beforeEach(() => {
    setOnline(true);
    stubCoarsePointer();
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}

/**
 * Pins "today" to `instant`, for the tests that read the household's calendar against a device in
 * another zone; timers keep running for the screens. Online before each test; real timers back,
 * every stub undone after. The instant is always explicit, so no test reads the real clock.
 */
export function registerHouseholdClock(instant: Date): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(instant);
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}

/** Opens an overflow menu from the keyboard on its MdIconButton trigger host. */
export async function openMenu(user: UserEvent, triggerName: TextMatcher): Promise<void> {
  const trigger = await findMdButton(triggerName);
  const target = trigger.tagName.includes('-')
    ? await waitFor(() => {
        const button = trigger.shadowRoot?.querySelector('button');
        if (button === null || button === undefined) {
          throw new Error(`Expected shadow button inside <${trigger.localName}>`);
        }
        return button;
      })
    : trigger;
  target.focus();
  await user.keyboard('{Enter}');
}
