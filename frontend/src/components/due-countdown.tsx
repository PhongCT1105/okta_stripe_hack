"use client";

import { Timer } from "lucide-react";
import { useClock } from "@/hooks/use-client-only";
import { formatDueTime, formatTimeLeft } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Live countdown to the challenge deadline.
 *
 * Both the countdown and the due time depend on the viewer's clock and
 * timezone, so nothing time-derived is rendered until after mount. The server
 * pass renders a fixed-width placeholder, which keeps hydration clean and
 * avoids the row reflowing when the real value arrives.
 */
export function DueCountdown({
  dueAt,
  className,
}: {
  dueAt: string;
  className?: string;
}) {
  const now = useClock();
  const overdue = now !== null && new Date(dueAt).getTime() <= now;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
        overdue ? "bg-destructive/12 text-destructive" : "bg-secondary text-secondary-foreground",
        className,
      )}
    >
      <Timer aria-hidden className="size-4" />
      {now === null ? (
        <span className="numeric opacity-0" aria-hidden>
          0h 00m left
        </span>
      ) : (
        <>
          <span className="numeric">{formatTimeLeft(dueAt, now)}</span>
          <span className="sr-only">
            {`Due at ${formatDueTime(dueAt)}`}
          </span>
        </>
      )}
    </span>
  );
}
