import type {
  Challenge,
  Group,
  GroupMember,
  PaymentRequest,
  Submission,
  User,
} from "@/lib/types";

/**
 * In-memory demo store.
 *
 * Deliberately mutable module state: it stands in for the database until the
 * real one is wired, and mutations survive across requests within a single
 * running server process — enough for the demo. It resets on restart, which
 * is a feature during rehearsal.
 */

/** Today at 5:00 PM local, matching the seeded "before 5:00 PM" challenge. */
function todayAt(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export const CURRENT_USER_ID = "user_phong";

export const users: User[] = [
  {
    id: "user_phong",
    auth0UserId: null,
    displayName: "Phong",
    initials: "PC",
  },
  { id: "user_alex", auth0UserId: null, displayName: "Alex", initials: "AX" },
  { id: "user_sam", auth0UserId: null, displayName: "Sam", initials: "SM" },
];

export const groups: Group[] = [
  {
    id: "grp_builder",
    name: "30-Day Builder Challenge",
    inviteCode: "BUILD30",
    ownerId: "user_phong",
  },
];

export const groupMembers: GroupMember[] = [
  {
    groupId: "grp_builder",
    userId: "user_phong",
    role: "organizer",
    streak: 5,
    score: 120,
  },
  {
    groupId: "grp_builder",
    userId: "user_alex",
    role: "member",
    streak: 3,
    score: 90,
  },
  {
    groupId: "grp_builder",
    userId: "user_sam",
    role: "member",
    streak: 0,
    score: 45,
  },
];

export const challenges: Challenge[] = [
  {
    id: "chl_leetcode",
    groupId: "grp_builder",
    title: "Complete one LeetCode problem",
    description:
      "Solve any problem end to end and paste the link or a short summary of your approach.",
    dueAt: todayAt(17),
    commitmentAmountCents: 500,
    agentGenerated: false,
  },
];

export const submissions: Submission[] = [
  {
    id: "sub_alex",
    challengeId: "chl_leetcode",
    userId: "user_alex",
    proof: "https://leetcode.com/problems/two-sum/ — solved in O(n) with a hash map.",
    status: "passed",
    agentReason:
      "Linked a specific problem and described a correct O(n) approach. Counts as complete.",
    submittedAt: todayAt(9),
  },
  {
    id: "sub_sam",
    challengeId: "chl_leetcode",
    userId: "user_sam",
    proof: "ran out of time today",
    status: "missed",
    agentReason:
      "No problem attempted and no proof provided. This does not meet the commitment.",
    submittedAt: todayAt(16),
  },
];

export const paymentRequests: PaymentRequest[] = [
  {
    id: "pay_sam",
    challengeId: "chl_leetcode",
    userId: "user_sam",
    amountCents: 500,
    stripeCheckoutSessionId: null,
    status: "pending",
  },
];

/** Monotonic id source. Avoids Math.random so ids stay reproducible per run. */
let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter.toString().padStart(4, "0")}`;
}
