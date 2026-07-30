"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { createChallenge, type ActionResult } from "@/lib/actions";

/**
 * Suggestions the agent would otherwise generate.
 *
 * Hardcoded for now so the flow is demonstrable without a model call; the
 * button that applies them is the same one the real generator will fill.
 */
const AGENT_SUGGESTIONS = [
  {
    title: "Complete one LeetCode problem",
    description:
      "Solve any problem end to end and paste the link or a short summary of your approach.",
  },
  {
    title: "Ship one commit to a side project",
    description: "Any real change counts. Link the commit.",
  },
  {
    title: "Read 20 pages",
    description: "Note the book and the pages you covered.",
  },
];

export function CreateChallengeForm({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    createChallenge,
    null,
  );

  // Rotates by group id so the demo group and a freshly created one differ.
  const suggestion =
    AGENT_SUGGESTIONS[groupId.length % AGENT_SUGGESTIONS.length];

  return (
    <form action={formAction}>
      <input type="hidden" name="groupId" value={groupId} />

      <FieldGroup>
        <Field data-invalid={state?.error ? true : undefined}>
          <FieldLabel htmlFor="title">Challenge</FieldLabel>
          <Input
            id="title"
            name="title"
            defaultValue={suggestion.title}
            placeholder="Complete one LeetCode problem"
            aria-invalid={state?.error ? true : undefined}
          />
          <FieldDescription>
            <span className="inline-flex items-center gap-1">
              <Sparkles aria-hidden className="size-3" />
              Prefilled with an agent suggestion — edit it however you like.
            </span>
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="description">Details</FieldLabel>
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={suggestion.description}
            placeholder="What counts as proof?"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="commitmentAmount">
            Commitment on a miss (USD)
          </FieldLabel>
          <Input
            id="commitmentAmount"
            name="commitmentAmount"
            type="number"
            min="0"
            step="1"
            defaultValue="5"
            className="numeric max-w-32"
          />
          <FieldDescription>
            Set to 0 for a no-stakes challenge. Nothing is ever charged without
            the member approving it.
          </FieldDescription>
          {state?.error ? <FieldError>{state.error}</FieldError> : null}
        </Field>
      </FieldGroup>

      <Button type="submit" size="xl" className="mt-6 w-full sm:w-auto" disabled={pending}>
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Creating…
          </>
        ) : (
          "Start the challenge"
        )}
      </Button>
    </form>
  );
}
