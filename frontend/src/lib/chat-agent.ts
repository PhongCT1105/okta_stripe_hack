import Anthropic from "@anthropic-ai/sdk";
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
