import { useSyncExternalStore } from 'react';

/**
 * The install prompt is offered after onboarding completes, never on first paint. Chromium fires `beforeinstallprompt` whenever it likes,
 * so the event is captured at load and held until onboarding asks for it.
 *
 * iOS has no such event: a PWA is installed from the Share sheet, and web push works only once
 * it is on the home screen. There, onboarding explains the sequence instead of prompting, and
 * notification permission is never requested here — that belongs to the notifications work.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallMethod = 'prompt' | 'ios-share' | 'none';

let deferred: BeforeInstallPromptEvent | undefined;
const listeners = new Set<() => void>();

function announce(): void {
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    announce();
  });
  window.addEventListener('appinstalled', () => {
    deferred = undefined;
    announce();
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as { standalone?: boolean }).standalone === true;
  if (iosStandalone) return true;
  // Without matchMedia the display mode is unknowable, so assume the browser, not the app.
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
}

/** iOS and iPadOS Safari, where installing is a Share-sheet action rather than a prompt. */
export function isIosBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac; a touch-capable "Mac" is an iPad.
  const isIpadOs = ua.includes('Macintosh') && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || isIpadOs;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function snapshot(): InstallMethod {
  if (isStandalone()) return 'none';
  if (deferred !== undefined) return 'prompt';
  return isIosBrowser() ? 'ios-share' : 'none';
}

export function useInstallMethod(): InstallMethod {
  return useSyncExternalStore(subscribe, snapshot, () => 'none' as const);
}

/** Shows the browser's own install prompt. Resolves once the user has answered it. */
export async function showInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (event === undefined) return 'unavailable';
  deferred = undefined;
  announce();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}
