import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Streak counter.
 *
 * Uses the Lucide flame rather than an emoji so it inherits colour, scales
 * cleanly, and renders identically across platforms.
 */
export function StreakBadge({
  streak,
  className,
}: {
  streak: number;
  className?: string;
}) {
  const alight = streak > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-bold",
        alight ? "bg-flame/12 text-flame" : "bg-muted text-muted-foreground",
        className,
      )}
      title={
        alight
          ? `${streak} day streak`
          : "No streak yet — a miss resets it to zero"
      }
    >
      <Flame
        aria-hidden
        className={cn("size-4", alight && "fill-flame/20")}
      />
      <span className="numeric">{streak}</span>
      <span className="sr-only">day streak</span>
    </span>
  );
}
