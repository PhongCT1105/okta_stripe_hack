import { getOptionalSession } from "@/lib/auth0";
import { db } from "@/lib/db";
import {
  mapChallenge, mapGroup, mapMember, mapMessage, mapParticipant,
  mapPayment, mapSubmission, mapUser, upsertAuth0User,
} from "@/lib/repository";
import type {
  Challenge, ChallengeParticipant, ChatMessage, Group,
  LeaderboardEntry, Round, User,
} from "@/lib/types";

export const INTEREST_OPTIONS = [
  "Interview prep", "Shipping side projects", "Fitness", "Writing", "Studying", "Reading",
] as const;

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function getCurrentUser(): Promise<User> {
  const session = await getOptionalSession();
  if (!session?.user?.sub) {
    if (process.env.NODE_ENV !== "production" && process.env.DEV_AUTH0_SUB) {
      return upsertAuth0User({
        auth0Id: process.env.DEV_AUTH0_SUB,
        email: process.env.DEV_USER_EMAIL ?? "developer@localhost",
        displayName: process.env.DEV_USER_NAME ?? "Developer",
      });
    }
    throw new Error("A signed-in Auth0 session is required");
  }
  const displayName = session.user.given_name || session.user.nickname ||
    session.user.name || session.user.email || "Member";
  return upsertAuth0User({
    auth0Id: session.user.sub,
    email: session.user.email || `${session.user.sub.replace(/[^a-zA-Z0-9]/g, "_")}@auth0.local`,
    displayName,
    avatarUrl: session.user.picture,
  });
}
export function isProfileComplete(user: User) { return Boolean(user.headline?.trim()); }
export async function getSignInState() {
  const session = await getOptionalSession();
  return { signedIn: Boolean(session?.user?.sub) };
}
export async function getUser(id: string) {
  const [r] = await db()`SELECT * FROM users WHERE id=${id}`;
  return r ? mapUser(r) : null;
}
export async function getUsers(): Promise<User[]> {
  return (await db()`SELECT * FROM users ORDER BY display_name`).map(mapUser);
}
export async function getGroupsForUser(id: string): Promise<Group[]> {
  return (await db()`SELECT g.* FROM groups g JOIN group_members m ON m.group_id=g.id
    WHERE m.user_id=${id} ORDER BY g.created_at DESC`).map(mapGroup);
}
export async function getGroup(id: string) {
  const [r] = await db()`SELECT * FROM groups WHERE id=${id}`; return r ? mapGroup(r) : null;
}
export async function getGroupByInviteCode(code: string) {
  const [r] = await db()`SELECT * FROM groups WHERE invite_code=${code.trim().toUpperCase()}`;
  return r ? mapGroup(r) : null;
}
export async function getMembership(groupId: string, userId: string) {
  const [r] = await db()`SELECT * FROM group_members WHERE group_id=${groupId} AND user_id=${userId}`;
  return r ? mapMember(r) : null;
}
export async function getChatMessages(groupId: string): Promise<ChatMessage[]> {
  return (await db()`SELECT * FROM chat_messages WHERE group_id=${groupId} ORDER BY created_at`).map(mapMessage);
}
export async function getActiveChallenge(groupId: string) {
  const [r] = await db()`SELECT * FROM challenges WHERE group_id=${groupId} AND status='active'
    ORDER BY created_at DESC LIMIT 1`; return r ? mapChallenge(r) : null;
}
export async function getProposedChallenge(groupId: string) {
  const [r] = await db()`SELECT * FROM challenges WHERE group_id=${groupId} AND status='proposed'
    ORDER BY created_at DESC LIMIT 1`; return r ? mapChallenge(r) : null;
}
export async function getChallenge(id: string) {
  const [r] = await db()`SELECT * FROM challenges WHERE id=${id}`; return r ? mapChallenge(r) : null;
}
export async function getParticipants(id: string): Promise<ChallengeParticipant[]> {
  return (await db()`SELECT * FROM challenge_participants WHERE challenge_id=${id}`).map(mapParticipant);
}
export async function getParticipant(challengeId: string, userId: string) {
  const [r] = await db()`SELECT * FROM challenge_participants WHERE challenge_id=${challengeId} AND user_id=${userId}`;
  return r ? mapParticipant(r) : null;
}
export function getCurrentRound(challenge: Challenge): Round | null {
  const today = localDate(), start = new Date(`${challenge.startDate}T00:00:00`);
  const elapsed = Math.round((new Date(`${today}T00:00:00`).getTime() - start.getTime()) / 86400000);
  if (elapsed < 0 || elapsed >= challenge.durationDays) return null;
  const due = new Date(`${today}T00:00:00`); due.setHours(challenge.dueHour);
  return { challengeId: challenge.id, date: today, index: elapsed + 1, dueAt: due.toISOString() };
}
export async function getSubmission(challengeId: string, userId: string, roundDate: string) {
  const [r] = await db()`SELECT * FROM submissions WHERE challenge_id=${challengeId}
    AND user_id=${userId} AND round_date=${roundDate}`;
  return r ? mapSubmission(r) : null;
}
export async function getPaymentRequest(id: string) {
  const [r] = await db()`SELECT * FROM payment_requests WHERE id=${id}`; return r ? mapPayment(r) : null;
}
export async function getStakeSummary(challenge: Challenge | null) {
  if (!challenge) return { participantCount: 0, potCents: 0, atRiskCents: 0, collectedCents: 0 };
  const [r] = await db()`SELECT
    (SELECT count(*)::int FROM challenge_participants WHERE challenge_id=${challenge.id}) participant_count,
    (SELECT coalesce(sum(stake_cents),0)::int FROM challenge_participants WHERE challenge_id=${challenge.id}) per_round,
    coalesce(sum(amount_cents) FILTER (WHERE status='pending'),0)::int at_risk,
    coalesce(sum(amount_cents) FILTER (WHERE status='paid'),0)::int collected
    FROM payment_requests WHERE challenge_id=${challenge.id}`;
  return { participantCount: Number(r.participant_count), potCents: Number(r.per_round) * challenge.durationDays,
    atRiskCents: Number(r.at_risk), collectedCents: Number(r.collected) };
}
export async function getLeaderboard(groupId: string): Promise<LeaderboardEntry[]> {
  const challenge = await getActiveChallenge(groupId), round = challenge ? getCurrentRound(challenge) : null;
  const rows = await db()`SELECT m.*,u.id u_id,u.auth0_id,u.display_name,u.avatar_url,u.headline,u.interests
    FROM group_members m JOIN users u ON u.id=m.user_id WHERE m.group_id=${groupId}
    ORDER BY m.score DESC,m.streak DESC,u.display_name`;
  return Promise.all(rows.map(async r => {
    const user = mapUser({ ...r, id: r.u_id });
    const submission = challenge && round ? await getSubmission(challenge.id, user.id, round.date) : null;
    const [pr] = challenge && round ? await db()`SELECT * FROM payment_requests WHERE challenge_id=${challenge.id}
      AND user_id=${user.id} AND round_date=${round.date}` : [];
    return { user, member: mapMember(r), status: submission?.status ?? null, submission,
      paymentRequest: pr ? mapPayment(pr) : null,
      participant: challenge ? await getParticipant(challenge.id, user.id) : null };
  }));
}
