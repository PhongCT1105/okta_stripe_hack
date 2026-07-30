import {
  challenges,
  CURRENT_USER_ID,
  groupMembers,
  groups,
  paymentRequests,
  submissions,
  users,
} from "@/lib/mock/store";
import type {
  Challenge,
  Group,
  GroupMember,
  LeaderboardEntry,
  PaymentRequest,
  Submission,
  User,
} from "@/lib/types";

/**
 * Read side of the data layer.
 *
 * Every function is async so that swapping the mock store for a real database
 * is a change inside this file only — no component signatures move.
 */

export async function getCurrentUser(): Promise<User> {
  // Replaced by the Auth0 session lookup once auth is wired.
  const user = users.find((u) => u.id === CURRENT_USER_ID);
  if (!user) throw new Error("Seed data is missing the current user");
  return user;
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

/** The challenge currently in play for a group. One at a time, by design. */
export async function getActiveChallenge(
  groupId: string,
): Promise<Challenge | null> {
  return challenges.find((c) => c.groupId === groupId) ?? null;
}

export async function getSubmission(
  challengeId: string,
  userId: string,
): Promise<Submission | null> {
  return (
    submissions.find(
      (s) => s.challengeId === challengeId && s.userId === userId,
    ) ?? null
  );
}

export async function getPaymentRequest(
  requestId: string,
): Promise<PaymentRequest | null> {
  return paymentRequests.find((p) => p.id === requestId) ?? null;
}

/**
 * Members ranked for the leaderboard, joined with their standing on the
 * active challenge.
 *
 * Ordering: score first, then streak, then name. Name is the final tiebreak so
 * the order is stable across renders rather than depending on insertion order.
 */
export async function getLeaderboard(
  groupId: string,
): Promise<LeaderboardEntry[]> {
  const challenge = await getActiveChallenge(groupId);
  const members = groupMembers.filter((m) => m.groupId === groupId);

  const entries: LeaderboardEntry[] = [];
  for (const member of members) {
    const user = users.find((u) => u.id === member.userId);
    if (!user) continue;

    const submission = challenge
      ? (submissions.find(
          (s) => s.challengeId === challenge.id && s.userId === member.userId,
        ) ?? null)
      : null;

    const paymentRequest = challenge
      ? (paymentRequests.find(
          (p) => p.challengeId === challenge.id && p.userId === member.userId,
        ) ?? null)
      : null;

    entries.push({
      user,
      member,
      status: submission?.status ?? null,
      submission,
      paymentRequest,
    });
  }

  return entries.sort(
    (a, b) =>
      b.member.score - a.member.score ||
      b.member.streak - a.member.streak ||
      a.user.displayName.localeCompare(b.user.displayName),
  );
}
