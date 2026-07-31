import { ArrowDownRight, ArrowUpRight, Banknote, Gift } from "lucide-react";
import { CashOutForm } from "@/components/cash-out-form";
import { TopUpForm } from "@/components/top-up-form";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/format";
import {
  getCurrentUser,
  getRefundableCents,
  getWalletBalance,
  getWalletEntries,
} from "@/lib/data";
import { TOP_UP_OPTIONS_CENTS } from "@/lib/data";
import type { WalletEntryKind } from "@/lib/types";

const ENTRY_STYLE: Record<
  WalletEntryKind,
  { icon: typeof Gift; tone: string; label: string }
> = {
  signup_grant: { icon: Gift, tone: "text-primary", label: "Welcome credits" },
  top_up: { icon: ArrowUpRight, tone: "text-verified", label: "Top-up" },
  forfeit: { icon: ArrowDownRight, tone: "text-destructive", label: "Forfeited" },
  cash_out: { icon: Banknote, tone: "text-muted-foreground", label: "Cashed out" },
};

/**
 * The member's credit balance and the history behind it.
 *
 * The ledger is the point of this screen, not the number: seeing "missed day 3,
 * −$5" is what makes the commitment feel real, and it is also the honest
 * account of where the balance came from.
 */
export default async function WalletPage() {
  const user = await getCurrentUser();
  const [balance, entries, refundable] = await Promise.all([
    getWalletBalance(user.id),
    getWalletEntries(user.id),
    getRefundableCents(user.id),
  ]);

  const forfeited = entries
    .filter((entry) => entry.kind === "forfeit")
    .reduce((sum, entry) => sum + Math.abs(entry.amountCents), 0);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-3xl">Your credits</h1>
        <p className="mt-1 text-muted-foreground">
          Credits are what you stake. Miss a day and they come straight out of
          here — no card, no approval screen.
        </p>
      </div>

      <div className="rounded-3xl border bg-card p-6 sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Balance
        </p>
        <p className="numeric mt-2 text-5xl font-bold tracking-tight">
          {formatMoney(balance)}
        </p>
        {forfeited > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {`${formatMoney(forfeited)} forfeited so far.`}
          </p>
        ) : null}

        {/* Accounts start empty now, so zero is the normal first state rather
            than a warning — but zero after a ledger of activity is a different
            sentence, and reads wrong if the two share one. */}
        {balance <= 0 ? (
          <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {entries.length === 0
              ? "Buy credits before you stake — a commitment you haven't backed with anything isn't one."
              : "You're out of credits. A missed day still settles against you, so top up before your next stake."}
          </p>
        ) : null}

        <Separator className="my-6" />

        <TopUpForm options={TOP_UP_OPTIONS_CENTS} />

        <Separator className="my-6" />

        <h2 className="font-heading font-bold">Cash out</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Refunded to the card you bought with. Stripe moves the money both
          ways — in when you buy credits, out when you take them back.
        </p>
        <CashOutForm maxCents={Math.min(balance, refundable)} />
      </div>

      <div className="rounded-3xl border bg-card p-6 sm:p-8">
        <h2 className="font-heading font-bold">History</h2>
        <ul className="mt-4 flex flex-col gap-1">
          {entries.map((entry) => {
            const style = ENTRY_STYLE[entry.kind];
            const Icon = style.icon;
            return (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 odd:bg-muted/40"
              >
                <Icon aria-hidden className={`size-4 shrink-0 ${style.tone}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.memo}</p>
                  <p className="text-xs text-muted-foreground">{style.label}</p>
                </div>
                <span
                  className={`numeric shrink-0 font-bold ${
                    entry.amountCents < 0 ? "text-destructive" : "text-verified"
                  }`}
                >
                  {entry.amountCents < 0 ? "−" : "+"}
                  {formatMoney(Math.abs(entry.amountCents))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
