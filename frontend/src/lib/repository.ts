import "server-only";

import { db } from "@/lib/db";
import type {
  Challenge,
  ChallengeParticipant,
  ChatMessage,
  Group,
  GroupMember,
  PaymentRequest,
  Submission,
  SubmissionStatus,
  User,
} from "@/lib/types";

type Row = Record<string, unknown>;
const iso = (value: unknown) => new Date(String(value)).toISOString();
const date = (value: unknown) => String(value).slice(0, 10);

export function mapUser(row: Row): User {
  const displayName = String(row.display_name);
  const words = displayName.trim().split(/\s+/);
  return {
    id: String(row.id),
    auth0UserId: row.auth0_id ? String(row.auth0_id) : null,
    displayName,
    initials:
      words.length > 1
        ? `${words[0][0]}${words.at(-1)?.[0]}`.toUpperCase()
        : displayName.slice(0, 2).toUpperCase(),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : undefined,
    headline: row.headline ? String(row.headline) : null,
    interests: Array.isArray(row.interests) ? row.interests.map(String) : [],
  };
}

export const mapGroup = (r: Row): Group => ({
  id: String(r.id), name: String(r.name), inviteCode: String(r.invite_code), ownerId: String(r.owner_id),
});
export const mapMember = (r: Row): GroupMember => ({
  groupId: String(r.group_id), userId: String(r.user_id),
  role: String(r.role) as GroupMember["role"], score: Number(r.score), streak: Number(r.streak),
});
export const mapChallenge = (r: Row): Challenge => ({
  id: String(r.id), groupId: String(r.group_id), title: String(r.title),
  description: String(r.description), status: String(r.status) as Challenge["status"],
  dueAt: iso(r.due_at), dueHour: Number(r.due_hour), startDate: date(r.start_date),
  durationDays: Number(r.duration_days), commitmentAmountCents: Number(r.stake_amount_cents),
  agentGenerated: Boolean(r.agent_generated), rationale: r.rationale ? String(r.rationale) : null,
});
export const mapParticipant = (r: Row): ChallengeParticipant => ({
  challengeId: String(r.challenge_id), userId: String(r.user_id),
  stakeCents: Number(r.stake_cents), joinedAt: iso(r.joined_at),
});
export const mapMessage = (r: Row): ChatMessage => ({
  id: String(r.id), groupId: String(r.group_id), role: String(r.role) as ChatMessage["role"],
  userId: r.user_id ? String(r.user_id) : null, body: String(r.body), createdAt: iso(r.created_at),
  ...(r.challenge_id ? { challengeId: String(r.challenge_id) } : {}),
});
export const mapSubmission = (r: Row): Submission => ({
  id: String(r.id), challengeId: String(r.challenge_id), roundDate: date(r.round_date),
  userId: String(r.user_id), proof: String(r.proof), status: String(r.status) as SubmissionStatus,
  agentReason: r.agent_reason ? String(r.agent_reason) : null,
  submittedAt: r.submitted_at ? iso(r.submitted_at) : null,
});
export const mapPayment = (r: Row): PaymentRequest => ({
  id: String(r.id), challengeId: String(r.challenge_id), roundDate: date(r.round_date),
  userId: String(r.user_id), amountCents: Number(r.amount_cents),
  stripeCheckoutSessionId: r.stripe_checkout_session_id ? String(r.stripe_checkout_session_id) : null,
  status: String(r.status) as PaymentRequest["status"],
});

export async function upsertAuth0User(input: {
  auth0Id: string; email: string; displayName: string; avatarUrl?: string;
}): Promise<User> {
  const [row] = await db()`
    INSERT INTO users (auth0_id, email, display_name, avatar_url)
    VALUES (${input.auth0Id}, ${input.email}, ${input.displayName}, ${input.avatarUrl ?? null})
    ON CONFLICT (auth0_id) DO UPDATE SET
      email = EXCLUDED.email, display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url, updated_at = now()
    RETURNING *`;
  return mapUser(row);
}

export async function updateUserProfile(
  id: string, displayName: string, headline: string, interests: string[],
): Promise<boolean> {
  const rows = await db()`UPDATE users SET display_name=${displayName}, headline=${headline},
    interests=${interests}, updated_at=now() WHERE id=${id} RETURNING id`;
  return rows.length === 1;
}

export async function createGroupRecord(name: string, ownerId: string): Promise<Group> {
  const prefix = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5).padEnd(5, "X");
  const [row] = await db()`WITH created AS (
    INSERT INTO groups (name, invite_code, owner_id)
    VALUES (${name}, ${prefix} || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)), ${ownerId})
    RETURNING *
  ), membership AS (
    INSERT INTO group_members (group_id, user_id, role)
    SELECT id, owner_id, 'organizer' FROM created
  ) SELECT * FROM created`;
  return mapGroup(row);
}

export async function joinGroupRecord(groupId: string, userId: string) {
  await db()`INSERT INTO group_members (group_id,user_id,role) VALUES (${groupId},${userId},'member')
    ON CONFLICT (group_id,user_id) DO NOTHING`;
}

export async function insertMessage(input: {
  groupId: string; role: ChatMessage["role"]; userId: string | null; body: string; challengeId?: string;
}) {
  await db()`INSERT INTO chat_messages(group_id,role,user_id,body,challenge_id)
    VALUES(${input.groupId},${input.role},${input.userId},${input.body},${input.challengeId ?? null})`;
}

export async function replaceProposal(input: Omit<Challenge, "id">): Promise<Challenge> {
  const sql = db();
  await sql`DELETE FROM challenges WHERE group_id=${input.groupId} AND status='proposed'`;
  const [row] = await sql`INSERT INTO challenges
    (group_id,title,description,status,stake_amount_cents,due_at,due_hour,start_date,duration_days,agent_generated,rationale)
    VALUES(${input.groupId},${input.title},${input.description},${input.status},${input.commitmentAmountCents},
      ${input.dueAt},${input.dueHour},${input.startDate},${input.durationDays},${input.agentGenerated},${input.rationale})
    RETURNING *`;
  return mapChallenge(row);
}

export async function upsertParticipant(challengeId: string, userId: string, stakeCents: number) {
  await db()`INSERT INTO challenge_participants(challenge_id,user_id,stake_cents)
    VALUES(${challengeId},${userId},${stakeCents}) ON CONFLICT(challenge_id,user_id)
    DO UPDATE SET stake_cents=EXCLUDED.stake_cents`;
}
export async function removeParticipant(challengeId: string, userId: string) {
  await db()`DELETE FROM challenge_participants WHERE challenge_id=${challengeId} AND user_id=${userId}`;
}
export async function activateChallenge(challengeId: string): Promise<number> {
  const sql = db();
  const [{ count }] = await sql`SELECT count(*)::int count FROM challenge_participants WHERE challenge_id=${challengeId}`;
  if (Number(count) >= 2) await sql`UPDATE challenges SET status='active',start_date=CURRENT_DATE WHERE id=${challengeId} AND status='proposed'`;
  return Number(count);
}

export async function persistVerdict(input: {
  challengeId: string; groupId: string; userId: string; roundDate: string; proof: string;
  status: SubmissionStatus; reason: string; stakeCents: number;
}): Promise<string | undefined> {
  const sql = db();
  if (input.status === "passed") {
    await sql`WITH previous AS (
      SELECT status FROM submissions WHERE challenge_id=${input.challengeId}
        AND user_id=${input.userId} AND round_date=${input.roundDate} FOR UPDATE
    ), saved AS (
      INSERT INTO submissions(challenge_id,user_id,round_date,proof,status,agent_reason,reviewed_at)
      VALUES(${input.challengeId},${input.userId},${input.roundDate},${input.proof},${input.status},${input.reason},now())
      ON CONFLICT(challenge_id,user_id,round_date) DO UPDATE SET proof=EXCLUDED.proof,status=EXCLUDED.status,
        agent_reason=EXCLUDED.agent_reason,submitted_at=now(),reviewed_at=now()
    ) UPDATE group_members SET
      streak=streak + CASE WHEN (SELECT status FROM previous)='passed' THEN 0 ELSE 1 END,
      score=score + CASE WHEN (SELECT status FROM previous)='passed' THEN 0 ELSE 10 END
      WHERE group_id=${input.groupId} AND user_id=${input.userId}`;
    return;
  }
  await sql`INSERT INTO submissions(challenge_id,user_id,round_date,proof,status,agent_reason,reviewed_at)
    VALUES(${input.challengeId},${input.userId},${input.roundDate},${input.proof},${input.status},${input.reason},now())
    ON CONFLICT(challenge_id,user_id,round_date) DO UPDATE SET proof=EXCLUDED.proof,status=EXCLUDED.status,
      agent_reason=EXCLUDED.agent_reason,submitted_at=now(),reviewed_at=now()`;
  // Deliberately no forfeit here. The day is still open, so this miss may not be
  // the final word — charging now would punish someone who goes on to finish.
  // settleDueRounds() collects on rounds once they are actually over.
  return;
}

/**
 * Charges for rounds that have finished without a passing submission.
 *
 * Settlement is separated from submission so a member can retry all day: only
 * the state of a round *after* it closes decides whether money moves. Rounds
 * are identified by date, so this is naturally idempotent — the partial unique
 * index on forfeits means a second run inserts nothing.
 *
 * Called when the group page loads and when the demo clock moves, rather than
 * on a schedule: a round that nobody looks at has nothing to settle yet.
 */
export async function settleDueRounds(groupId: string, today: string): Promise<void> {
  const sql = db();

  await sql`INSERT INTO wallet_entries(user_id,amount_cents,kind,memo,challenge_id,round_date)
    SELECT p.user_id, -p.stake_cents, 'forfeit', 'Missed "' || c.title || '"', c.id, d::date
    FROM challenges c
    JOIN challenge_participants p ON p.challenge_id = c.id
    CROSS JOIN generate_series(
      c.start_date,
      LEAST(${today}::date - 1, c.start_date + (c.duration_days - 1)),
      interval '1 day') d
    LEFT JOIN submissions s ON s.challenge_id = c.id AND s.user_id = p.user_id
      AND s.round_date = d::date AND s.status = 'passed'
    WHERE c.group_id = ${groupId} AND c.status = 'active' AND p.stake_cents > 0
      AND s.id IS NULL
    ON CONFLICT DO NOTHING`;

  // A streak only breaks once a day is actually over. If the most recently
  // closed round has no passing submission, the run is broken; days still open
  // are none of this query's business.
  await sql`UPDATE group_members m SET streak = 0
    FROM challenges c
    WHERE c.group_id = ${groupId} AND c.status = 'active' AND m.group_id = ${groupId}
      AND (${today}::date - 1) >= c.start_date
      AND NOT EXISTS (
        SELECT 1 FROM submissions s
        WHERE s.challenge_id = c.id AND s.user_id = m.user_id
          AND s.round_date = LEAST(${today}::date - 1, c.start_date + (c.duration_days - 1))
          AND s.status = 'passed')`;
}

export async function setCheckoutSession(requestId: string, sessionId: string) {
  await db()`UPDATE payment_requests SET stripe_checkout_session_id=${sessionId} WHERE id=${requestId}`;
}
export async function markPaymentPaid(requestId: string, sessionId: string): Promise<boolean> {
  const rows = await db()`UPDATE payment_requests SET status='paid',paid_at=now()
    WHERE id=${requestId} AND stripe_checkout_session_id=${sessionId} AND status='pending' RETURNING id`;
  return rows.length === 1;
}
export async function recordWalletEntry(input: {
  userId: string; amountCents: number; kind: string; memo: string;
  challengeId?: string; roundDate?: string; stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string; stripeRefundId?: string;
}): Promise<void> {
  await db()`INSERT INTO wallet_entries(user_id,amount_cents,kind,memo,challenge_id,round_date,
    stripe_checkout_session_id,stripe_payment_intent_id,stripe_refund_id)
    VALUES(${input.userId},${input.amountCents},${input.kind},${input.memo},
      ${input.challengeId ?? null},${input.roundDate ?? null},${input.stripeCheckoutSessionId ?? null},
      ${input.stripePaymentIntentId ?? null},${input.stripeRefundId ?? null})
    ON CONFLICT DO NOTHING`;
}
export async function getWalletEntryByCheckout(sessionId: string) {
  const [row] = await db()`SELECT amount_cents FROM wallet_entries WHERE stripe_checkout_session_id=${sessionId}`;
  return row ? Number(row.amount_cents) : null;
}
export async function overrideSubmission(id: string, groupId: string, status: SubmissionStatus) {
  const sql = db();
  const rows = await sql`UPDATE submissions s SET status=${status},agent_reason='Overridden by the group organizer.'
    FROM challenges c WHERE s.id=${id} AND c.id=s.challenge_id AND c.group_id=${groupId}
    RETURNING s.challenge_id,s.user_id,s.round_date`;
  if (status === "passed" && rows[0]) await sql`UPDATE payment_requests SET status='canceled'
    WHERE challenge_id=${rows[0].challenge_id} AND user_id=${rows[0].user_id}
      AND round_date=${rows[0].round_date} AND status='pending'`;
}
