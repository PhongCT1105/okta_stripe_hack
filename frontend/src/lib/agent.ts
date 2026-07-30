import type { SubmissionStatus } from "@/lib/types";

export interface AgentVerdict {
  status: Extract<SubmissionStatus, "passed" | "missed">;
  /** Plain-language justification, shown to the user verbatim. */
  reason: string;
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
