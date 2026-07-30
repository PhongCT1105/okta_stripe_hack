"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { updateProfile, type ActionResult } from "@/lib/actions";
import type { User } from "@/lib/types";

/**
 * Profile setup and editing, in one form.
 *
 * The same form runs first-time setup and later edits — the only difference is
 * the copy around it and where you land afterwards, so there's no second
 * near-identical screen to keep in sync.
 */
export function ProfileForm({
  user,
  interestOptions,
  isFirstRun,
}: {
  user: User;
  interestOptions: readonly string[];
  isFirstRun: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateProfile,
    null,
  );

  // Saving revalidates /profile, which streams a fresh `user` into this still
  // mounted form. An uncontrolled checkbox can't accept a new default once it's
  // initialized, so the selection lives here instead — seeded from the server
  // on mount, owned by the client from then on.
  const [interests, setInterests] = useState<string[]>(user.interests);

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field data-invalid={state?.error ? true : undefined}>
          <FieldLabel htmlFor="displayName">Name</FieldLabel>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={user.displayName}
            autoComplete="name"
          />
          <FieldDescription>How you show up on the leaderboard.</FieldDescription>
        </Field>

        <Field data-invalid={state?.error ? true : undefined}>
          <FieldLabel htmlFor="headline">What are you working toward?</FieldLabel>
          <Textarea
            id="headline"
            name="headline"
            rows={2}
            maxLength={160}
            defaultValue={user.headline ?? ""}
            placeholder="Getting interview-ready in the next six weeks without burning out."
          />
          <FieldDescription>
            One line. This is what we match you on, so be specific about the goal
            rather than the habit.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Goals</FieldLabel>
          <FieldDescription>
            Pick anything that applies. Used to find people chasing the same thing.
          </FieldDescription>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {interestOptions.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl border bg-muted/40 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Checkbox
                  name="interests"
                  value={option}
                  checked={interests.includes(option)}
                  onCheckedChange={(checked) =>
                    setInterests((current) =>
                      checked
                        ? [...current, option]
                        : current.filter((interest) => interest !== option),
                    )
                  }
                />
                {option}
              </label>
            ))}
          </div>
        </Field>

        {state?.error ? <FieldError>{state.error}</FieldError> : null}

        {state?.ok && !isFirstRun ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-verified">
            <Check aria-hidden className="size-4" />
            Saved.
          </p>
        ) : null}
      </FieldGroup>

      <Button type="submit" size="xl" className="mt-6 w-full sm:w-auto" disabled={pending}>
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Saving…
          </>
        ) : isFirstRun ? (
          "Continue to my groups"
        ) : (
          "Save profile"
        )}
      </Button>
    </form>
  );
}
