"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { createGroup, type ActionResult } from "@/lib/actions";

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createGroup,
    null,
  );

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field data-invalid={state?.error ? true : undefined}>
          <FieldLabel htmlFor="name">Group name</FieldLabel>
          <Input
            id="name"
            name="name"
            autoFocus
            placeholder="30-Day Builder Challenge"
            aria-invalid={state?.error ? true : undefined}
          />
          <FieldDescription>
            Name it after the goal, not the people — it&apos;s what everyone sees
            each morning.
          </FieldDescription>
          {state?.error ? <FieldError>{state.error}</FieldError> : null}
        </Field>
      </FieldGroup>

      <Button type="submit" size="xl" className="mt-6 w-full" disabled={pending}>
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Creating…
          </>
        ) : (
          "Create group"
        )}
      </Button>
    </form>
  );
}
