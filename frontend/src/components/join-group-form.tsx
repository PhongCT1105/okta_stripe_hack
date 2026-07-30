"use client";

import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { joinGroup, type ActionResult } from "@/lib/actions";

export function JoinGroupForm({ inviteCode }: { inviteCode: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    joinGroup,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="inviteCode" value={inviteCode} />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t join</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Joining…
          </>
        ) : (
          "Join the group"
        )}
      </Button>
    </form>
  );
}
