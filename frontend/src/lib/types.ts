/**
 * Domain types for Commitment Agent.
 *
 * These mirror the data model in the project README so the mock layer can be
 * swapped for a real database without touching a single component.
 *
 * Money is stored in integer cents everywhere. Floats are never used for
 * amounts — a $5.00 commitment is `500`. Format for display with
 * `formatMoney()` rather than doing arithmetic on the formatted string.
 */

export type MemberRole = "organizer" | "member" | "admin";

/** Where a member stands on the current challenge. */
export type SubmissionStatus =
  /** Proof submitted, the agent has not ruled yet. */
  | "reviewing"
  /** The agent accepted the proof. */
  | "passed"
  /** The agent rejected the proof, or the deadline passed with nothing submitted. */
  | "missed";

export type PaymentStatus = "pending" | "paid" | "canceled";

export interface User {
  id: string;
  /** Populated once Auth0 is wired; null for seeded demo members. */
  auth0UserId: string | null;
  displayName: string;
  /** Two-letter fallback shown when no avatar image is available. */
  initials: string;
  avatarUrl?: string;
  /**
   * One line on what this person is working toward.
   *
   * Null until they finish setting up their profile, which is what gates the
   * first-run redirect. It is also the text a future matcher would compare
   * against other members' goals.
   */
  headline: string | null;
  /** Coarse goal tags, used to match people chasing the same thing. */
  interests: string[];
}

export interface Group {
  id: string;
  name: string;
  /** Shared in the invite link: /join/<inviteCode>. */
  inviteCode: string;
  ownerId: string;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  role: MemberRole;
  /** Consecutive days met. Resets to 0 on a miss. */
  streak: number;
  /** Cumulative points; drives leaderboard order. */
  score: number;
}

/**
 * Where a challenge sits in the chat → propose → opt-in → run lifecycle.
 *
 * A `proposed` challenge is visible to the group but binds nobody. It becomes
 * `active` once enough members have staked on it.
 */
export type ChallengeStatus = "proposed" | "active";

export interface Challenge {
  id: string;
  groupId: string;
  title: string;
  description: string;
  status: ChallengeStatus;
  /**
   * ISO 8601 deadline for *today's* round. Rendered as a countdown on the
   * client to avoid SSR drift. Recomputed per round rather than stored per day.
   */
  dueAt: string;
  /**
   * The hour of day (local, 0-23) each round is due. Rounds are daily, so the
   * deadline is a time-of-day rather than a single fixed instant.
   */
  dueHour: number;
  /** YYYY-MM-DD of round 1. */
  startDate: string;
  /** How many daily rounds the commitment runs for. */
  durationDays: number;
  /** The agent's suggested per-miss stake. Members pick their own on opt-in. */
  commitmentAmountCents: number;
  /** True when the agent proposed this challenge rather than the organizer. */
  agentGenerated: boolean;
  /** Why the agent proposed this, quoted from the chat. Shown on the proposal. */
  rationale: string | null;
}

/**
 * A member's opt-in to a challenge.
 *
 * The stake *is* the approval: you are in this challenge because you put money
 * on it. Members who never opt in simply aren't part of this run.
 */
export interface ChallengeParticipant {
  challengeId: string;
  userId: string;
  /** Integer cents owed for each round this member misses. */
  stakeCents: number;
  joinedAt: string;
}

/** One day of a running challenge. Derived from the challenge, never stored. */
export interface Round {
  challengeId: string;
  /** YYYY-MM-DD. Identifies the round in submissions and payment requests. */
  date: string;
  /** 1-based position in the run. */
  index: number;
  dueAt: string;
}

export type ChatRole = "member" | "agent";

export interface ChatMessage {
  id: string;
  groupId: string;
  role: ChatRole;
  /** Null for agent messages. */
  userId: string | null;
  body: string;
  createdAt: string;
  /** Set when this message announces a challenge proposal. */
  challengeId?: string;
}

export interface Submission {
  id: string;
  challengeId: string;
  /** YYYY-MM-DD of the round this proves. One submission per member per round. */
  roundDate: string;
  userId: string;
  /** URL, OCR evidence, pose evidence, or free-text fallback. */
  proof: string;
  status: SubmissionStatus;
  /** The agent's plain-language justification. Shown verbatim to the user. */
  agentReason: string | null;
  submittedAt: string | null;
}

export interface PaymentRequest {
  id: string;
  challengeId: string;
  /** YYYY-MM-DD of the missed round this settles. */
  roundDate: string;
  userId: string;
  amountCents: number;
  /** Set once a Checkout Session exists. Null until Stripe is wired. */
  stripeCheckoutSessionId: string | null;
  status: PaymentStatus;
}

/** A member joined with their user record and current-round standing. */
export interface LeaderboardEntry {
  user: User;
  member: GroupMember;
  status: SubmissionStatus | null;
  submission: Submission | null;
  paymentRequest: PaymentRequest | null;
  /** Null when this member hasn't opted into the active challenge. */
  participant: ChallengeParticipant | null;
}
