import { useEffect, useState } from 'react';

/** Skeletons appear only after 200ms so fast responses do not flash. */
export const SKELETON_DELAY_MS = 200;

export function useDelayedVisible(delayMs: number = SKELETON_DELAY_MS): boolean {
  const [isVisible, setIsVisible] = useState(delayMs <= 0);
  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [delayMs]);
  return isVisible;
}
