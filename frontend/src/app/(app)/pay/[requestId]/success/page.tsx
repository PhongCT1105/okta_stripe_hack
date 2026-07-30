import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/format";
import { getChallenge, getGroup, getPaymentRequest } from "@/lib/data";
import { markPaymentPaid } from "@/lib/repository";
import { verifyCommitmentCheckout } from "@/lib/stripe";

/**
 * Post-payment confirmation.
 *
 * Once Stripe is wired this route receives the Checkout redirect and verifies
 * the Session server-side before showing this state — which is the documented
 * fallback if webhook tunnelling isn't working during the demo.
 */
export default async function PaymentSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { requestId } = await params;
  const { session_id: sessionId } = await searchParams;

  const request = await getPaymentRequest(requestId);
  if (!request) notFound();

  const challenge = await getChallenge(request.challengeId);
  const group = challenge ? await getGroup(challenge.groupId) : null;
  let verified = request.status === "paid";

  if (!verified && sessionId && request.stripeCheckoutSessionId === sessionId) {
    try {
      verified = await verifyCommitmentCheckout(sessionId, request);
      if (verified) await markPaymentPaid(request.id, sessionId);
    } catch (error) {
      console.error("Unable to verify Stripe Checkout Session", {
        requestId,
        error: error instanceof Error ? error.message : "Unknown Stripe error",
      });
    }
  }

  if (!verified) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div className="rounded-3xl border border-border bg-card p-6 text-center sm:p-8">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-pending/12 text-pending">
            <CircleAlert aria-hidden className="size-9" />
          </div>
          <h1 className="mt-4 text-2xl">Payment not confirmed</h1>
          <p className="mt-2 text-muted-foreground">
            Stripe has not confirmed this payment. Return to the request and try
            again.
          </p>
          <Button
            size="xl"
            className="mt-8 w-full"
            render={<Link href={`/pay/${request.id}`} />}
          >
            Back to payment
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="rounded-3xl border border-border bg-card p-6 text-center sm:p-8">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-verified/12 text-verified">
          <CheckCircle2 aria-hidden className="size-9" />
        </div>

        <h1 className="mt-4 text-2xl">Payment complete</h1>
        <p className="mt-2 text-muted-foreground">
          You settled up with the group. Your streak starts again tomorrow.
        </p>

        <Separator className="my-6" />

        <dl className="flex flex-col gap-3 text-left text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Amount paid</dt>
            <dd className="numeric font-medium">
              {formatMoney(request.amountCents)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium text-verified">Paid</dd>
          </div>
          {request.stripeCheckoutSessionId ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Stripe session</dt>
              <dd className="numeric truncate font-medium">
                {request.stripeCheckoutSessionId}
              </dd>
            </div>
          ) : null}
        </dl>

        <Button
          size="xl"
          className="mt-8 w-full"
          render={<Link href={group ? `/groups/${group.id}` : "/groups"} />}
        >
          Back to the group
        </Button>
      </div>
    </div>
  );
}
