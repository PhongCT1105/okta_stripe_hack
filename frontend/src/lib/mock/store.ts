import type {
  Challenge,
  ChallengeParticipant,
  ChatMessage,
  Group,
  GroupMember,
  PaymentRequest,
  Submission,
  User,
  WalletEntry,
} from "@/lib/types";

/**
 * In-memory demo store.
 *
 * Deliberately mutable module state: it stands in for the database until the
 * real one is wired, and mutations survive across requests within a single
 * running server process — enough for the demo. It resets on restart, which
 * is a feature during rehearsal.
 */

/** Today at a given hour, local time, as an ISO string. */
export function todayAt(hour: number): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** YYYY-MM-DD in local time. The round identifier used everywhere. */
export function localDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export const CURRENT_USER_ID = "user_phong";

/**
 * Credits every new account starts with, in integer cents.
 *
 * Generous on purpose: nobody should have to reach for a card to find out
 * whether the product is worth anything. Running dry is what sends them to
 * Stripe, and by then they've felt the loop work.
 *
 * Granted credits are not cashable — only money that actually came in through
 * Stripe can go back out through it.
 */
export const SIGNUP_GRANT_CENTS = 10_000;

/** Credit packs offered at top-up, in integer cents. */
export const TOP_UP_OPTIONS_CENTS = [2_000, 5_000, 10_000] as const;

/**
 * Goal tags offered on the profile.
 *
 * Kept to a short fixed list rather than free text so two people chasing the
 * same thing actually collide on the same value — free-form tags would splinter
 * into "leetcode", "LeetCode", "algos" and match nobody.
 */
export const INTEREST_OPTIONS = [
  "Interview prep",
  "Shipping side projects",
  "Fitness",
  "Writing",
  "Studying",
  "Reading",
] as const;

export const users: User[] = [
  {
    id: "user_phong",
    auth0UserId: null,
    displayName: "Phong",
    initials: "PC",
    headline: "Getting interview-ready without letting side projects slide",
    interests: ["Interview prep", "Shipping side projects"],
  },
  {
    id: "user_alex",
    auth0UserId: null,
    displayName: "Alex",
    initials: "AX",
    headline: "Grinding algorithms before onsites in five weeks",
    interests: ["Interview prep"],
  },
  {
    id: "user_sam",
    auth0UserId: null,
    displayName: "Sam",
    initials: "SM",
    headline: "Trying to build one habit that actually sticks",
    interests: ["Interview prep", "Fitness"],
  },
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

/**
 * Seeded conversation.
 *
 * This is the agent's input, so it is written the way a real group chat reads:
 * an intent that never quite becomes a commitment. Summoning the agent turns it
 * into one — which is the whole demo.
 */
export const chatMessages: ChatMessage[] = [
  {
    id: "msg_0001",
    groupId: "grp_builder",
    role: "member",
    userId: "user_alex",
    body: "interviews are in like 5 weeks and I have done basically zero prep",
    createdAt: minutesAgo(42),
  },
  {
    id: "msg_0002",
    groupId: "grp_builder",
    role: "member",
    userId: "user_sam",
    body: "same. I keep saying I'll grind leetcode and then just... don't",
    createdAt: minutesAgo(38),
  },
  {
    id: "msg_0003",
    groupId: "grp_builder",
    role: "member",
    userId: "user_phong",
    body: "ok what if we actually commit. 1-2 mediums a day, every day, for a week",
    createdAt: minutesAgo(31),
  },
  {
    id: "msg_0004",
    groupId: "grp_builder",
    role: "member",
    userId: "user_alex",
    body: "I'm in but only if there's money on it, otherwise I'll bail by wednesday",
    createdAt: minutesAgo(27),
  },
  {
    id: "msg_0005",
    groupId: "grp_builder",
    role: "member",
    userId: "user_sam",
    body: "$5 a miss sounds about right. enough to hurt, not enough to ruin me",
    createdAt: minutesAgo(24),
  },
];

export const challenges: Challenge[] = [];

export const challengeParticipants: ChallengeParticipant[] = [];

export const submissions: Submission[] = [];

export const paymentRequests: PaymentRequest[] = [];

/**
 * Credit ledger.
 *
 * Seeded so the demo members already hold their signup grant — a brand new
 * account gets one the moment it's created in getCurrentUser().
 */
export const walletEntries: WalletEntry[] = users.map((user, index) => ({
  id: `wal_seed_${index + 1}`,
  userId: user.id,
  amountCents: SIGNUP_GRANT_CENTS,
  kind: "signup_grant" as const,
  memo: "Welcome credits",
  createdAt: minutesAgo(120),
}));

/** Monotonic id source. Avoids Math.random so ids stay reproducible per run. */
let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter.toString().padStart(4, "0")}`;
}
