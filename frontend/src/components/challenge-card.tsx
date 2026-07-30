import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DueCountdown } from "@/components/due-countdown";
import { StatusPill } from "@/components/status-pill";
import { SubmitProofDialog } from "@/components/submit-proof-dialog";
import { formatMoney } from "@/lib/format";
import type { Challenge, PaymentRequest, Submission } from "@/lib/types";

/**
 * Today's challenge — the hero of the group dashboard.
 *
 * The footer swaps between three states: nothing submitted yet (submit CTA),
 * verified (the agent's reasoning), and missed (reasoning plus the route to
 * settle up). The commitment amount is always visible so the stakes are never
 * a surprise at payment time.
 */
export function ChallengeCard({
  challenge,
  submission,
  paymentRequest,
}: {
  challenge: Challenge;
  submission: Submission | null;
  paymentRequest: PaymentRequest | null;
}) {
  const pendingPayment =
    submission?.status === "missed" && paymentRequest?.status === "pending"
      ? paymentRequest
      : null;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-xl shadow-primary/20 sm:p-8">
      {/* Soft light bloom. Purely decorative, hidden from assistive tech. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-white/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide uppercase">
            Today&apos;s challenge
          </span>
          {challenge.agentGenerated ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
              <Sparkles aria-hidden className="size-3" />
              Agent picked
            </span>
          ) : null}
          <DueCountdown
            dueAt={challenge.dueAt}
            className="ml-auto bg-white/15 text-primary-foreground"
          />
        </div>

        <div>
          <h2 className="font-heading text-2xl leading-tight font-extrabold sm:text-3xl">
            {challenge.title}
          </h2>
          {challenge.description ? (
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-primary-foreground/80">
              {challenge.description}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-white/12 px-4 py-3">
          <span className="text-xs font-bold tracking-wide uppercase text-primary-foreground/70">
            Commitment
          </span>
          <span className="numeric ml-auto text-xl font-bold">
            {formatMoney(challenge.commitmentAmountCents)}
          </span>
          <span className="text-xs text-primary-foreground/70">
            if you miss it
          </span>
        </div>

        {submission ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-white/12 p-4">
            <div className="flex items-center gap-2">
              <StatusPill
                status={submission.status}
                className="bg-white/90 shadow-sm"
              />
              <span className="text-xs text-primary-foreground/70">
                Your submission
              </span>
            </div>
            {submission.agentReason ? (
              <p className="text-sm leading-relaxed text-primary-foreground/90">
                <Sparkles aria-hidden className="mr-1.5 inline size-3.5" />
                {submission.agentReason}
              </p>
            ) : null}
            {pendingPayment ? (
              <Button
                size="xl"
                variant="secondary"
                className="w-full sm:w-auto"
                render={<Link href={`/pay/${pendingPayment.id}`} />}
              >
                {`Review the ${formatMoney(pendingPayment.amountCents)} commitment`}
              </Button>
            ) : null}
          </div>
        ) : (
          <SubmitProofDialog
            groupId={challenge.groupId}
            challengeTitle={challenge.title}
            commitmentAmountCents={challenge.commitmentAmountCents}
          />
        )}
      </div>
    </section>
  );
}
