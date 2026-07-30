"use client";

import { useActionState, useState } from "react";
import { Banknote, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cashOut, type ActionResult } from "@/lib/actions";
import { formatMoney } from "@/lib/format";

/**
 * Withdrawing credits back to the card that bought them.
 *
 * Capped at what the member actually paid in through Stripe — welcome credits
 * and anything already forfeited aren't theirs to take out. The cap is enforced
 * on the server too; this just explains it before they try.
 */
export function CashOutForm({ maxCents }: { maxCents: number }) {
  const [amount, setAmount] = useState(String(maxCents / 100));
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    cashOut,
    null,
  );

  if (maxCents <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing to cash out yet. Only credits you bought through Stripe can be
        withdrawn — welcome credits and anything you&apos;ve forfeited can&apos;t.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <Field className="sm:max-w-40" data-invalid={state?.error ? true : undefined}>
        <FieldLabel htmlFor="amountDollars">Amount (USD)</FieldLabel>
        <Input
          id="amountDollars"
          name="amountDollars"
          type="number"
          min="1"
          max={maxCents / 100}
          step="1"
          className="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <FieldDescription>{`Up to ${formatMoney(maxCents)}.`}</FieldDescription>
        {state?.error ? <FieldError>{state.error}</FieldError> : null}
      </Field>

      <div className="sm:mb-6">
        <Button type="submit" variant="secondary" size="lg" disabled={pending}>
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              Refunding…
            </>
          ) : (
            <>
              <Banknote data-icon="inline-start" />
              Cash out
            </>
          )}
        </Button>
      </div>

      {state?.ok ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-verified sm:mb-8">
          <Check aria-hidden className="size-4" />
          Refunded to your card.
        </p>
      ) : null}
    </form>
  );
}
