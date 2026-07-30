import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";
import { StreakBadge } from "@/components/streak-badge";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/types";

/** Rank medals for the top three, plain numerals below. */
const RANK_TONE = [
  "bg-flame text-flame-foreground",
  "bg-primary/70 text-primary-foreground",
  "bg-secondary text-secondary-foreground",
];

export function Leaderboard({
  entries,
  currentUserId,
}: {
  entries: LeaderboardEntry[];
  currentUserId: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription>
          Ranked by score, then streak. Updated the moment the agent rules.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {entries.map((entry, index) => {
          const isCurrentUser = entry.user.id === currentUserId;
          const owes =
            entry.paymentRequest?.status === "pending"
              ? entry.paymentRequest
              : null;

          return (
            <div
              key={entry.user.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-2xl border p-3 transition-colors sm:flex-nowrap",
                isCurrentUser
                  ? "border-primary/30 bg-primary/5"
                  : "border-transparent bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "numeric flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  RANK_TONE[index] ?? "bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                {index + 1}
              </span>

              <Avatar className="size-10 shrink-0">
                {entry.user.avatarUrl ? (
                  <AvatarImage src={entry.user.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                  {entry.user.initials}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate font-heading font-bold">
                  <span className="sr-only">{`Rank ${index + 1}: `}</span>
                  {entry.user.displayName}
                  {isCurrentUser ? (
                    <span className="ml-1.5 text-xs font-semibold text-primary">
                      you
                    </span>
                  ) : null}
                </p>
                <p className="numeric text-xs text-muted-foreground">
                  {entry.member.score} pts
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <StreakBadge streak={entry.member.streak} />
                <StatusPill status={entry.status} />
              </div>

              {owes ? (
                <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-end">
                  <span className="numeric text-sm font-bold text-destructive">
                    {formatMoney(owes.amountCents)}
                  </span>
                  {isCurrentUser ? (
                    <Button size="sm" render={<Link href={`/pay/${owes.id}`} />}>
                      Settle up
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
