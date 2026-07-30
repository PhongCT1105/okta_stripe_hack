"use client";

import { useActionState } from "react";
import { CalendarClock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  advanceDemoDay,
  resetDemoDay,
  type ActionResult,
} from "@/lib/actions";

/**
 * Moves the demo forward a day.
 *
 * Rounds come from the calendar, so showing day two would otherwise mean
 * waiting one. This shifts what the app treats as today; yesterday's
 * submissions keep the round they were made in, and the new day starts empty.
 *
 * Deliberately styled as scaffolding rather than product — it should read as a
 * stage prop, not a feature. Rendered only when DEMO_CONTROLS=1.
 */
export function DemoDayControls({
  groupId,
  dayOffset,
}: {
  groupId: string;
  dayOffset: number;
}) {
  const [advanceState, advanceAction, advancing] = useActionState<
    ActionResult | null,
    FormData
  >(advanceDemoDay, null);
  const [, resetAction, resetting] = useActionState<ActionResult | null, FormData>(
    resetDemoDay,
    null,
  );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-pending/50 bg-pending/5 px-4 py-3">
      <CalendarClock aria-hidden className="size-4 text-pending" />
      <p className="text-sm font-medium">
        {dayOffset === 0
          ? "Demo clock: real time"
          : `Demo clock: ${dayOffset} day${dayOffset === 1 ? "" : "s"} ahead`}
      </p>

      {advanceState?.error ? (
        <p className="text-sm font-medium text-destructive">
          {advanceState.error}
        </p>
      ) : null}

      <div className="ml-auto flex gap-2">
        <form action={advanceAction}>
          <input type="hidden" name="groupId" value={groupId} />
          <Button type="submit" variant="secondary" size="sm" disabled={advancing}>
            {advancing ? <Spinner data-icon="inline-start" /> : null}
            Next day
          </Button>
        </form>

        {dayOffset > 0 ? (
          <form action={resetAction}>
            <input type="hidden" name="groupId" value={groupId} />
            <Button type="submit" variant="ghost" size="sm" disabled={resetting}>
              <RotateCcw data-icon="inline-start" />
              Reset
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
