"use client";

import { useActionState, useState } from "react";
import { Check, Sparkles, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  declineChallenge,
  joinChallenge,
  type ActionResult,
} from "@/lib/actions";
import { formatMoney } from "@/lib/format";
import type { Challenge, ChallengeParticipant, User } from "@/lib/types";

/**
 * The agent's proposal, awaiting opt-ins.
 *
 * Staking is the approval — there is no separate vote. A member who ignores
 * this simply isn't in the run, which keeps one quiet person from blocking
 * everyone else, and keeps anyone from being committed to money they didn't
 * choose.
 */
export function ChallengeProposal({
  challenge,
  participants,
  members,
  currentUserId,
  membersRequired,
}: {
  challenge: Challenge;
  participants: ChallengeParticipant[];
  members: User[];
  currentUserId: string;
  membersRequired: number;
}) {
  const yours = participants.find((p) => p.userId === currentUserId) ?? null;
  const [stake, setStake] = useState(
    String((yours?.stakeCents ?? challenge.commitmentAmountCents) / 100),
  );

  const [joinState, joinAction, joining] = useActionState<
    ActionResult | null,
    FormData
  >(joinChallenge, null);
  const [, declineAction, declining] = useActionState<ActionResult | null, FormData>(
    declineChallenge,
    null,
  );

  const stillNeeded = Math.max(0, membersRequired - participants.length);

  return (
    <section className="rounded-3xl border-2 border-dashed border-primary/40 bg-primary/5 p-6 sm:p-8">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold tracking-wide text-primary-foreground uppercase">
            <Sparkles aria-hidden className="size-3" />
            Agent proposal
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            {stillNeeded > 0
              ? `${stillNeeded} more ${stillNeeded === 1 ? "person" : "people"} to start it`
              : "Ready to start"}
          </span>
        </div>

        <div>
          <h2 className="font-heading text-2xl leading-tight font-extrabold sm:text-3xl">
            {challenge.title}
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {challenge.description}
          </p>
        </div>

        {challenge.rationale ? (
          <div className="rounded-2xl bg-background/70 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
              <Sparkles aria-hidden className="size-3.5" />
              Why the agent picked this
            </p>
            <p className="text-sm leading-relaxed">{challenge.rationale}</p>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-background/70 px-4 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">Runs for</dt>
            <dd className="numeric font-heading text-lg font-bold">
              {`${challenge.durationDays} days`}
            </dd>
          </div>
          <div className="rounded-2xl bg-background/70 px-4 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">Due daily</dt>
            <dd className="numeric font-heading text-lg font-bold">
              {`${challenge.dueHour % 12 || 12}:00 ${challenge.dueHour < 12 ? "AM" : "PM"}`}
            </dd>
          </div>
          <div className="rounded-2xl bg-background/70 px-4 py-3">
            <dt className="text-xs font-semibold text-muted-foreground">Suggested</dt>
            <dd className="numeric font-heading text-lg font-bold">
              {formatMoney(challenge.commitmentAmountCents)}
            </dd>
          </div>
        </dl>

        {participants.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Users aria-hidden className="size-4 text-muted-foreground" />
            {participants.map((participant) => {
              const user = members.find((m) => m.id === participant.userId);
              return (
                <span
                  key={participant.userId}
                  className="inline-flex items-center gap-1.5 rounded-full bg-background/70 py-1 pr-3 pl-1"
                >
                  <Avatar className="size-6">
                    {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="text-[10px] font-bold">
                      {user?.initials ?? "??"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="numeric text-xs font-bold">
                    {formatMoney(participant.stakeCents)}
                  </span>
                </span>
              );
            })}
          </div>
        ) : null}

        <form action={joinAction} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <input type="hidden" name="challengeId" value={challenge.id} />
          <Field className="sm:max-w-48" data-invalid={joinState?.error ? true : undefined}>
            <FieldLabel htmlFor="stakeAmount">Your stake per miss (USD)</FieldLabel>
            <Input
              id="stakeAmount"
              name="stakeAmount"
              type="number"
              min="0"
              max="100"
              step="1"
              className="numeric"
              value={stake}
              onChange={(event) => setStake(event.target.value)}
            />
            <FieldDescription>
              Charged only after a confirmed miss, and only if you approve it.
            </FieldDescription>
            {joinState?.error ? <FieldError>{joinState.error}</FieldError> : null}
          </Field>

          <div className="flex gap-2 sm:mb-6">
            <Button type="submit" size="xl" disabled={joining}>
              {joining ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Staking…
                </>
              ) : yours ? (
                "Update my stake"
              ) : (
                "I'm in"
              )}
            </Button>
          </div>
        </form>

        {yours ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-verified/10 px-4 py-3">
            <Check aria-hidden className="size-4 text-verified" />
            <p className="text-sm font-medium">
              {`You're in for ${formatMoney(yours.stakeCents)} per missed day.`}
            </p>
            <form action={declineAction} className="ml-auto">
              <input type="hidden" name="challengeId" value={challenge.id} />
              <Button type="submit" variant="ghost" size="sm" disabled={declining}>
                Back out
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}
