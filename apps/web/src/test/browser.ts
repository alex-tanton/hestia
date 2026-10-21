import { onlineManager } from '@tanstack/react-query';
import { act } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/*
 * The browser state a component test controls: whether the device is online, and whether the
 * pointer is coarse. Registering helpers (`register…`) are called at the top level of a test file,
 * exactly where the file's own `beforeEach`/`afterEach` pair would sit, so hook order is the
 * file's own.
 */

/** Takes the browser online or offline, in the browser's eyes and in TanStack Query's. */
export function setOnline(isOnline: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(isOnline);
  act(() => {
    onlineManager.setOnline(isOnline);
    window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'));
  });
}

/** Makes `(pointer: coarse)` match, as on a phone; every other media query does not match. */
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
