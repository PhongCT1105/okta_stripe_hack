import type { SubmissionStatus } from "@/lib/types";

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

const PUSH_UP_PREFIX = "PUSHUP_EVIDENCE:";
const LEETCODE_SCREENSHOT_PREFIX = "LEETCODE_SCREENSHOT_EVIDENCE:";

function missed(reason: string): AgentVerdict {
  return { status: "missed", reason };
}

function passed(reason: string): AgentVerdict {
  return { status: "passed", reason };
}

async function verifyLeetCodeProof(proof: string): Promise<AgentVerdict> {
  if (proof.startsWith(LEETCODE_SCREENSHOT_PREFIX)) {
    const text = proof.slice(LEETCODE_SCREENSHOT_PREFIX.length);
    const isLeetCode = /\bleetcode\b/i.test(text);
    const isAccepted = /\baccepted\b/i.test(text) && !/\bwrong answer\b/i.test(text);
    return isLeetCode && isAccepted
      ? passed("The screenshot shows an accepted LeetCode submission.")
      : missed("The screenshot must clearly show LeetCode and an Accepted result.");
  }

  let url: URL;
  try {
    url = new URL(proof);
  } catch {
    return missed("Submit an accepted LeetCode submission link or screenshot.");
  }
  if (
    !["leetcode.com", "www.leetcode.com"].includes(url.hostname.toLowerCase()) ||
    !/^\/submissions\/detail\/\d+\/?$/.test(url.pathname)
  ) {
    return missed("Use a LeetCode submission URL such as /submissions/detail/123456/.");
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "CommitmentAgent/1.0 proof-verifier" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const html = await response.text();
    if (response.ok && /\bAccepted\b/i.test(html) && !/\bWrong Answer\b/i.test(html)) {
      return passed("The LeetCode submission page reports an Accepted result.");
    }
  } catch {
    // LeetCode submission pages can require the submitter's authenticated session.
  }

  return missed(
    "The private submission link could not be verified. Upload a screenshot showing LeetCode and Accepted.",
  );
}

function verifyPushUps(proof: string): AgentVerdict {
  if (!proof.startsWith(PUSH_UP_PREFIX)) {
    return missed("Upload a push-up video so pose detection can count the repetitions.");
  }
  try {
    const evidence = JSON.parse(proof.slice(PUSH_UP_PREFIX.length)) as PushUpEvidence;
    const visibility =
      evidence.analyzedFrames > 0 ? evidence.confidentFrames / evidence.analyzedFrames : 0;
    if (visibility < 0.45) {
      return missed("The body was not visible clearly enough. Retake a side-view video.");
    }
    return evidence.count >= 10
      ? passed(`Pose detection counted ${evidence.count} complete push-ups.`)
      : missed(`Pose detection counted ${evidence.count} complete push-ups; 10 are required.`);
  } catch {
    return missed("The push-up evidence was invalid. Analyze the video again.");
  }
}

/**
 * ORCHESTRATION MODEL INTEGRATION POINT
 *
 * Replace the deterministic call below with the teammate-owned reasoning
 * model. It should select the challenge-specific verifier (LeetCode URL or
 * screenshot, push-up video), consume that verifier's structured evidence,
 * and return a schema-validated AgentVerdict. Do not let the reasoning model
 * fetch arbitrary URLs, count video repetitions, or trigger payments.
 */
async function evaluateWithOrchestrationModel(
  challengeTitle: string,
  proof: string,
): Promise<AgentVerdict | null> {
  void challengeTitle;
  void proof;
  // TODO(orchestration-model): call the teammate's model here.
  return null;
}

/**
 * Stand-in for the accountability agent.
 *
 * The real implementation calls an LLM with the challenge and the submitted
 * proof. This deterministic version keeps the demo rehearsable and doubles as
 * the documented fallback for when the model is unavailable — the plan calls
 * for a deterministic rule or organizer override in that case.
 *
 * The heuristic is intentionally transparent: a URL, or enough specific
 * detail, reads as real proof. Bare excuses do not.
 */
export async function evaluateProof(
  challengeTitle: string,
  proof: string,
): Promise<AgentVerdict> {
  if (/push[\s-]?ups?/i.test(challengeTitle)) return verifyPushUps(proof);
  if (/leetcode/i.test(challengeTitle)) return verifyLeetCodeProof(proof);

  const modelVerdict = await evaluateWithOrchestrationModel(challengeTitle, proof);
  if (modelVerdict) return modelVerdict;

  const trimmed = proof.trim();

  if (trimmed.length === 0) {
    return {
      status: "missed",
      reason: "No proof was submitted, so the commitment cannot be verified.",
    };
  }

  const hasLink = /https?:\/\/\S+/i.test(trimmed);
  const excusePattern =
    /\b(no time|ran out of time|didn'?t|did not|couldn'?t|could not|skip(?:ped|ping)?|forgot|tomorrow|failed to)\b/i;
  const readsAsExcuse = excusePattern.test(trimmed);

  if (readsAsExcuse && !hasLink) {
    return {
      status: "missed",
      reason: `This describes why "${challengeTitle}" was not completed rather than showing that it was. Marking it missed.`,
    };
  }

  if (hasLink) {
    return {
      status: "passed",
      reason: `Linked evidence was provided for "${challengeTitle}". Counting it complete.`,
    };
  }

  // No link: fall back to specificity. Vague one-liners do not clear the bar.
  if (trimmed.split(/\s+/).length >= 8) {
    return {
      status: "passed",
      reason: `The write-up gives enough specific detail to credit "${challengeTitle}".`,
    };
  }

  return {
    status: "missed",
    reason:
      "The proof is too vague to verify. Add a link or describe specifically what you did.",
  };
}
