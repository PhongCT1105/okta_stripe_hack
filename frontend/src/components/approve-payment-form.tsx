"use client";

import { useActionState, useId, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { confirmPayment, type ActionResult } from "@/lib/actions";

/**
 * Explicit approval gate for a commitment payment.
 *
 * The submit button stays disabled until the member ticks consent. This is a
 * product requirement, not a nicety — the agent may prepare a payment request
 * but a human has to approve every charge.
 */
export function ApprovePaymentForm({
  requestId,
  amountLabel,
}: {
  requestId: string;
  amountLabel: string;
}) {
  const consentId = useId();
  const [consented, setConsented] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    confirmPayment,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="requestId" value={requestId} />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertTitle>Payment couldn&apos;t start</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4">
        <Checkbox
          id={consentId}
          checked={consented}
          onCheckedChange={(checked) => setConsented(checked === true)}
          className="mt-0.5"
        />
        <label
          htmlFor={consentId}
          className="cursor-pointer text-sm leading-relaxed"
        >
          {`I acknowledge I missed this commitment and I approve a ${amountLabel} payment.`}
        </label>
      </div>

      <Button type="submit" size="xl" disabled={!consented || pending}>
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Opening Stripe…
          </>
        ) : (
          `Approve and pay ${amountLabel}`
        )}
      </Button>
    </form>
  );
}
