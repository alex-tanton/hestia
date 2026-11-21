import { forceElementInternalsPolyfill } from 'element-internals-polyfill';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Force ElementInternals + CustomStateSet registration before any @material/web element loads;
// jsdom 30 defines a partial attachInternals that lacks form/validity hooks needed by MD3.
forceElementInternalsPolyfill();

// element-internals-polyfill@3.0.2 checks `validityState[key] !== false`, treating omitted
// (`undefined`) flags from @material/web's RadioValidator as invalid without a message.
if (typeof ElementInternals !== 'undefined') {
  const descriptor = Object.getOwnPropertyDescriptor(ElementInternals.prototype, 'setValidity');
  const originalSetValidity: unknown = descriptor?.value;
  if (typeof originalSetValidity === 'function') {
    ElementInternals.prototype.setValidity = function setValidity(
      this: ElementInternals,
      flags: ValidityStateFlags = {},
      message?: string,
      anchor?: HTMLElement,
    ): void {
      const normalized: ValidityStateFlags = {};
      for (const [key, value] of Object.entries(flags)) {
        Reflect.set(normalized, key, Boolean(value));
      }
      Reflect.apply(originalSetValidity, this, [normalized, message, anchor]);
    };
  }
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  });
}

// The service worker registration is a build-time virtual module; component tests never
// register a worker, so it reports that no update is waiting.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}));

// jsdom lacks the layout, animation, observer, and <dialog> APIs needed by Radix and @material/web.
globalThis.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserverShim implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin = '0px';
    readonly scrollMargin = '0px';
    readonly thresholds: readonly number[] = [0];
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = (): IntersectionObserverEntry[] => [];
  };
}

if (typeof Element.prototype.animate !== 'function') {
  Reflect.set(Element.prototype, 'animate', (): unknown => {
    const target = new EventTarget();
    let cancelled = false;
    let resolveFinished: (value: unknown) => void = () => undefined;
    const finished = new Promise<unknown>((resolve) => {
      resolveFinished = resolve;
    });
    const animation = {
      // Null currentTime causes @material/web ripple to skip real-time delay timers cleanly.
      currentTime: null,
      playState: 'finished',
      finished,
      ready: Promise.resolve<unknown>(undefined),
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target),
      cancel: (): void => {
        cancelled = true;
        animation.playState = 'idle';
        target.dispatchEvent(new Event('cancel'));
        resolveFinished(animation);
      },
      finish: (): void => {
        animation.playState = 'finished';
        target.dispatchEvent(new Event('finish'));
        resolveFinished(animation);
      },
      pause: (): void => undefined,
      play: (): void => undefined,
      reverse: (): void => undefined,
      commitStyles: (): void => undefined,
      persist: (): void => undefined,
      updatePlaybackRate: (): void => undefined,
    };
    animation.ready = Promise.resolve(animation);
    queueMicrotask(() => {
      if (cancelled) return;
      target.dispatchEvent(new Event('finish'));
      resolveFinished(animation);
    });
    return animation;
  });
}

if (typeof Element.prototype.getAnimations !== 'function') {
  Element.prototype.getAnimations = (): Animation[] => [];
}

if (typeof HTMLDialogElement !== 'undefined') {
  if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
      this.setAttribute('open', '');
    };
  }
  if (typeof HTMLDialogElement.prototype.close !== 'function') {
    HTMLDialogElement.prototype.close = function close(
      this: HTMLDialogElement,
      returnValue?: string,
    ): void {
      if (!this.hasAttribute('open')) return;
      if (returnValue !== undefined) {
        this.returnValue = returnValue;
      }
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}

window.scrollTo = vi.fn();
Element.prototype.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;
Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;

afterEach(() => {
  cleanup();
});
