"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { evaluateProof } from "@/lib/agent";
import { MEMBERS_REQUIRED_TO_START } from "@/lib/config";
import { runAgentTurn } from "@/lib/chat-agent";
import { getDemoDayOffset, isDemoMode, setDemoDayOffset } from "@/lib/demo-clock";
import {
  getActiveChallenge,
  getChallenge,
  getChatMessages,
  getCurrentRound,
  getCurrentUser,
  getGroupByInviteCode,
  getMembership,
  getParticipant,
  getPaymentRequest,
  getProposedChallenge,
  getUsers,
  getRefundableCents,
  getRefundableTopUps,
  getWalletBalance,
  isProfileComplete,
  INTEREST_OPTIONS,
  localDate,
  TOP_UP_OPTIONS_CENTS,
} from "@/lib/data";
import {
  activateChallenge, createGroupRecord, insertMessage, joinGroupRecord,
  overrideSubmission, persistVerdict, removeParticipant,
  recordWalletEntry, replaceProposal, setCheckoutSession, updateUserProfile, upsertParticipant,
} from "@/lib/repository";
import {
  createCommitmentCheckout,
  createTopUpCheckout,
  refundTopUp,
} from "@/lib/stripe";
import type { ProofMedia, SubmissionStatus, User } from "@/lib/types";


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

export async function createGroup(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3) {
    return { ok: false, error: "Give your group a name of at least 3 characters." };
  }

  const user = await getCurrentUser();
  const group = await createGroupRecord(name, user.id);

  revalidatePath("/groups");
  redirect(`/groups/${group.id}`);
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
  await joinGroupRecord(group.id, user.id);

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
  const wasFirstRun = !isProfileComplete(user);
  if (!(await updateUserProfile(user.id, displayName, headline.slice(0, 160), interests))) {
    return { ok: false, error: "We couldn't find your account." };
  }

  revalidatePath("/profile");
  revalidatePath("/groups");
  // The header renders the name and avatar on every signed-in page, so a
  // rename has to invalidate the whole shell, not just the two routes above.
  revalidatePath("/", "layout");

  // First-time setup exists to unblock the rest of the app, so send them on the
  // moment it succeeds rather than leaving them on a form with nothing left to
  // do. Editing an existing profile stays put and just confirms the save.
  if (wasFirstRun) redirect("/groups");
  return { ok: true };
}

/** An @-mention of the agent, and only at a word boundary. */
const AGENT_MENTION = /(^|\s)@agent\b/i;

/**
 * Runs one agent turn and posts its reply into the chat.
 *
 * Shared by the @-mention path and the button so both behave identically — the
 * agent has one way in, whichever way you summoned it.
 */
async function respondAsAgent(groupId: string, actingUserId: string) {
  const history = await getChatMessages(groupId);
  const turn = await runAgentTurn(history, await getUsers(), { groupId, actingUserId });
  const proposed = await getProposedChallenge(groupId);
  await insertMessage({
    groupId,
    role: "agent",
    userId: null,
    body: turn.reply,
    challengeId: proposed?.id,
  });

  return turn;
}

/**
 * Posts a message to the group chat, and answers if the agent was addressed.
 *
 * The agent doesn't watch the thread — it replies when someone says @agent.
 * Keeping the trigger explicit means no surprise proposals, and one model call
 * per intentional ask rather than one per message.
 */
export async function sendMessage(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const groupId = String(formData.get("groupId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (body.length === 0) return { ok: false };

  const user = await requireMember(groupId);
  if (!user) return { ok: false, error: "You're not a member of this group." };

  await insertMessage({
    groupId,
    role: "member",
    userId: user.id,
    body: body.slice(0, 1000),
  });

  if (AGENT_MENTION.test(body)) {
    try {
      await respondAsAgent(groupId, user.id);
    } catch (error) {
      // The member's own message is already posted and shouldn't be lost just
      // because the agent couldn't answer.
      console.error("Agent failed to answer a mention", {
        groupId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

/**
 * Summons the agent without addressing it in a message.
 *
 * Same turn the @-mention runs — the button is just a discoverable way in for
 * people who don't know the mention exists yet.
 */
export async function summonAgent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const groupId = String(formData.get("groupId") ?? "");

  const user = await requireMember(groupId);
  if (!user) return { ok: false, error: "You're not a member of this group." };

  const history = await getChatMessages(groupId);
  if (history.length === 0) {
    return { ok: false, error: "Talk about what you want to commit to first." };
  }

  try {
    await respondAsAgent(groupId, user.id);
  } catch (error) {
    console.error("Agent turn failed", {
      groupId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { ok: false, error: "The agent couldn't respond. Try again." };
  }

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

  const challenge = await getChallenge(challengeId);
  if (!challenge) return { ok: false, error: "That proposal no longer exists." };

  const user = await requireMember(challenge.groupId);
  if (!user) return { ok: false, error: "You're not a member of this group." };

  if (!Number.isFinite(stakeDollars) || stakeDollars < 0 || stakeDollars > 100) {
    return { ok: false, error: "Pick a stake between $0 and $100." };
  }

  await upsertParticipant(challengeId, user.id, Math.round(stakeDollars * 100));
  const count = await activateChallenge(challengeId);

  if (challenge.status === "proposed" && count >= MEMBERS_REQUIRED_TO_START) {
    await insertMessage({
      groupId: challenge.groupId,
      role: "agent",
      userId: null,
      body: `${count} of you are in, so "${challenge.title}" starts today and runs for ${challenge.durationDays} days. I'll check each day's proof.`,
      challengeId,
    });
  }

  revalidatePath(`/groups/${challenge.groupId}`);
  return { ok: true };
}

/**
 * Whether the demo clock controls are switched on.
 *
 * Off unless explicitly enabled, because moving time is not something a real
 * deployment should offer — a member could skip past a deadline they were about
 * to miss.
 */
export async function isDemoModeEnabled(): Promise<boolean> {
  return isDemoMode();
}

/** Steps the demo clock forward one day. */
export async function advanceDemoDay(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isDemoModeEnabled())) {
    return { ok: false, error: "Demo controls are off." };
  }

  const groupId = String(formData.get("groupId") ?? "");
  const user = await requireMember(groupId);
  if (!user) return { ok: false, error: "You're not a member of this group." };

  setDemoDayOffset(getDemoDayOffset() + 1);

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Puts the demo clock back on real time. */
export async function resetDemoDay(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await isDemoModeEnabled())) {
    return { ok: false, error: "Demo controls are off." };
  }

  const groupId = String(formData.get("groupId") ?? "");
  const user = await requireMember(groupId);
  if (!user) return { ok: false, error: "You're not a member of this group." };

  setDemoDayOffset(0);

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Formats integer cents for a ledger memo. */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Drops the caller out of a proposal without killing it for everyone else. */
export async function declineChallenge(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const challengeId = String(formData.get("challengeId") ?? "");

  const challenge = await getChallenge(challengeId);
  if (!challenge) return { ok: false, error: "That proposal no longer exists." };

  const user = await requireMember(challenge.groupId);
  if (!user) return { ok: false, error: "You're not a member of this group." };

  await removeParticipant(challengeId, user.id);

  revalidatePath(`/groups/${challenge.groupId}`);
  return { ok: true };
}

/**
 * Reads the frames the browser extracted, treating them as untrusted input.
 *
 * A server action is a public POST endpoint, so nothing here assumes the
 * payload came from our form. Anything malformed is dropped rather than
 * rejected: the agent still has the written proof to rule on.
 */
function parseProofMedia(raw: FormDataEntryValue | null): ProofMedia | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ProofMedia>;
    if (parsed.kind !== "image" && parsed.kind !== "video") return null;
    if (!Array.isArray(parsed.frames)) return null;

    const frames = parsed.frames
      .filter((frame): frame is string => typeof frame === "string")
      .filter((frame) => /^[A-Za-z0-9+/=]+$/.test(frame));
    if (frames.length === 0) return null;

    return {
      kind: parsed.kind,
      frames,
      durationSeconds:
        typeof parsed.durationSeconds === "number" && Number.isFinite(parsed.durationSeconds)
          ? parsed.durationSeconds
          : undefined,
    };
  } catch {
    return null;
  }
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
  const media = parseProofMedia(formData.get("media"));

  if (proof.length === 0) {
    return { ok: false, error: "Add a link or a short note describing what you did." };
  }

  const user = await requireMember(groupId);
  if (!user) return { ok: false, error: "You're not a member of this group." };

  const challenge = await getActiveChallenge(groupId);
  if (!challenge) return { ok: false, error: "This group has no active challenge." };

  const round = getCurrentRound(challenge);
  if (!round) return { ok: false, error: "This challenge isn't running today." };

  const participant = await getParticipant(challenge.id, user.id);
  if (!participant) {
    return { ok: false, error: "You didn't stake on this challenge." };
  }

  const verdict = await evaluateProof(challenge.title, proof, {
    description: challenge.description,
    media,
  });

  const paymentRequestId = await persistVerdict({
    challengeId: challenge.id, groupId, userId: user.id, roundDate: round.date,
    proof, status: verdict.status, reason: verdict.reason, stakeCents: participant.stakeCents,
  });

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/wallet");
  // A miss spends credits, and the balance lives in the header — which sits in
  // the layout and would otherwise keep whatever it rendered before the verdict.
  revalidatePath("/", "layout");

  return {
    ok: true,
    status: verdict.status,
    reason: verdict.reason,
    paymentRequestId,
  };
}

/**
 * Sends the member to Stripe to buy credits.
 *
 * The amount is checked against the offered packs rather than trusted from the
 * form — this is a public POST endpoint, and the price is not the client's to
 * choose.
 */
export async function startTopUp(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const amountCents = Number(formData.get("amountCents") ?? 0);
  if (!TOP_UP_OPTIONS_CENTS.includes(amountCents as never)) {
    return { ok: false, error: "Pick one of the listed credit packs." };
  }

  const user = await getCurrentUser();

  let checkoutUrl: string;
  try {
    const session = await createTopUpCheckout(user.id, amountCents);
    if (!session.url) {
      return { ok: false, error: "Stripe did not return a Checkout URL." };
    }
    checkoutUrl = session.url;
  } catch (error) {
    console.error("Unable to create top-up Checkout Session", {
      userId: user.id,
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
 * Cashes credits back out through Stripe.
 *
 * Refunds against the member's own top-ups, oldest first, because that is
 * literally where the money came from. Two things are therefore not cashable
 * and the cap enforces both: welcome credits, which nobody paid for, and
 * anything already forfeited or previously withdrawn.
 */
export async function cashOut(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const requestedCents = Math.round(Number(formData.get("amountDollars") ?? 0) * 100);
  if (!Number.isFinite(requestedCents) || requestedCents <= 0) {
    return { ok: false, error: "Enter an amount to cash out." };
  }

  const user = await getCurrentUser();
  const balance = await getWalletBalance(user.id);
  const refundable = await getRefundableCents(user.id);
  const cap = Math.min(balance, refundable);

  if (cap <= 0) {
    return {
      ok: false,
      error:
        "Nothing to cash out. Only credits you bought through Stripe can be withdrawn.",
    };
  }
  if (requestedCents > cap) {
    return {
      ok: false,
      error: `You can cash out up to ${formatCents(cap)} right now.`,
    };
  }

  // Draw down each top-up in turn until the request is covered. A single
  // withdrawal can span several purchases, so this may issue more than one
  // refund — each one is a separate Stripe transaction, as it should be.
  let remaining = requestedCents;
  const sources = await getRefundableTopUps(user.id);

  for (const source of sources) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, source.remainingCents);
    if (take <= 0) continue;

    try {
      const refund = await refundTopUp(source.paymentIntentId, take, user.id);
      await recordWalletEntry({
        userId: user.id,
        amountCents: -take,
        kind: "cash_out",
        memo: "Cashed out to your card",
        stripePaymentIntentId: source.paymentIntentId,
        stripeRefundId: refund.id,
      });
      remaining -= take;
    } catch (error) {
      console.error("Refund failed during cash-out", {
        userId: user.id,
        paymentIntentId: source.paymentIntentId,
        error: error instanceof Error ? error.message : "Unknown Stripe error",
      });
      // Whatever already refunded stays recorded — the ledger reflects the
      // money that actually moved, not the amount we hoped to move.
      break;
    }
  }

  if (remaining === requestedCents) {
    return { ok: false, error: "Stripe couldn't process the refund. Try again." };
  }

  revalidatePath("/wallet");
  revalidatePath("/", "layout");
  return { ok: true };
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
  const request = await getPaymentRequest(requestId);
  if (!request) return { ok: false, error: "That payment request no longer exists." };

  // Only the member who owes it can open their own commitment.
  const user = await getCurrentUser();
  if (request.userId !== user.id) {
    return { ok: false, error: "That payment request isn't yours." };
  }

  const challenge = await getChallenge(request.challengeId);
  if (!challenge) return { ok: false, error: "The related challenge no longer exists." };

  let checkoutUrl: string;
  try {
    const session = await createCommitmentCheckout(request, challenge.title);
    if (!session.url) {
      return { ok: false, error: "Stripe did not return a Checkout URL." };
    }

    await setCheckoutSession(request.id, session.id);
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

  await overrideSubmission(submissionId, groupId, status);

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

  const challenge = {
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

  await replaceProposal(challenge);

  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}
