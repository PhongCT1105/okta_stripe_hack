"use client";

import { useActionState, useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { startTopUp, type ActionResult } from "@/lib/actions";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Buying credits — the one place a card is involved.
 *
 * Missing a day never asks for payment details; it just costs credits you
 * already hold. You only come here once you've spent enough of them to want
 * more, which is what makes this a purchase rather than a penalty.
 */
export function TopUpForm({ options }: { options: readonly number[] }) {
  const [selected, setSelected] = useState(options[0]);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    startTopUp,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="amountCents" value={selected} />

      <div className="grid grid-cols-3 gap-2">
        {options.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => setSelected(amount)}
            aria-pressed={amount === selected}
            className={cn(
              "numeric rounded-2xl border-2 px-3 py-4 text-lg font-bold transition-colors",
              amount === selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-muted/40 hover:bg-muted",
            )}
          >
            {formatMoney(amount)}
          </button>
        ))}
      </div>

      {state?.error ? <FieldError>{state.error}</FieldError> : null}

      <Button type="submit" size="xl" disabled={pending}>
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Opening Stripe…
          </>
        ) : (
          <>
            <CreditCard data-icon="inline-start" />
            {`Buy ${formatMoney(selected)} of credits`}
          </>
        )}
      </Button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Card details are entered on Stripe&apos;s hosted checkout and never touch
        this app. Test mode — use card 4242 4242 4242 4242.
      </p>
    </form>
  );
}
