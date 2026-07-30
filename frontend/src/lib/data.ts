import { getOptionalSession } from "@/lib/auth0";
import {
  challengeParticipants,
  challenges,
  chatMessages,
  CURRENT_USER_ID,
  groupMembers,
  groups,
  localDate,
  nextId,
  paymentRequests,
  submissions,
  users,
} from "@/lib/mock/store";
import type {
  Challenge,
  ChallengeParticipant,
  ChatMessage,
  Group,
  GroupMember,
  LeaderboardEntry,
  PaymentRequest,
  Round,
  Submission,
  User,
} from "@/lib/types";

/**
 * Read side of the data layer.
 *
 * Every function is async so that swapping the mock store for a real database
 * is a change inside this file only — no component signatures move.
 */

/** Two-letter fallback shown when Auth0 gives us no avatar. */
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * The signed-in application user.
 *
 * Auth0 answers *who* this is; the application store answers *what they can
 * see*. The two are joined on `auth0UserId`, and a first-time login creates the
 * matching application user here rather than in a separate provisioning step.
 *
 * Falls back to the seeded demo user only when Auth0 is unconfigured, which
 * `getOptionalSession` already restricts to local development.
 */
export async function getCurrentUser(): Promise<User> {
  const session = await getOptionalSession();

  if (!session?.user?.sub) {
    const seeded = users.find((u) => u.id === CURRENT_USER_ID);
    if (!seeded) throw new Error("Seed data is missing the current user");
    return seeded;
  }

  const auth0UserId = session.user.sub;
  const existing = users.find((u) => u.auth0UserId === auth0UserId);
  const displayName =
    session.user.given_name ||
    session.user.nickname ||
    session.user.name ||
    session.user.email ||
    "Member";

  if (existing) {
    // Profile details can change between logins; the id never does.
    existing.displayName = displayName;
    existing.initials = initialsFor(displayName);
    existing.avatarUrl = session.user.picture;
    return existing;
  }

  const user: User = {
    id: nextId("user"),
    auth0UserId,
    displayName,
    initials: initialsFor(displayName),
    avatarUrl: session.user.picture,
    // Auth0 knows their name, not their goal. They fill that in themselves.
    headline: null,
    interests: [],
  };
  users.push(user);
  return user;
}

/**
 * Whether this user has finished setting up.
 *
 * Auth0 gives us an identity on first login, but not a goal — and a goal is
 * what the group and any future matching are built on. Until it's set, the
 * account exists but the person hasn't said what they're here for.
 */
export function isProfileComplete(user: User): boolean {
  return Boolean(user.headline && user.headline.trim().length > 0);
}

export async function getSignInState(): Promise<{ signedIn: boolean }> {
  const session = await getOptionalSession();
  return { signedIn: Boolean(session?.user?.sub) };
}

export async function getUser(userId: string): Promise<User | null> {
  return users.find((u) => u.id === userId) ?? null;
}

export async function getGroupsForUser(userId: string): Promise<Group[]> {
  const memberOf = new Set(
    groupMembers.filter((m) => m.userId === userId).map((m) => m.groupId),
  );
  return groups.filter((g) => memberOf.has(g.id));
}

export async function getGroup(groupId: string): Promise<Group | null> {
  return groups.find((g) => g.id === groupId) ?? null;
}

export async function getGroupByInviteCode(code: string): Promise<Group | null> {
  const normalized = code.trim().toUpperCase();
  return groups.find((g) => g.inviteCode === normalized) ?? null;
}

export async function getMembership(
  groupId: string,
  userId: string,
): Promise<GroupMember | null> {
  return (
    groupMembers.find((m) => m.groupId === groupId && m.userId === userId) ??
    null
  );
}

export async function getChatMessages(groupId: string): Promise<ChatMessage[]> {
  return chatMessages
    .filter((m) => m.groupId === groupId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The challenge currently in play for a group. One at a time, by design. */
export async function getActiveChallenge(
  groupId: string,
): Promise<Challenge | null> {
  return (
    challenges.find((c) => c.groupId === groupId && c.status === "active") ??
    null
  );
}

/** An agent proposal awaiting opt-ins, if one is outstanding. */
export async function getProposedChallenge(
  groupId: string,
): Promise<Challenge | null> {
  return (
    challenges.find((c) => c.groupId === groupId && c.status === "proposed") ??
    null
  );
}

export async function getChallenge(
  challengeId: string,
): Promise<Challenge | null> {
  return challenges.find((c) => c.id === challengeId) ?? null;
}

export async function getParticipants(
  challengeId: string,
): Promise<ChallengeParticipant[]> {
  return challengeParticipants.filter((p) => p.challengeId === challengeId);
}

export async function getParticipant(
  challengeId: string,
  userId: string,
): Promise<ChallengeParticipant | null> {
  return (
    challengeParticipants.find(
      (p) => p.challengeId === challengeId && p.userId === userId,
    ) ?? null
  );
}

/**
 * Today's round, or null if the run hasn't started or has finished.
 *
 * Rounds are derived rather than stored: a challenge is a start date plus a
 * duration, so "which round is it" is a function of the calendar. That keeps a
 * scheduler out of the system entirely — the round exists because the day does.
 */
export function getCurrentRound(challenge: Challenge): Round | null {
  const today = localDate();
  const start = new Date(`${challenge.startDate}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  const dayMs = 24 * 60 * 60 * 1000;
  const elapsed = Math.round((now.getTime() - start.getTime()) / dayMs);

  if (elapsed < 0 || elapsed >= challenge.durationDays) return null;

  const due = new Date(`${today}T00:00:00`);
  due.setHours(challenge.dueHour, 0, 0, 0);

  return {
    challengeId: challenge.id,
    date: today,
    index: elapsed + 1,
    dueAt: due.toISOString(),
  };
}

export async function getSubmission(
  challengeId: string,
  userId: string,
  roundDate: string,
): Promise<Submission | null> {
  return (
    submissions.find(
      (s) =>
        s.challengeId === challengeId &&
        s.userId === userId &&
        s.roundDate === roundDate,
    ) ?? null
  );
}

export async function getPaymentRequest(
  requestId: string,
): Promise<PaymentRequest | null> {
  return paymentRequests.find((p) => p.id === requestId) ?? null;
}

/** Everything the group has at stake on the active challenge. */
export async function getStakeSummary(challenge: Challenge | null) {
  if (!challenge) {
    return { participantCount: 0, potCents: 0, atRiskCents: 0, collectedCents: 0 };
  }

  const participants = challengeParticipants.filter(
    (p) => p.challengeId === challenge.id,
  );
  const perRound = participants.reduce((sum, p) => sum + p.stakeCents, 0);
  const requests = paymentRequests.filter((p) => p.challengeId === challenge.id);

  return {
    participantCount: participants.length,
    /** Total exposure if everyone missed every remaining round. */
    potCents: perRound * challenge.durationDays,
    atRiskCents: requests
      .filter((r) => r.status === "pending")
      .reduce((sum, r) => sum + r.amountCents, 0),
    collectedCents: requests
      .filter((r) => r.status === "paid")
      .reduce((sum, r) => sum + r.amountCents, 0),
  };
}

/**
 * Members ranked for the leaderboard, joined with their standing on the
 * current round.
 *
 * Ordering: score first, then streak, then name. Name is the final tiebreak so
 * the order is stable across renders rather than depending on insertion order.
 */
export async function getLeaderboard(
  groupId: string,
): Promise<LeaderboardEntry[]> {
  const challenge = await getActiveChallenge(groupId);
  const round = challenge ? getCurrentRound(challenge) : null;
  const members = groupMembers.filter((m) => m.groupId === groupId);

  const entries: LeaderboardEntry[] = [];
  for (const member of members) {
    const user = users.find((u) => u.id === member.userId);
    if (!user) continue;

    const submission =
      challenge && round
        ? (submissions.find(
            (s) =>
              s.challengeId === challenge.id &&
              s.userId === member.userId &&
              s.roundDate === round.date,
          ) ?? null)
        : null;

    const paymentRequest =
      challenge && round
        ? (paymentRequests.find(
            (p) =>
              p.challengeId === challenge.id &&
              p.userId === member.userId &&
              p.roundDate === round.date,
          ) ?? null)
        : null;

    const participant = challenge
      ? (challengeParticipants.find(
          (p) => p.challengeId === challenge.id && p.userId === member.userId,
        ) ?? null)
      : null;

    entries.push({
      user,
      member,
      status: submission?.status ?? null,
      submission,
      paymentRequest,
      participant,
    });
  }

  return entries.sort(
    (a, b) =>
      b.member.score - a.member.score ||
      b.member.streak - a.member.streak ||
      a.user.displayName.localeCompare(b.user.displayName),
  );
}
