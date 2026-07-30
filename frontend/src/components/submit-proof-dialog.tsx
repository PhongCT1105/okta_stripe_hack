"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCircle2, Send, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { submitProof, type VerdictResult } from "@/lib/actions";
import { formatMoney } from "@/lib/format";

/**
 * Proof submission and the agent's ruling, in one dialog.
 *
 * Two states share the surface: the form, and the verdict. Keeping the verdict
 * here rather than on a separate route means the result lands where the user
 * was already looking, and the leaderboard behind it is already updated when
 * they close.
 */
export function SubmitProofDialog({
  groupId,
  challengeTitle,
  commitmentAmountCents,
}: {
  groupId: string;
  challengeTitle: string;
  commitmentAmountCents: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<VerdictResult | null, FormData>(
    submitProof,
    null,
  );

  // Derived, not stored: the verdict view is simply "the action returned a
  // ruling". Once it has, the parent re-renders with the submission in hand and
  // swaps this dialog out for the result panel, so there is nothing to reset.
  const showVerdict = Boolean(state?.ok && state.status);
  const passed = state?.status === "passed";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="xl" className="w-full sm:w-auto">
            <Send data-icon="inline-start" />
            Submit proof
          </Button>
        }
      />

      <DialogContent className="sm:max-w-lg">
        {showVerdict && state?.status ? (
          <>
            <DialogHeader>
              <div
                className={`mx-auto mb-2 flex size-16 items-center justify-center rounded-full ${
                  passed ? "bg-verified/12 text-verified" : "bg-destructive/12 text-destructive"
                }`}
              >
                {passed ? (
                  <CheckCircle2 aria-hidden className="size-9" />
                ) : (
                  <XCircle aria-hidden className="size-9" />
                )}
              </div>
              <DialogTitle className="text-center text-2xl">
                {passed ? "Nice — that counts." : "That one's a miss."}
              </DialogTitle>
              <DialogDescription className="text-center">
                {passed
                  ? "Your streak just went up and the leaderboard is updated."
                  : "Your streak resets to zero. No money moves until you approve it."}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl bg-muted/60 p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                <Sparkles aria-hidden className="size-3.5" />
                Agent decision
              </p>
              <p className="text-sm leading-relaxed">{state.reason}</p>
            </div>

            <DialogFooter>
              {state.paymentRequestId ? (
                <Button
                  size="xl"
                  className="w-full"
                  render={<Link href={`/pay/${state.paymentRequestId}`} />}
                >
                  {`Review the ${formatMoney(commitmentAmountCents)} commitment`}
                </Button>
              ) : (
                <DialogClose
                  render={
                    <Button size="xl" className="w-full">
                      Back to the group
                    </Button>
                  }
                />
              )}
            </DialogFooter>
          </>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="groupId" value={groupId} />
            <DialogHeader>
              <DialogTitle>Submit your proof</DialogTitle>
              <DialogDescription>{challengeTitle}</DialogDescription>
            </DialogHeader>

            <FieldGroup className="py-4">
              <Field data-invalid={state?.error ? true : undefined}>
                <FieldLabel htmlFor="proof">What did you do?</FieldLabel>
                <Textarea
                  id="proof"
                  name="proof"
                  rows={4}
                  autoFocus
                  aria-invalid={state?.error ? true : undefined}
                  placeholder="Paste a link, or describe specifically what you completed."
                />
                <FieldDescription>
                  A link is strongest. Otherwise be specific — the agent rejects
                  vague answers.
                </FieldDescription>
                {state?.error ? <FieldError>{state.error}</FieldError> : null}
              </Field>
            </FieldGroup>

            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="ghost" size="lg">
                    Cancel
                  </Button>
                }
              />
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Agent is reviewing…
                  </>
                ) : (
                  "Send to the agent"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
