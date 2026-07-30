"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { evaluateProof } from "@/lib/agent";
import { proposeChallenge } from "@/lib/chat-agent";
import {
  getActiveChallenge,
  getChatMessages,
  getCurrentRound,
  getCurrentUser,
  getGroupByInviteCode,
  getMembership,
} from "@/lib/data";
import {
  challengeParticipants,
  challenges,
  chatMessages,
  groupMembers,
  groups,
  INTEREST_OPTIONS,
  localDate,
  nextId,
  paymentRequests,
  submissions,
  users,
} from "@/lib/mock/store";
import { createCommitmentCheckout } from "@/lib/stripe";
import type { SubmissionStatus, User } from "@/lib/types";

/**
 * Write side of the data layer.
 *
 * Mutations run as Server Functions so the components calling them stay
 * unchanged when a real database lands behind these. Server Functions are
 * reachable by direct POST, not just through the UI, so every one of them
 * re-checks who the caller is and what they're a member of.
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

/** How many members must stake before a proposal becomes a live challenge. */
const MEMBERS_REQUIRED_TO_START = 2;

/**
 * Resolves the caller and confirms they belong to the group.
 *
 * Returns null rather than throwing so callers can surface a normal form error
 * instead of a crash — but it is a genuine authorization check, not a
 * convenience: nothing below it should run for a non-member.
 */
async function requireMember(groupId: string): Promise<User | null> {
  const user = await getCurrentUser();
  const membership = await getMembership(groupId, user.id);
  return membership ? user : null;
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
 * Saves the signed-in member's profile.
 *
 * Auth0 supplies the identity; this supplies the intent. The headline is what
 * gates the first-run redirect, and the interests are the field a matcher would
 * later compare across members.
 */
export async function updateProfile(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();
  const interests = formData
    .getAll("interests")
    .map((value) => String(value))
    .filter((value) => INTEREST_OPTIONS.includes(value as never));

  if (displayName.length < 2) {
    return { ok: false, error: "Your name needs at least 2 characters." };
  }
  if (headline.length < 10) {
    return {
      ok: false,
      error: "Say a bit more about what you're working toward.",
    };
  }

  const user = await getCurrentUser();
  const stored = users.find((u) => u.id === user.id);
  if (!stored) return { ok: false, error: "We couldn't find your account." };

  stored.displayName = displayName;
  stored.headline = headline.slice(0, 160);
  stored.interests = interests;

  revalidatePath("/profile");
  revalidatePath("/groups");
  return { ok: true };
}

/** Posts a message to the group chat. */
export async function sendMessage(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const groupId = String(formData.get("groupId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (body.length === 0) return { ok: false };

  const user = await requireMember(groupId);
  if (!user) return { ok: false, error: "You're not a member of this group." };

  chatMessages.push({
    id: nextId("msg"),
    groupId,
    role: "member",
    userId: user.id,
    body: body.slice(0, 1000),
    createdAt: new Date().toISOString(),
  });

  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

/**
 * Summons the agent to read the chat and propose a challenge.
 *
 * The proposal is a challenge in `proposed` status — visible to everyone, but
 * binding on nobody until members stake on it.
 */
export async function summonAgent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const groupId = String(formData.get("groupId") ?? "");

  const user = await requireMember(groupId);
  if (!user) return { ok: false, error: "You're not a member of this group." };

  if (await getActiveChallenge(groupId)) {
    return { ok: false, error: "This group already has a challenge running." };
  }

  const history = await getChatMessages(groupId);
  if (history.length === 0) {
    return { ok: false, error: "Talk about what you want to commit to first." };
  }

  const proposal = await proposeChallenge(history, users);

  // A new proposal replaces any outstanding one — the group only ever weighs
  // up a single ask at a time.
  const existingIndex = challenges.findIndex(
    (c) => c.groupId === groupId && c.status === "proposed",
  );
  if (existingIndex >= 0) {
    const [stale] = challenges.splice(existingIndex, 1);
    const staleParticipants = challengeParticipants.filter(
      (p) => p.challengeId === stale.id,
    );
    for (const participant of staleParticipants) {
      challengeParticipants.splice(
        challengeParticipants.indexOf(participant),
        1,
      );
    }
  }

  const challengeId = nextId("chl");
  const dueAt = new Date();
  dueAt.setHours(proposal.dueHour, 0, 0, 0);

  challenges.push({
    id: challengeId,
    groupId,
    title: proposal.title,
    description: proposal.description,
    status: "proposed",
    dueAt: dueAt.toISOString(),
    dueHour: proposal.dueHour,
    startDate: localDate(),
    durationDays: proposal.durationDays,
    commitmentAmountCents: proposal.suggestedStakeCents,
    agentGenerated: true,
    rationale: proposal.rationale,
  });

  chatMessages.push({
    id: nextId("msg"),
    groupId,
    role: "agent",
    userId: null,
    body: proposal.rationale,
    createdAt: new Date().toISOString(),
    challengeId,
  });

  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

/**
 * Opts the caller into a proposed challenge at a stake they choose.
 *
 * The stake is the approval. Once enough members have staked, the challenge
 * starts on its own — there is no separate organizer confirmation, because
 * putting money on it is a stronger signal than a button press.
 */
export async function joinChallenge(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const challengeId = String(formData.get("challengeId") ?? "");
  const stakeDollars = Number(formData.get("stakeAmount") ?? 0);

  const challenge = challenges.find((c) => c.id === challengeId);
  if (!challenge) return { ok: false, error: "That proposal no longer exists." };

  const user = await requireMember(challenge.groupId);
  if (!user) return { ok: false, error: "You're not a member of this group." };

  if (!Number.isFinite(stakeDollars) || stakeDollars < 0 || stakeDollars > 100) {
    return { ok: false, error: "Pick a stake between $0 and $100." };
  }

  const existing = challengeParticipants.find(
    (p) => p.challengeId === challengeId && p.userId === user.id,
  );
  if (existing) {
    existing.stakeCents = Math.round(stakeDollars * 100);
  } else {
    challengeParticipants.push({
      challengeId,
      userId: user.id,
      stakeCents: Math.round(stakeDollars * 100),
      joinedAt: new Date().toISOString(),
    });
  }

  const count = challengeParticipants.filter(
    (p) => p.challengeId === challengeId,
  ).length;

  if (challenge.status === "proposed" && count >= MEMBERS_REQUIRED_TO_START) {
    challenge.status = "active";
    challenge.startDate = localDate();
    chatMessages.push({
      id: nextId("msg"),
      groupId: challenge.groupId,
      role: "agent",
      userId: null,
      body: `${count} of you are in, so "${challenge.title}" starts today and runs for ${challenge.durationDays} days. I'll check each day's proof.`,
      createdAt: new Date().toISOString(),
      challengeId,
    });
  }

  revalidatePath(`/groups/${challenge.groupId}`);
  return { ok: true };
}

/** Drops the caller out of a proposal without killing it for everyone else. */
export async function declineChallenge(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const challengeId = String(formData.get("challengeId") ?? "");

  const challenge = challenges.find((c) => c.id === challengeId);
  if (!challenge) return { ok: false, error: "That proposal no longer exists." };

  const user = await requireMember(challenge.groupId);
  if (!user) return { ok: false, error: "You're not a member of this group." };

  const index = challengeParticipants.findIndex(
    (p) => p.challengeId === challengeId && p.userId === user.id,
  );
  if (index >= 0) challengeParticipants.splice(index, 1);

  revalidatePath(`/groups/${challenge.groupId}`);
  return { ok: true };
}

/**
 * Submits proof for today's round and runs the agent over it in one step.
 *
 * A miss creates a *pending* payment request for that round's stake. It is
 * never charged here — the member has to open it and approve the payment.
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

  const user = await requireMember(groupId);
  if (!user) return { ok: false, error: "You're not a member of this group." };

  const challenge = await getActiveChallenge(groupId);
  if (!challenge) return { ok: false, error: "This group has no active challenge." };

  const round = getCurrentRound(challenge);
  if (!round) return { ok: false, error: "This challenge isn't running today." };

  const participant = challengeParticipants.find(
    (p) => p.challengeId === challenge.id && p.userId === user.id,
  );
  if (!participant) {
    return { ok: false, error: "You didn't stake on this challenge." };
  }

  const verdict = await evaluateProof(challenge.title, proof);

  const existingIndex = submissions.findIndex(
    (s) =>
      s.challengeId === challenge.id &&
      s.userId === user.id &&
      s.roundDate === round.date,
  );
  const submission = {
    id: existingIndex >= 0 ? submissions[existingIndex].id : nextId("sub"),
    challengeId: challenge.id,
    roundDate: round.date,
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

    // Only raise a payment request when this member has real money on the line.
    if (participant.stakeCents > 0) {
      const existing = paymentRequests.find(
        (p) =>
          p.challengeId === challenge.id &&
          p.userId === user.id &&
          p.roundDate === round.date,
      );
      if (existing) {
        paymentRequestId = existing.id;
      } else {
        const request = {
          id: nextId("pay"),
          challengeId: challenge.id,
          roundDate: round.date,
          userId: user.id,
          amountCents: participant.stakeCents,
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

  // Only the member who owes it can open their own commitment.
  const user = await getCurrentUser();
  if (request.userId !== user.id) {
    return { ok: false, error: "That payment request isn't yours." };
  }

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
 * misjudges a submission in front of judges. Restricted to the group organizer
 * — this reverses a verdict and cancels money owed, so it can't be open to
 * every member, let alone every caller who knows a submission id.
 */
export async function overrideVerdict(formData: FormData): Promise<void> {
  const submissionId = String(formData.get("submissionId") ?? "");
  const status = String(formData.get("status") ?? "") as SubmissionStatus;
  const groupId = String(formData.get("groupId") ?? "");

  const user = await getCurrentUser();
  const membership = await getMembership(groupId, user.id);
  if (membership?.role !== "organizer" && membership?.role !== "admin") return;

  const submission = submissions.find((s) => s.id === submissionId);
  if (!submission) return;

  // The submission must belong to the group the caller is an organizer of.
  const challenge = challenges.find((c) => c.id === submission.challengeId);
  if (!challenge || challenge.groupId !== groupId) return;

  submission.status = status;
  submission.agentReason = "Overridden by the group organizer.";

  if (status === "passed") {
    const request = paymentRequests.find(
      (p) =>
        p.challengeId === submission.challengeId &&
        p.userId === submission.userId &&
        p.roundDate === submission.roundDate,
    );
    if (request && request.status === "pending") request.status = "canceled";
  }

  revalidatePath(`/groups/${groupId}`);
}

/** Kept so a group can still set a challenge by hand if the agent is down. */
export async function createChallenge(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const groupId = String(formData.get("groupId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amountDollars = Number(formData.get("commitmentAmount") ?? 0);

  const user = await requireMember(groupId);
  if (!user) return { ok: false, error: "You're not a member of this group." };

  if (title.length < 3) {
    return { ok: false, error: "Describe the challenge in a few more words." };
  }
  if (!Number.isFinite(amountDollars) || amountDollars < 0) {
    return { ok: false, error: "Enter a commitment amount of $0 or more." };
  }

  const existingIndex = challenges.findIndex(
    (c) => c.groupId === groupId && c.status === "proposed",
  );
  const challenge = {
    id: nextId("chl"),
    groupId,
    title,
    description,
    status: "proposed" as const,
    dueAt: (() => {
      const d = new Date();
      d.setHours(17, 0, 0, 0);
      return d.toISOString();
    })(),
    dueHour: 17,
    startDate: localDate(),
    durationDays: 7,
    commitmentAmountCents: Math.round(amountDollars * 100),
    agentGenerated: false,
    rationale: null,
  };

  if (existingIndex >= 0) challenges.splice(existingIndex, 1, challenge);
  else challenges.push(challenge);

  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}
