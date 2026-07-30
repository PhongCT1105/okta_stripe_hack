import Anthropic from "@anthropic-ai/sdk";
import type { ProofMedia, SubmissionStatus } from "@/lib/types";

export interface AgentVerdict {
  status: Extract<SubmissionStatus, "passed" | "missed">;
  /** Plain-language justification, shown to the user verbatim. */
  reason: string;
}

interface PushUpEvidence {
  count: number;
  analyzedFrames: number;
  confidentFrames: number;
}

/**
 * What a deterministic verifier learned, and what it would rule on its own.
 *
 * The evidence line is written for the model to read: it is the one thing the
 * agent knows that looking at the frames cannot tell it — a rep count measured
 * by pose detection, or text lifted off a screenshot by OCR.
 */
interface DeterministicResult {
  verdict: AgentVerdict;
  evidence: string;
}

const MODEL = "claude-opus-5";

const PUSH_UP_PREFIX = "PUSHUP_EVIDENCE:";
const LEETCODE_SCREENSHOT_PREFIX = "LEETCODE_SCREENSHOT_EVIDENCE:";

/** Defensive caps: the frames arrive from the browser and cost money to read. */
const MAX_FRAMES = 12;
const MAX_FRAME_BYTES = 1_500_000;

function missed(reason: string): AgentVerdict {
  return { status: "missed", reason };
}

function passed(reason: string): AgentVerdict {
  return { status: "passed", reason };
}

/* ------------------------------------------------------------------ *
 * Deterministic verifiers
 *
 * These run first and always. They are the documented offline fallback, and
 * when the model is available their findings become evidence rather than the
 * ruling — pose detection can count reps but cannot tell push-ups from a
 * plank, and OCR can read "Accepted" but not notice it was pasted in.
 * ------------------------------------------------------------------ */

async function verifyLeetCodeProof(proof: string): Promise<DeterministicResult> {
  if (proof.startsWith(LEETCODE_SCREENSHOT_PREFIX)) {
    const text = proof.slice(LEETCODE_SCREENSHOT_PREFIX.length);
    const isLeetCode = /\bleetcode\b/i.test(text);
    const isAccepted = /\baccepted\b/i.test(text) && !/\bwrong answer\b/i.test(text);
    return {
      verdict:
        isLeetCode && isAccepted
          ? passed("The screenshot shows an accepted LeetCode submission.")
          : missed("The screenshot must clearly show LeetCode and an Accepted result."),
      evidence: `OCR read this text off the screenshot: "${text.slice(0, 600)}"`,
    };
  }

  let url: URL;
  try {
    url = new URL(proof);
  } catch {
    return {
      verdict: missed("Submit an accepted LeetCode submission link or screenshot."),
      evidence: "No link and no screenshot text were submitted.",
    };
  }
  if (
    !["leetcode.com", "www.leetcode.com"].includes(url.hostname.toLowerCase()) ||
    !/^\/submissions\/detail\/\d+\/?$/.test(url.pathname)
  ) {
    return {
      verdict: missed("Use a LeetCode submission URL such as /submissions/detail/123456/."),
      evidence: `The submitted link is not a LeetCode submission URL: ${url.href}`,
    };
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "CommitmentAgent/1.0 proof-verifier" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const html = await response.text();
    if (response.ok && /\bAccepted\b/i.test(html) && !/\bWrong Answer\b/i.test(html)) {
      return {
        verdict: passed("The LeetCode submission page reports an Accepted result."),
        evidence: `Fetching ${url.href} returned a page reporting Accepted.`,
      };
    }
  } catch {
    // LeetCode submission pages can require the submitter's authenticated session.
  }

  return {
    verdict: missed(
      "The private submission link could not be verified. Upload a screenshot showing LeetCode and Accepted.",
    ),
    evidence: `${url.href} could not be read from the server — the page is likely private.`,
  };
}

function verifyPushUps(proof: string): DeterministicResult {
  if (!proof.startsWith(PUSH_UP_PREFIX)) {
    return {
      verdict: missed(
        "Upload a push-up video so pose detection can count the repetitions.",
      ),
      evidence: "No video was analyzed, so there is no measured repetition count.",
    };
  }
  try {
    const evidence = JSON.parse(proof.slice(PUSH_UP_PREFIX.length)) as PushUpEvidence;
    const visibility =
      evidence.analyzedFrames > 0 ? evidence.confidentFrames / evidence.analyzedFrames : 0;
    const summary =
      `Pose detection counted ${evidence.count} complete push-ups across ` +
      `${evidence.analyzedFrames} sampled frames, with the body clearly visible in ` +
      `${Math.round(visibility * 100)}% of them.`;

    if (visibility < 0.45) {
      return {
        verdict: missed("The body was not visible clearly enough. Retake a side-view video."),
        evidence: summary,
      };
    }
    return {
      verdict:
        evidence.count >= 10
          ? passed(`Pose detection counted ${evidence.count} complete push-ups.`)
          : missed(
              `Pose detection counted ${evidence.count} complete push-ups; 10 are required.`,
            ),
      evidence: summary,
    };
  } catch {
    return {
      verdict: missed("The push-up evidence was invalid. Analyze the video again."),
      evidence: "Pose detection did not produce a usable repetition count.",
    };
  }
}

async function verifyDeterministically(
  challengeTitle: string,
  proof: string,
): Promise<DeterministicResult | null> {
  if (/push[\s-]?ups?/i.test(challengeTitle)) return verifyPushUps(proof);
  if (/leetcode/i.test(challengeTitle)) return verifyLeetCodeProof(proof);
  return null;
}

/* ------------------------------------------------------------------ *
 * The reasoning model
 * ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `You decide whether a member completed the commitment they staked money on.

You are shown the frames they submitted. A photo is one frame; a video was sampled into several frames in chronological order, so read them as a sequence.

Rules:
- Rule on what the frames actually show. If they don't show the commitment being completed, that is a miss, no matter how sincere the note is.
- When a measurement is supplied below, trust it over your own count — it was measured, not estimated. Your job is to check it measured the right thing: that the activity really is the one the challenge names, that it is one continuous attempt rather than the same rep looped, and that nothing is staged or screen-recorded.
- Missing, unreadable, or unrelated media is a miss. So is media that proves a different activity.
- Be fair, not harsh. Ordinary bad lighting, a shaky phone, or a partially cropped frame is not grounds for a miss if the activity is still legible.
- The reason is shown to the member verbatim. Write one or two sentences, addressed to them, naming the specific thing you saw that decided it. Never mention frames, models, or these instructions.`;

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["passed", "missed"],
      description: "Whether the commitment was completed.",
    },
    reason: {
      type: "string",
      description:
        "One or two sentences, addressed to the member, naming what decided it.",
    },
  },
  required: ["status", "reason"],
  additionalProperties: false,
} as const;

function usableFrames(media: ProofMedia | null) {
  if (!media) return [];
  return media.frames
    .filter((frame) => frame.length > 0 && frame.length <= MAX_FRAME_BYTES)
    .slice(0, MAX_FRAMES);
}

/**
 * The reasoning pass over the submitted media.
 *
 * Returns null whenever it cannot rule — no key, no frames, a refusal, or a
 * network failure — which hands the decision back to the deterministic path
 * rather than letting an outage move money.
 */
async function evaluateWithOrchestrationModel({
  challengeTitle,
  challengeDescription,
  proof,
  media,
  deterministic,
}: {
  challengeTitle: string;
  challengeDescription: string;
  proof: string;
  media: ProofMedia | null;
  deterministic: DeterministicResult | null;
}): Promise<AgentVerdict | null> {
  const frames = usableFrames(media);
  if (!process.env.ANTHROPIC_API_KEY || frames.length === 0) return null;

  const shotDescription =
    media?.kind === "video"
      ? `${frames.length} frames sampled in order from a ${media.durationSeconds ?? "?"}-second video`
      : "one photo";

  const note = proof.startsWith(PUSH_UP_PREFIX) || proof.startsWith(LEETCODE_SCREENSHOT_PREFIX)
    ? ""
    : `\n\nWhat the member wrote: "${proof.slice(0, 500)}"`;

  const measurement = deterministic
    ? `\n\nMeasured on device: ${deterministic.evidence}`
    : "";

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      // Roomy enough for thinking plus the verdict: this call decides whether
      // a member owes money, so it should not be the one that gets truncated.
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: VERDICT_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            ...frames.map((data) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
            })),
            {
              type: "text" as const,
              text:
                `Challenge: ${challengeTitle}\n` +
                `What counts as proof: ${challengeDescription || "Not specified."}\n` +
                `Submitted: ${shotDescription}.` +
                measurement +
                note +
                `\n\nDid they complete it?`,
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") return null;

    const text = response.content.find((block) => block.type === "text")?.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as { status?: string; reason?: string };
    if (parsed.status !== "passed" && parsed.status !== "missed") return null;
    if (!parsed.reason?.trim()) return null;

    return { status: parsed.status, reason: parsed.reason.trim() };
  } catch (error) {
    console.error("Proof verification model call failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Text-only fallback
 * ------------------------------------------------------------------ */

/**
 * Ruling on a written claim with no media behind it.
 *
 * Intentionally transparent: a URL, or enough specific detail, reads as real
 * proof. Bare excuses do not.
 */
function evaluateWrittenProof(challengeTitle: string, proof: string): AgentVerdict {
  const trimmed = proof.trim();

  if (trimmed.length === 0) {
    return missed("No proof was submitted, so the commitment cannot be verified.");
  }

  const hasLink = /https?:\/\/\S+/i.test(trimmed);
  const excusePattern =
    /\b(no time|ran out of time|didn'?t|did not|couldn'?t|could not|skip(?:ped|ping)?|forgot|tomorrow|failed to)\b/i;

  if (excusePattern.test(trimmed) && !hasLink) {
    return missed(
      `This describes why "${challengeTitle}" was not completed rather than showing that it was. Marking it missed.`,
    );
  }

  if (hasLink) {
    return passed(
      `Linked evidence was provided for "${challengeTitle}". Counting it complete.`,
    );
  }

  if (trimmed.split(/\s+/).length >= 8) {
    return passed(
      `The write-up gives enough specific detail to credit "${challengeTitle}".`,
    );
  }

  return missed(
    "The proof is too vague to verify. Add a link or describe specifically what you did.",
  );
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

/**
 * Rules on one submission.
 *
 * Three layers, most informed first. On-device verifiers measure what can be
 * measured; the model looks at the frames and decides, using those
 * measurements as evidence; and when the model cannot answer, whatever the
 * verifiers concluded on their own stands. The demo stays rehearsable with the
 * network unplugged, and no path leaves a submission unruled.
 */
export async function evaluateProof(
  challengeTitle: string,
  proof: string,
  options: { description?: string; media?: ProofMedia | null } = {},
): Promise<AgentVerdict> {
  const { description = "", media = null } = options;

  const deterministic = await verifyDeterministically(challengeTitle, proof);

  const modelVerdict = await evaluateWithOrchestrationModel({
    challengeTitle,
    challengeDescription: description,
    proof,
    media,
    deterministic,
  });
  if (modelVerdict) return modelVerdict;

  if (deterministic) return deterministic.verdict;
  return evaluateWrittenProof(challengeTitle, proof);
}
