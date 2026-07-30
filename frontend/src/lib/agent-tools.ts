import type Anthropic from "@anthropic-ai/sdk";
import {
  challengeParticipants,
  challenges,
  INTEREST_OPTIONS,
  localDate,
  nextId,
  paymentRequests,
  submissions,
  users,
} from "@/lib/mock/store";
import type { Challenge } from "@/lib/types";

/**
 * The agent's hands.
 *
 * Each tool is a narrow, named capability rather than a general "do something"
 * escape hatch, so every action the agent can take is one the harness can
 * authorize, log, and refuse. Three rules hold across all of them:
 *
 *   1. The agent proposes; members decide. Nothing here starts a challenge or
 *      commits anyone to money — that requires a member to stake.
 *   2. Every tool acts as the member who summoned it, never on someone else's
 *      behalf. `actingUserId` is supplied by the server, never by the model.
 *   3. Nothing here touches payments. Money moves only through Stripe Checkout
 *      after the member who owes it approves.
 */

export interface AgentToolContext {
  groupId: string;
  actingUserId: string;
}

export interface ToolOutcome {
  /** Returned to the model as the tool result. */
  result: string;
  /** Set when the action changed something worth showing in the UI. */
  changed?: boolean;
}

const DEFAULT_DUE_HOUR = 17;

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Forces the title to carry the keyword its verifier routes on.
 *
 * Proof verification dispatches on the challenge title, so a title that drifts
 * from the proof type it describes would silently fall through to the generic
 * text heuristic.
 */
function alignTitleWithVerifier(title: string, description: string): string {
  const haystack = `${title} ${description}`;
  if (/leetcode/i.test(haystack) && !/leetcode/i.test(title)) {
    return `${title} (LeetCode)`;
  }
  if (/push[\s-]?ups?/i.test(haystack) && !/push[\s-]?ups?/i.test(title)) {
    return `${title} (push-ups)`;
  }
  return title;
}

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_group_state",
    description:
      "Read the group's current situation: the active or proposed challenge, who has staked and how much, each member's goal and streak, and today's submissions. Call this before answering any question about how the group is doing, who is behind, or what is already running — never guess at state.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "propose_challenge",
    description:
      "Propose a new daily challenge for the group to stake on. Only call this when there is no challenge already running and no proposal outstanding — revise the existing one instead. The proposal binds nobody until members stake on it.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description:
            'One short line. Must contain "LeetCode" or "push-ups" when that is the proof type, because verification routes on the title.',
        },
        description: {
          type: "string",
          description: "What counts as proof. One or two sentences.",
        },
        durationDays: {
          type: "integer",
          description: "How many consecutive daily rounds it runs for (1-30).",
        },
        suggestedStakeDollars: {
          type: "number",
          description: "Suggested stake per missed day, in whole dollars (0-100).",
        },
        dueHour: {
          type: "integer",
          description: "Local hour each round is due, 0-23. Use 17 unless asked otherwise.",
        },
        rationale: {
          type: "string",
          description:
            "One or two sentences on why this is right, grounded in what the group actually said.",
        },
      },
      required: ["title", "description", "durationDays", "suggestedStakeDollars", "rationale"],
    },
  },
  {
    name: "revise_proposal",
    description:
      "Change an outstanding proposal that nobody has started yet — the length, the stake, the deadline, or the task itself. Use this when someone pushes back on the terms. Only supply the fields that change.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        durationDays: { type: "integer", description: "1-30." },
        suggestedStakeDollars: { type: "number", description: "0-100." },
        dueHour: { type: "integer", description: "0-23." },
        rationale: {
          type: "string",
          description: "Why the revision is right, referencing who asked for it.",
        },
      },
      required: [],
    },
  },
  {
    name: "withdraw_proposal",
    description:
      "Withdraw an outstanding proposal when the group decides against it. Cannot be used on a challenge that is already running — people have money staked on those.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Short reason, shown to the group." },
      },
      required: ["reason"],
    },
  },
  {
    name: "update_my_profile",
    description:
      "Update the goal or interests of the member who is talking to you — and only them. Call this when they say what they are working toward, so their profile reflects it without them filling in a form.",
    input_schema: {
      type: "object",
      properties: {
        headline: {
          type: "string",
          description: "One line on what they are working toward. Max 160 characters.",
        },
        interests: {
          type: "array",
          items: { type: "string", enum: [...INTEREST_OPTIONS] },
          description: "Replaces their current goal tags. Only these exact values are valid.",
        },
      },
      required: [],
    },
  },
];

function describeChallenge(challenge: Challenge): string {
  const participants = challengeParticipants.filter(
    (p) => p.challengeId === challenge.id,
  );
  const staked = participants
    .map((p) => {
      const name = users.find((u) => u.id === p.userId)?.displayName ?? "Someone";
      return `${name} at $${(p.stakeCents / 100).toFixed(0)}/miss`;
    })
    .join(", ");

  return [
    `status: ${challenge.status}`,
    `title: ${challenge.title}`,
    `description: ${challenge.description}`,
    `runs for ${challenge.durationDays} days, due ${challenge.dueHour}:00 daily`,
    `suggested stake: $${(challenge.commitmentAmountCents / 100).toFixed(0)} per missed day`,
    `staked: ${staked || "nobody yet"}`,
  ].join("\n");
}

/**
 * Runs one tool call.
 *
 * Every branch re-derives what it needs from the store rather than trusting the
 * model's account of the world, and validates its inputs — tool arguments are
 * model output, which is to say untrusted.
 */
export async function runAgentTool(
  name: string,
  input: Record<string, unknown>,
  ctx: AgentToolContext,
): Promise<ToolOutcome> {
  const active = challenges.find(
    (c) => c.groupId === ctx.groupId && c.status === "active",
  );
  const proposed = challenges.find(
    (c) => c.groupId === ctx.groupId && c.status === "proposed",
  );

  switch (name) {
    case "get_group_state": {
      const members = users.filter((u) =>
        challengeParticipants.some((p) => p.userId === u.id),
      );
      const roster = users
        .map((u) => {
          const goal = u.headline ? ` — goal: ${u.headline}` : "";
          return `${u.displayName}${goal}`;
        })
        .join("\n");

      const today = localDate();
      const todaySubmissions = active
        ? submissions
            .filter((s) => s.challengeId === active.id && s.roundDate === today)
            .map((s) => {
              const name =
                users.find((u) => u.id === s.userId)?.displayName ?? "Someone";
              return `${name}: ${s.status}`;
            })
            .join(", ")
        : "";

      const owed = paymentRequests
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + p.amountCents, 0);

      return {
        result: [
          active
            ? `ACTIVE CHALLENGE:\n${describeChallenge(active)}`
            : "No challenge is running.",
          proposed
            ? `OUTSTANDING PROPOSAL:\n${describeChallenge(proposed)}`
            : "No proposal is outstanding.",
          `MEMBERS:\n${roster}`,
          todaySubmissions ? `TODAY'S SUBMISSIONS: ${todaySubmissions}` : "",
          `UNPAID COMMITMENTS: $${(owed / 100).toFixed(2)}`,
          `Members staked on something right now: ${members.length}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      };
    }

    case "propose_challenge": {
      if (active) {
        return {
          result:
            "Refused: a challenge is already running for this group. Members have money staked on it, so a new one can't replace it.",
        };
      }
      if (proposed) {
        return {
          result:
            "Refused: a proposal is already outstanding. Use revise_proposal to change it instead of creating a second one.",
        };
      }

      const title = String(input.title ?? "").trim();
      const description = String(input.description ?? "").trim();
      if (title.length < 3 || description.length < 3) {
        return { result: "Refused: title and description are both required." };
      }

      const dueHour = clamp(input.dueHour, 0, 23, DEFAULT_DUE_HOUR);
      const dueAt = new Date();
      dueAt.setHours(dueHour, 0, 0, 0);

      const challenge: Challenge = {
        id: nextId("chl"),
        groupId: ctx.groupId,
        title: alignTitleWithVerifier(title, description),
        description,
        status: "proposed",
        dueAt: dueAt.toISOString(),
        dueHour,
        startDate: localDate(),
        durationDays: clamp(input.durationDays, 1, 30, 7),
        commitmentAmountCents: clamp(input.suggestedStakeDollars, 0, 100, 5) * 100,
        agentGenerated: true,
        rationale: String(input.rationale ?? "").trim() || null,
      };
      challenges.push(challenge);

      return {
        result: `Proposed "${challenge.title}". It's now waiting for members to stake on it.`,
        changed: true,
      };
    }

    case "revise_proposal": {
      if (!proposed) {
        return {
          result: active
            ? "Refused: the challenge is already running and can't be revised — people have staked on these terms."
            : "Refused: there's no outstanding proposal to revise.",
        };
      }

      if (input.title !== undefined) {
        proposed.title = alignTitleWithVerifier(
          String(input.title).trim(),
          proposed.description,
        );
      }
      if (input.description !== undefined) {
        proposed.description = String(input.description).trim();
      }
      if (input.durationDays !== undefined) {
        proposed.durationDays = clamp(input.durationDays, 1, 30, proposed.durationDays);
      }
      if (input.suggestedStakeDollars !== undefined) {
        proposed.commitmentAmountCents =
          clamp(input.suggestedStakeDollars, 0, 100, 5) * 100;
      }
      if (input.dueHour !== undefined) {
        proposed.dueHour = clamp(input.dueHour, 0, 23, proposed.dueHour);
        const dueAt = new Date();
        dueAt.setHours(proposed.dueHour, 0, 0, 0);
        proposed.dueAt = dueAt.toISOString();
      }
      if (input.rationale !== undefined) {
        proposed.rationale = String(input.rationale).trim() || proposed.rationale;
      }

      return {
        result: `Revised the proposal:\n${describeChallenge(proposed)}`,
        changed: true,
      };
    }

    case "withdraw_proposal": {
      if (!proposed) {
        return { result: "Refused: there's no outstanding proposal to withdraw." };
      }

      const index = challenges.indexOf(proposed);
      challenges.splice(index, 1);
      for (let i = challengeParticipants.length - 1; i >= 0; i -= 1) {
        if (challengeParticipants[i].challengeId === proposed.id) {
          challengeParticipants.splice(i, 1);
        }
      }

      return {
        result: `Withdrew the proposal. Reason given: ${String(input.reason ?? "none")}`,
        changed: true,
      };
    }

    case "update_my_profile": {
      // Scoped to the caller by construction: actingUserId comes from the
      // session, so the model has no way to name a different member here.
      const user = users.find((u) => u.id === ctx.actingUserId);
      if (!user) return { result: "Refused: couldn't find that member." };

      if (input.headline !== undefined) {
        const headline = String(input.headline).trim().slice(0, 160);
        if (headline.length >= 10) user.headline = headline;
      }
      if (Array.isArray(input.interests)) {
        user.interests = input.interests
          .map((value) => String(value))
          .filter((value) => INTEREST_OPTIONS.includes(value as never));
      }

      return {
        result: `Updated ${user.displayName}'s profile. Goal: ${user.headline ?? "unset"}. Interests: ${user.interests.join(", ") || "none"}.`,
        changed: true,
      };
    }

    default:
      return { result: `Refused: no such tool "${name}".` };
  }
}
