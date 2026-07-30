"use client";

import { useSyncExternalStore } from "react";

/**
 * Hooks for values that only exist in the browser.
 *
 * Both return a null/empty server snapshot so the markup React renders on the
 * server matches the first client render, then switch to the real value after
 * hydration. `useSyncExternalStore` is the right primitive here — reading these
 * through `useEffect` + `setState` causes the cascading render that React's
 * `set-state-in-effect` rule warns about.
 */

const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;
let clockNow = 0;

/** One shared interval regardless of how many countdowns are mounted. */
function subscribeToClock(listener: () => void): () => void {
  clockListeners.add(listener);

  if (clockTimer === null) {
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      for (const notify of clockListeners) notify();
    }, 30_000);
  }

  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer !== null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

function getClockSnapshot(): number {
  // Initialized on first read rather than at module load, so the value is
  // current whenever the first countdown actually mounts.
  if (clockNow === 0) clockNow = Date.now();
  return clockNow;
}

function getClockServerSnapshot(): null {
  return null;
}

/** Current time, refreshed every 30s. Null during server render. */
export function useClock(): number | null {
  return useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    getClockServerSnapshot,
  );
}

/** The origin never changes for the life of the page, so nothing to subscribe to. */
function subscribeToOrigin(): () => void {
  return () => {};
}

function getOriginSnapshot(): string {
  return window.location.origin;
}

function getOriginServerSnapshot(): string {
  return "";
}

/** `https://example.com`, or an empty string during server render. */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribeToOrigin,
    getOriginSnapshot,
    getOriginServerSnapshot,
  );
}
