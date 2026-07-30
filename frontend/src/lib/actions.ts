"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { evaluateProof } from "@/lib/agent";
import { getActiveChallenge, getCurrentUser, getGroupByInviteCode } from "@/lib/data";
import {
  challenges,
  groupMembers,
  groups,
  nextId,
  paymentRequests,
  submissions,
} from "@/lib/mock/store";
import { createCommitmentCheckout } from "@/lib/stripe";
import type { SubmissionStatus } from "@/lib/types";

/**
 * Write side of the data layer.
 *
 * Mutations run as Server Functions so the components calling them stay
 * unchanged when a real database and Auth0 session land behind these.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface VerdictResult extends ActionResult {
  status?: SubmissionStatus;
  reason?: string;
  /** Present when the verdict created a payment request. */
  paymentRequestId?: string;
}

/** Generates a readable invite code, e.g. "BUILD30" style. */
function makeInviteCode(groupName: string): string {
  const letters = groupName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 5)
    .padEnd(5, "X");
  const suffix = (groups.length + 1).toString().padStart(2, "0");
  return `${letters}${suffix}`;
}

export async function createGroup(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3) {
    return { ok: false, error: "Give your group a name of at least 3 characters." };
  }

  const user = await getCurrentUser();
  const groupId = nextId("grp");

  groups.push({
    id: groupId,
    name,
    inviteCode: makeInviteCode(name),
    ownerId: user.id,
  });
  groupMembers.push({
    groupId,
    userId: user.id,
    role: "organizer",
    streak: 0,
    score: 0,
  });

  revalidatePath("/groups");
  redirect(`/groups/${groupId}`);
}

export async function createChallenge(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const groupId = String(formData.get("groupId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amountDollars = Number(formData.get("commitmentAmount") ?? 0);

  if (title.length < 3) {
    return { ok: false, error: "Describe the challenge in a few more words." };
  }
  if (!Number.isFinite(amountDollars) || amountDollars < 0) {
    return { ok: false, error: "Enter a commitment amount of $0 or more." };
  }

  const group = groups.find((g) => g.id === groupId);
  if (!group) return { ok: false, error: "That group no longer exists." };

  // One active challenge per group, so a new one replaces the old.
  const existingIndex = challenges.findIndex((c) => c.groupId === groupId);
  const dueAt = new Date();
  dueAt.setHours(17, 0, 0, 0);

  const challenge = {
    id: nextId("chl"),
    groupId,
    title,
    description,
    dueAt: dueAt.toISOString(),
    commitmentAmountCents: Math.round(amountDollars * 100),
    agentGenerated: formData.get("agentGenerated") === "true",
  };

  if (existingIndex >= 0) challenges.splice(existingIndex, 1, challenge);
  else challenges.push(challenge);

  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function joinGroup(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const code = String(formData.get("inviteCode") ?? "");
  const group = await getGroupByInviteCode(code);
  if (!group) {
    return { ok: false, error: `No group found for invite code "${code}".` };
  }

  const user = await getCurrentUser();
  const already = groupMembers.some(
    (m) => m.groupId === group.id && m.userId === user.id,
  );
  if (!already) {
    groupMembers.push({
      groupId: group.id,
      userId: user.id,
      role: "member",
      streak: 0,
      score: 0,
    });
  }

  revalidatePath(`/groups/${group.id}`);
  redirect(`/groups/${group.id}`);
}

/**
 * Submits proof and runs the agent over it in one step.
 *
 * A miss creates a *pending* payment request. It is never charged here — the
 * member has to open it and approve the payment themselves.
 */
export async function submitProof(
  _prev: VerdictResult | null,
  formData: FormData,
): Promise<VerdictResult> {
  const groupId = String(formData.get("groupId") ?? "");
  const proof = String(formData.get("proof") ?? "").trim();

  if (proof.length === 0) {
    return { ok: false, error: "Add a link or a short note describing what you did." };
  }

  const challenge = await getActiveChallenge(groupId);
  if (!challenge) return { ok: false, error: "This group has no active challenge." };

  const user = await getCurrentUser();
  const verdict = await evaluateProof(challenge.title, proof);

  const existingIndex = submissions.findIndex(
    (s) => s.challengeId === challenge.id && s.userId === user.id,
  );
  const submission = {
    id: existingIndex >= 0 ? submissions[existingIndex].id : nextId("sub"),
    challengeId: challenge.id,
    userId: user.id,
    proof,
    status: verdict.status,
    agentReason: verdict.reason,
    submittedAt: new Date().toISOString(),
  };
  if (existingIndex >= 0) submissions.splice(existingIndex, 1, submission);
  else submissions.push(submission);

  const membership = groupMembers.find(
    (m) => m.groupId === groupId && m.userId === user.id,
  );
  let paymentRequestId: string | undefined;

  if (verdict.status === "passed") {
    if (membership) {
      membership.streak += 1;
      membership.score += 10;
    }
  } else {
    if (membership) membership.streak = 0;

    // Only raise a payment request when real money is on the line.
    if (challenge.commitmentAmountCents > 0) {
      const existing = paymentRequests.find(
        (p) => p.challengeId === challenge.id && p.userId === user.id,
      );
      if (existing) {
        paymentRequestId = existing.id;
      } else {
        const request = {
          id: nextId("pay"),
          challengeId: challenge.id,
          userId: user.id,
          amountCents: challenge.commitmentAmountCents,
          stripeCheckoutSessionId: null,
          status: "pending" as const,
        };
        paymentRequests.push(request);
        paymentRequestId = request.id;
      }
    }
  }

  revalidatePath(`/groups/${groupId}`);
  return {
    ok: true,
    status: verdict.status,
    reason: verdict.reason,
    paymentRequestId,
  };
}

/**
 * Creates a Stripe-hosted Checkout Session after explicit member approval.
 * The success route verifies the Session server-side before marking it paid.
 */
export async function confirmPayment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const requestId = String(formData.get("requestId") ?? "");
  const request = paymentRequests.find((p) => p.id === requestId);
  if (!request) return { ok: false, error: "That payment request no longer exists." };

  const challenge = challenges.find((c) => c.id === request.challengeId);
  if (!challenge) return { ok: false, error: "The related challenge no longer exists." };

  let checkoutUrl: string;
  try {
    const session = await createCommitmentCheckout(request, challenge.title);
    if (!session.url) {
      return { ok: false, error: "Stripe did not return a Checkout URL." };
    }

    request.stripeCheckoutSessionId = session.id;
    checkoutUrl = session.url;
  } catch (error) {
    console.error("Unable to create Stripe Checkout Session", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown Stripe error",
    });
    return {
      ok: false,
      error: "Stripe Checkout is temporarily unavailable. Please try again.",
    };
  }

  redirect(checkoutUrl);
}

/**
 * Organizer override, kept for demo recovery.
 *
 * The plan calls for a way to correct an agent decision live if the model
 * misjudges a submission in front of judges.
 */
export async function overrideVerdict(formData: FormData): Promise<void> {
  const submissionId = String(formData.get("submissionId") ?? "");
  const status = String(formData.get("status") ?? "") as SubmissionStatus;
  const groupId = String(formData.get("groupId") ?? "");

  const submission = submissions.find((s) => s.id === submissionId);
  if (!submission) return;

  submission.status = status;
  submission.agentReason = "Overridden by the group organizer.";

  if (status === "passed") {
    const request = paymentRequests.find(
      (p) => p.challengeId === submission.challengeId && p.userId === submission.userId,
    );
    if (request && request.status === "pending") request.status = "canceled";
  }

  revalidatePath(`/groups/${groupId}`);
}
