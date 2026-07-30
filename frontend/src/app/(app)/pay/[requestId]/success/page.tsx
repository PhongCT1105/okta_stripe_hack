import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/format";
import { getGroup, getPaymentRequest } from "@/lib/data";
import { challenges } from "@/lib/mock/store";

/**
 * Post-payment confirmation.
 *
 * Once Stripe is wired this route receives the Checkout redirect and verifies
 * the Session server-side before showing this state — which is the documented
 * fallback if webhook tunnelling isn't working during the demo.
 */
export default async function PaymentSuccessPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;

  const request = await getPaymentRequest(requestId);
  if (!request) notFound();

  const challenge = challenges.find((c) => c.id === request.challengeId) ?? null;
  const group = challenge ? await getGroup(challenge.groupId) : null;

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
