import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { ApprovePaymentForm } from "@/components/approve-payment-form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/format";
import { getGroup, getPaymentRequest, getUser } from "@/lib/data";
import { challenges } from "@/lib/mock/store";

/**
 * Commitment payment consent screen.
 *
 * This page deliberately drops the playful treatment used everywhere else —
 * no gradients, no colour-saturated hero, mono numerals, plain language. The
 * shift in tone is the point: everything up to here is a game, and this is
 * the moment real money is involved. The member must tick consent before the
 * button enables, and nothing is charged until they do.
 */
export default async function PaymentRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;

  const request = await getPaymentRequest(requestId);
  if (!request) notFound();

  if (request.status === "paid") redirect(`/pay/${requestId}/success`);

  const challenge = challenges.find((c) => c.id === request.challengeId) ?? null;
  const group = challenge ? await getGroup(challenge.groupId) : null;
  const member = await getUser(request.userId);

  // Keeps the "back" link useful even if the challenge record has rotated.
  const backHref = group ? `/groups/${group.id}` : "/groups";

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        render={<Link href={backHref} />}
      >
        <ArrowLeft data-icon="inline-start" />
        Back to the group
      </Button>

      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Commitment payment
        </p>

        <p className="numeric mt-3 text-5xl font-bold tracking-tight">
          {formatMoney(request.amountCents)}
        </p>

        <p className="mt-2 text-muted-foreground">
          {challenge
            ? `You committed to "${challenge.title}" and the agent marked it missed.`
            : "You committed to a challenge and the agent marked it missed."}
        </p>

        <Separator className="my-6" />

        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Member</dt>
            <dd className="font-medium">{member?.displayName ?? "Unknown"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Group</dt>
            <dd className="font-medium">{group?.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="numeric font-medium">
              {formatMoney(request.amountCents)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Processed by</dt>
            <dd className="font-medium">Stripe (test mode)</dd>
          </div>
        </dl>

        <Separator className="my-6" />

        <ApprovePaymentForm
          requestId={request.id}
          amountLabel={formatMoney(request.amountCents)}
        />

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Card details are entered on Stripe&apos;s hosted checkout and never
          touch this app. The agent can prepare this request but cannot approve
          it for you.
        </p>
      </div>
    </div>
  );
}
