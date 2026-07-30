/** Formats integer cents as USD, e.g. 500 -> "$5.00". */
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Human countdown to an ISO timestamp, e.g. "2h 14m left" / "Past due".
 *
 * Call this on the client only. Rendering it during SSR would bake in the
 * server's clock and mismatch on hydration.
 */
export function formatTimeLeft(dueAtIso: string, now: number): string {
  const remainingMs = new Date(dueAtIso).getTime() - now;
  if (remainingMs <= 0) return "Past due";

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h left`;
  }
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/**
 * "5:00 PM" in the viewer's timezone.
 *
 * Client-only for the same reason as `formatTimeLeft`: the server renders in
 * its own timezone (UTC on most hosts) and would mismatch on hydration.
 */
export function formatDueTime(dueAtIso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dueAtIso));
}
