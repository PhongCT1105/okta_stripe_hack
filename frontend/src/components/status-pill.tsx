import { CheckCircle2, CircleDashed, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@/lib/types";

/**
 * The one place a member's standing is turned into colour + words.
 *
 * Status is never conveyed by colour alone — each pill pairs its colour with
 * an icon and a label, so it still reads for colour-blind users and in
 * grayscale.
 */

const STATUS_CONFIG = {
  passed: {
    label: "Verified",
    Icon: CheckCircle2,
    className: "bg-verified/12 text-verified",
  },
  missed: {
    label: "Missed",
    Icon: XCircle,
    className: "bg-destructive/12 text-destructive",
  },
  reviewing: {
    label: "Reviewing",
    Icon: Clock,
    className: "bg-pending/15 text-pending",
  },
} as const satisfies Record<
  SubmissionStatus,
  { label: string; Icon: typeof CheckCircle2; className: string }
>;

const NOT_STARTED = {
  label: "Not started",
  Icon: CircleDashed,
  className: "bg-muted text-muted-foreground",
};

export function StatusPill({
  status,
  className,
}: {
  /** Null means the member has not submitted anything yet. */
  status: SubmissionStatus | null;
  className?: string;
}) {
  const { label, Icon, className: tone } = status
    ? STATUS_CONFIG[status]
    : NOT_STARTED;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
