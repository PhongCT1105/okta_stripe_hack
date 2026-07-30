import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { RefreshOnMount } from "@/components/refresh-on-mount";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { getCurrentUser, getWalletBalance } from "@/lib/data";
import { getWalletEntryByCheckout, recordWalletEntry } from "@/lib/repository";
import { verifyTopUpCheckout } from "@/lib/stripe";

/**
 * Post-purchase credit.
 *
 * Credits are granted here, after retrieving the Session from Stripe — never
 * from the redirect itself, which anyone could forge by typing a URL. The
 * ledger entry carries the session id, so a refresh finds the existing entry
 * instead of minting a second one.
 */
export default async function TopUpSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const user = await getCurrentUser();

  let creditedCents: number | null = null;

  if (sessionId) {
    const already = await getWalletEntryByCheckout(sessionId);

    if (already !== null) {
      creditedCents = already;
    } else {
      try {
        const verified = await verifyTopUpCheckout(sessionId, user.id);
        if (verified) {
          await recordWalletEntry({
            userId: user.id,
            amountCents: verified.creditCents,
            kind: "top_up",
            memo: "Credits purchased",
            stripeCheckoutSessionId: sessionId,
            // Recorded now so a later cash-out knows which payment to refund.
            stripePaymentIntentId: verified.paymentIntentId,
          });
          creditedCents = verified.creditCents;
        }
      } catch (error) {
        console.error("Unable to verify top-up Checkout Session", {
          error: error instanceof Error ? error.message : "Unknown Stripe error",
        });
      }
    }
  }

  const balance = await getWalletBalance(user.id);

  if (creditedCents === null) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div className="rounded-3xl border bg-card p-6 text-center sm:p-8">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-pending/12 text-pending">
            <CircleAlert aria-hidden className="size-9" />
          </div>
          <h1 className="mt-4 text-2xl">Purchase not confirmed</h1>
          <p className="mt-2 text-muted-foreground">
            Stripe hasn&apos;t confirmed this payment, so no credits were added.
          </p>
          <Button size="xl" className="mt-8 w-full" render={<Link href="/wallet" />}>
            Back to credits
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      {/* Credits were just added, so the header's balance is a render behind. */}
      <RefreshOnMount />
      <div className="rounded-3xl border bg-card p-6 text-center sm:p-8">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-verified/12 text-verified">
          <CheckCircle2 aria-hidden className="size-9" />
        </div>
        <h1 className="mt-4 text-2xl">
          {`${formatMoney(creditedCents)} added`}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {`Your balance is now ${formatMoney(balance)}.`}
        </p>
        <Button size="xl" className="mt-8 w-full" render={<Link href="/groups" />}>
          Back to your groups
        </Button>
      </div>
    </div>
  );
}
