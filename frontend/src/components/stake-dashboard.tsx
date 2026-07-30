import { CircleDollarSign, TrendingUp, Users, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { Round } from "@/lib/types";

/**
 * What the group has riding on the current challenge.
 *
 * Deliberately four flat numbers rather than a chart: during a run the only
 * questions anyone asks are how many are in, how much is exposed, what's owed
 * right now, and what's already been paid.
 */
export function StakeDashboard({
  participantCount,
  potCents,
  atRiskCents,
  collectedCents,
  round,
  durationDays,
}: {
  participantCount: number;
  potCents: number;
  atRiskCents: number;
  collectedCents: number;
  round: Round | null;
  durationDays: number;
}) {
  const stats = [
    {
      label: "In on it",
      value: `${participantCount}`,
      hint: participantCount === 1 ? "member" : "members",
      icon: Users,
      tone: "text-primary",
    },
    {
      label: "Total on the line",
      value: formatMoney(potCents),
      hint: `across ${durationDays} days`,
      icon: Wallet,
      tone: "text-foreground",
    },
    {
      label: "Owed right now",
      value: formatMoney(atRiskCents),
      hint: "pending approval",
      icon: CircleDollarSign,
      tone: atRiskCents > 0 ? "text-destructive" : "text-muted-foreground",
    },
    {
      label: "Settled",
      value: formatMoney(collectedCents),
      hint: "paid to date",
      icon: TrendingUp,
      tone: collectedCents > 0 ? "text-verified" : "text-muted-foreground",
    },
  ];

  return (
    <section className="rounded-3xl border bg-card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline gap-2">
        <h2 className="font-heading font-bold">The stakes</h2>
        {round ? (
          <p className="text-xs font-semibold text-muted-foreground">
            {`Day ${round.index} of ${durationDays}`}
          </p>
        ) : (
          <p className="text-xs font-semibold text-muted-foreground">
            This run has finished
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-muted/50 p-4">
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <stat.icon aria-hidden className="size-3.5" />
              {stat.label}
            </dt>
            <dd
              className={`numeric font-heading mt-1 text-2xl font-extrabold ${stat.tone}`}
            >
              {stat.value}
            </dd>
            <p className="text-xs text-muted-foreground">{stat.hint}</p>
          </div>
        ))}
      </dl>
    </section>
  );
}
