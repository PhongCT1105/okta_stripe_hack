import Anthropic from "@anthropic-ai/sdk";
import {
  AGENT_TOOLS,
  runAgentTool,
  type AgentToolContext,
} from "@/lib/agent-tools";
import type { ChatMessage, User } from "@/lib/types";

/**
 * The challenge-proposing agent.
 *
 * It reads what the group actually said and turns the intent buried in it into
 * a concrete, verifiable commitment. It proposes only — it cannot start a
 * challenge, and it never touches money. Members do both by staking.
 */

export interface ChallengeProposal {
  title: string;
  description: string;
  durationDays: number;
  /** Suggested per-miss stake, in integer cents. Members can pick their own. */
  suggestedStakeCents: number;
  /** Local hour (0-23) each daily round is due. */
  dueHour: number;
  /** One or two sentences, grounded in what people said. Shown verbatim. */
  rationale: string;
  /** Whether the proposal came from the model or the offline fallback. */
  source: "model" | "fallback";
}

const MODEL = "claude-opus-5";

const SYSTEM_PROMPT = `You read a friend group's chat and turn the commitment buried in it into one concrete, verifiable daily challenge.

Rules:
- Propose exactly one challenge, and only what the group actually discussed. Do not invent a goal nobody raised.
- The challenge must be provable with an artifact: a link, a screenshot, or a video. Never propose something that can only be self-reported.
- Only two proof types can be verified automatically today. Prefer them:
  - LeetCode problems. The title MUST contain the word "LeetCode".
  - Push-ups. The title MUST contain "push-ups".
  Propose something else only if the chat is clearly about neither.
- The title is one short line a member could read at a glance. The description says exactly what counts as proof.
- If the group named a dollar amount, use it. Otherwise suggest something modest.
- Ground the rationale in what people said. Quote or paraphrase a specific message. Do not flatter the group.`;

const PROPOSAL_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        'One short line, e.g. "Complete 2 LeetCode mediums" or "Complete 10 push-ups".',
    },
    description: {
      type: "string",
      description: "What counts as proof. One or two sentences.",
    },
    durationDays: {
      type: "integer",
      description: "How many consecutive daily rounds the commitment runs for.",
    },
    suggestedStakeDollars: {
      type: "number",
      description: "Suggested stake in whole dollars, forfeited on each missed day.",
    },
    dueHour: {
      type: "integer",
      description: "Local hour of day (0-23) each round is due. Use 17 unless the chat says otherwise.",
    },
    rationale: {
      type: "string",
      description:
        "One or two sentences on why this is the right commitment, referencing what the group said.",
    },
  },
  required: [
    "title",
    "description",
    "durationDays",
    "suggestedStakeDollars",
    "dueHour",
    "rationale",
  ],
  additionalProperties: false,
} as const;

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Forces the title to carry the keyword its verifier routes on.
 *
 * Proof verification dispatches on the challenge title, so a proposal whose
 * title drifts from the proof type it describes would silently fall through to
 * the generic text heuristic. Cheaper to normalize here than to trust phrasing.
 */
function alignTitleWithVerifier(title: string, description: string): string {
  const haystack = `${title} ${description}`;
  const mentionsLeetCode = /leetcode/i.test(haystack);
  const mentionsPushUps = /push[\s-]?ups?/i.test(haystack);

  if (mentionsLeetCode && !/leetcode/i.test(title)) return `${title} (LeetCode)`;
  if (mentionsPushUps && !/push[\s-]?ups?/i.test(title)) return `${title} (push-ups)`;
  return title;
}

function transcriptFor(messages: ChatMessage[], users: User[]): string {
  const nameFor = (userId: string | null) =>
    users.find((u) => u.id === userId)?.displayName ?? "Agent";

  return messages
    .slice(-40)
    .map((m) => `${m.role === "agent" ? "Agent" : nameFor(m.userId)}: ${m.body}`)
    .join("\n");
}

/**
 * Deterministic proposal used when the model is unavailable.
 *
 * The hackathon plan calls for a deterministic fallback so a network failure
 * can't take down the demo. It reads the same chat with keyword rules instead
 * of a model, so the shape of the result is identical.
 */
export function proposeFromRules(messages: ChatMessage[]): ChallengeProposal {
  const text = messages.map((m) => m.body).join(" ");

  const dollarMatch = text.match(/\$\s?(\d{1,3})/);
  const suggestedStakeCents = dollarMatch
    ? clamp(Number(dollarMatch[1]), 1, 100, 5) * 100
    : 500;

  const dayMatch = text.match(/(\d{1,2})\s*(?:days?|day)/i);
  const durationDays = dayMatch ? clamp(Number(dayMatch[1]), 1, 30, 7) : 7;

  if (/leetcode|algorithm|interview|coding problem/i.test(text)) {
    const countMatch = text.match(/(\d)\s*(?:-\s*\d)?\s*(?:leetcode|mediums?|problems?)/i);
    const count = countMatch ? clamp(Number(countMatch[1]), 1, 5, 1) : 1;
    return {
      title: `Complete ${count} LeetCode problem${count === 1 ? "" : "s"}`,
      description:
        "Solve it end to end and submit the accepted submission link, or a screenshot showing LeetCode and an Accepted result.",
      durationDays,
      suggestedStakeCents,
      dueHour: 17,
      rationale:
        "The group talked about grinding LeetCode before interviews but never set a number. This makes it a daily count with proof attached.",
      source: "fallback",
    };
  }

  if (/push[\s-]?ups?|workout|gym|exercise/i.test(text)) {
    return {
      title: "Complete 10 push-ups",
      description:
        "Upload a side-view video. Your shoulders, elbows, wrists, and hips must stay visible so the reps can be counted.",
      durationDays,
      suggestedStakeCents,
      dueHour: 17,
      rationale:
        "The group wants a daily physical commitment. Ten push-ups on video is small enough to do every day and specific enough to verify.",
      source: "fallback",
    };
  }

  return {
    title: "Ship one visible piece of progress",
    description:
      "Post a link to what you shipped — a commit, a deploy, a document. It has to be something someone else can open.",
    durationDays,
    suggestedStakeCents,
    dueHour: 17,
    rationale:
      "The chat is about following through, without naming a specific task. This keeps the daily bar concrete while staying open-ended.",
    source: "fallback",
  };
}

/**
 * Reads the group chat and proposes a challenge.
 *
 * Calls the model, and falls back to the deterministic rules on a missing key,
 * a network failure, or a malformed response — the demo has to survive all
 * three.
 */
export async function proposeChallenge(
  messages: ChatMessage[],
  users: User[],
): Promise<ChallengeProposal> {
  const fallback = proposeFromRules(messages);
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: PROPOSAL_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: `Here is the group chat:\n\n${transcriptFor(messages, users)}\n\nPropose the challenge this group is circling around.`,
        },
      ],
    });

    if (response.stop_reason === "refusal") return fallback;

    const text = response.content.find((block) => block.type === "text")?.text;
    if (!text) return fallback;

    const parsed = JSON.parse(text) as {
      title?: string;
      description?: string;
      durationDays?: number;
      suggestedStakeDollars?: number;
      dueHour?: number;
      rationale?: string;
    };

    if (!parsed.title || !parsed.description) return fallback;

    return {
      title: alignTitleWithVerifier(parsed.title.trim(), parsed.description),
      description: parsed.description.trim(),
      durationDays: clamp(parsed.durationDays ?? 7, 1, 30, 7),
      suggestedStakeCents: clamp(parsed.suggestedStakeDollars ?? 5, 0, 100, 5) * 100,
      dueHour: clamp(parsed.dueHour ?? 17, 0, 23, 17),
      rationale: parsed.rationale?.trim() || fallback.rationale,
      source: "model",
    };
  } catch (error) {
    console.error("Challenge proposal model call failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return fallback;
  }
}

/* ------------------------------------------------------------------ *
 * Conversational agent
 * ------------------------------------------------------------------ */

export interface AgentTurnResult {
  /** What the agent says back, posted into the chat. */
  reply: string;
  /** True when a tool changed group state, so the page needs revalidating. */
  changed: boolean;
  /** True when the model was unavailable and rules stood in for it. */
  usedFallback: boolean;
}

const CONVERSATION_SYSTEM_PROMPT = `You are the accountability agent in a friend group's chat. You turn what people say into commitments they can actually be held to, and you help them keep track once a challenge is running.

What you can do, via your tools: read the group's current state, propose a challenge, revise or withdraw a proposal, and update the goal of whoever is talking to you.

How to behave:
- Call get_group_state before answering anything about how the group is doing, what is running, or who is behind. Never guess at state or invent numbers.
- Propose only what the group actually discussed. Do not invent a goal nobody raised.
- A challenge must be provable with an artifact — a link, a screenshot, or a video. Two proof types verify automatically, so prefer them: LeetCode problems (the title must contain "LeetCode") and push-ups (the title must contain "push-ups").
- If someone pushes back on the terms of an outstanding proposal, revise it rather than proposing a second one.
- When someone tells you what they are working toward, update their profile so they do not have to fill in a form. Only ever update the profile of the person talking to you.

What you cannot do, and should say plainly if asked:
- You cannot start a challenge. Members start it by staking on it — that is the approval, and it is deliberately not yours to give.
- You cannot charge anyone, waive what they owe, or move money. Payment happens only when the member who owes it approves a Stripe checkout themselves.
- You cannot stake on someone's behalf or change what they have staked.

Write like a member of the group, not a support bot. Two or three sentences. No bullet lists, no headers, no restating what you just did in full — they can see the proposal on screen. If you refused something, say why in one line.`;

/**
 * Runs one conversational turn: reads the chat, uses tools, replies.
 *
 * A manual loop rather than the SDK's tool runner, because each tool here
 * mutates shared group state and the harness needs to stay the thing that
 * decides what is allowed — the loop is where refusals, the iteration cap, and
 * the acting-user scoping live.
 */
export async function runAgentTurn(
  history: ChatMessage[],
  members: User[],
  ctx: AgentToolContext,
): Promise<AgentTurnResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return runFallbackTurn(history, ctx);
  }

  const speaker =
    members.find((m) => m.id === ctx.actingUserId)?.displayName ?? "A member";

  try {
    const client = new Anthropic();
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `Group chat so far:\n\n${transcriptFor(history, members)}\n\n${speaker} is talking to you. Respond to them.`,
      },
    ];

    let changed = false;

    // Bounded so a model that keeps calling tools can't spin. Six is enough for
    // read → act → confirm with room to recover from a refusal.
    for (let turn = 0; turn < 6; turn += 1) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: CONVERSATION_SYSTEM_PROMPT,
        output_config: { effort: "low" },
        tools: AGENT_TOOLS,
        messages,
      });

      if (response.stop_reason === "refusal") {
        return {
          reply: "I can't help with that one.",
          changed,
          usedFallback: false,
        };
      }

      const toolUses = response.content.filter(
        (block) => block.type === "tool_use",
      );

      if (toolUses.length === 0) {
        const reply = response.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim();
        return {
          reply: reply || "I'm not sure what you want me to do there.",
          changed,
          usedFallback: false,
        };
      }

      messages.push({ role: "assistant", content: response.content });

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        const outcome = await runAgentTool(
          toolUse.name,
          (toolUse.input ?? {}) as Record<string, unknown>,
          ctx,
        );
        if (outcome.changed) changed = true;
        results.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: outcome.result,
        });
      }

      messages.push({ role: "user", content: results });
    }

    return {
      reply: "I went in circles on that — try asking me a narrower question.",
      changed,
      usedFallback: false,
    };
  } catch (error) {
    console.error("Agent turn failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return runFallbackTurn(history, ctx);
  }
}

/**
 * Offline stand-in for a turn.
 *
 * Without a model there is no conversation, so it does the one thing the group
 * most likely wanted: read the chat with keyword rules and put a proposal up.
 */
async function runFallbackTurn(
  history: ChatMessage[],
  ctx: AgentToolContext,
): Promise<AgentTurnResult> {
  const proposal = proposeFromRules(history);
  const outcome = await runAgentTool(
    "propose_challenge",
    {
      title: proposal.title,
      description: proposal.description,
      durationDays: proposal.durationDays,
      suggestedStakeDollars: proposal.suggestedStakeCents / 100,
      dueHour: proposal.dueHour,
      rationale: proposal.rationale,
    },
    ctx,
  );

  return {
    reply: outcome.changed ? proposal.rationale : outcome.result,
    changed: Boolean(outcome.changed),
    usedFallback: true,
  };
}
