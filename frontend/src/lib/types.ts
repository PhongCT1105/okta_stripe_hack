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

export interface Challenge {
  id: string;
  groupId: string;
  title: string;
  description: string;
  /** ISO 8601. Rendered as a countdown on the client to avoid SSR drift. */
  dueAt: string;
  /** Integer cents owed on a confirmed miss. */
  commitmentAmountCents: number;
  /** True when the agent proposed this challenge rather than the organizer. */
  agentGenerated: boolean;
}

export interface Submission {
  id: string;
  challengeId: string;
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
  userId: string;
  amountCents: number;
  /** Set once a Checkout Session exists. Null until Stripe is wired. */
  stripeCheckoutSessionId: string | null;
  status: PaymentStatus;
}

/** A member joined with their user record and current-challenge standing. */
export interface LeaderboardEntry {
  user: User;
  member: GroupMember;
  status: SubmissionStatus | null;
  submission: Submission | null;
  paymentRequest: PaymentRequest | null;
}
