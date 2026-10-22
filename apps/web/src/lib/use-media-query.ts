import { useSyncExternalStore } from 'react';

/**
 * Tracks a media query, so a screen can pick one rendering rather than shipping both and hiding
 * one with CSS (mobile day tabs and a desktop week grid are two different structures, not a
 * show/hide of the same one). Mirrors `Select`'s own
 * `subscribeToPointer`/`isCoarsePointer` pair, which uses the same `useSyncExternalStore` shape
 * for a `matchMedia` query.
 */
function subscribe(query: string) {
  return (onChange: () => void): (() => void) => {
    if (typeof window.matchMedia !== 'function') return () => undefined;
    const media = window.matchMedia(query);
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  };
}

function getSnapshot(query: string): () => boolean {
  return () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(subscribe(query), getSnapshot(query), () => false);
}

/** The desktop layout begins at 1024px. */
export const DESKTOP_QUERY = '(min-width: 1024px)';
