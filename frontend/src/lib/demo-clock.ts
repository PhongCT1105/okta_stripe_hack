/**
 * Demo clock.
 *
 * A challenge runs in daily rounds derived from the calendar, which is what
 * keeps a scheduler out of the system — but it also means showing day two
 * normally costs a day of waiting. This offsets what the app believes "now" is.
 *
 * It shifts the present rather than rewriting a challenge's start date: rows
 * already written keep the round they were actually recorded in, and the new
 * day starts genuinely empty, which is the thing worth showing.
 *
 * Process-local and deliberately not persisted. The offset is a property of a
 * demo session, not of the data — a second server, or a restart, is back on
 * real time, and nothing in the database has been falsified.
 */

const globalCache = globalThis as typeof globalThis & {
  __demoDayOffset?: { value: number };
};

function state() {
  return (globalCache.__demoDayOffset ??= { value: 0 });
}

/** Whether the demo clock controls are switched on. */
export function isDemoMode(): boolean {
  return process.env.DEMO_CONTROLS === "1";
}

export function getDemoDayOffset(): number {
  return isDemoMode() ? state().value : 0;
}

export function setDemoDayOffset(days: number): void {
  state().value = Math.max(0, Math.trunc(days));
}

/** What the app treats as the current moment, demo offset included. */
export function now(): Date {
  const d = new Date();
  const offset = getDemoDayOffset();
  if (offset !== 0) d.setDate(d.getDate() + offset);
  return d;
}
