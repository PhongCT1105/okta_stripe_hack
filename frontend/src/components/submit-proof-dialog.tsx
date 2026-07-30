"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Camera, CheckCircle2, Send, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { submitProof, type VerdictResult } from "@/lib/actions";
import { formatMoney } from "@/lib/format";
import { extractProofMedia, isImageFile, isVideoFile } from "@/lib/media-frames";
import { countPushUps, readLeetCodeScreenshot } from "@/lib/proof-verifiers";
import type { ProofMedia } from "@/lib/types";

/**
 * Proof submission and the agent's ruling, in one dialog.
 *
 * Two states share the surface: the form, and the verdict. Keeping the verdict
 * here rather than on a separate route means the result lands where the user
 * was already looking, and the leaderboard behind it is already updated when
 * they close.
 */
export function SubmitProofDialog({
  groupId,
  challengeTitle,
  commitmentAmountCents,
}: {
  groupId: string;
  challengeTitle: string;
  commitmentAmountCents: number;
}) {
  const [open, setOpen] = useState(false);
  // Three sources feed one submitted proof string, in priority order below:
  // what a device verifier measured, what the member typed, what they filmed.
  const [evidence, setEvidence] = useState("");
  const [note, setNote] = useState("");
  const [media, setMedia] = useState<ProofMedia | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisLabel, setAnalysisLabel] = useState("");
  const [progress, setProgress] = useState(0);
  const [state, formAction, pending] = useActionState<VerdictResult | null, FormData>(
    submitProof,
    null,
  );

  // Derived, not stored: the verdict view is simply "the action returned a
  // ruling". Once it has, the parent re-renders with the submission in hand and
  // swaps this dialog out for the result panel, so there is nothing to reset.
  const showVerdict = Boolean(state?.ok && state.status);
  const passed = state?.status === "passed";
  const isPushUp = /push[\s-]?ups?/i.test(challengeTitle);
  const isLeetCode = /leetcode/i.test(challengeTitle);
  const analyzing = Boolean(analysisLabel);

  const proof = evidence || note.trim() || describeMedia(media);

  async function analyzeFile(file: File | undefined) {
    if (!file) return;
    setEvidence("");
    setMedia(null);
    setAnalysisError("");
    setProgress(0);

    try {
      // On-device measurement first, where this challenge has one and the file
      // is the kind it can read. It measures what the model can only estimate.
      if (isPushUp && isVideoFile(file)) {
        setAnalysisLabel("Counting repetitions");
        const counted = await countPushUps(file, setProgress);
        setEvidence(`PUSHUP_EVIDENCE:${JSON.stringify(counted)}`);
      } else if (isLeetCode && isImageFile(file)) {
        setAnalysisLabel("Reading screenshot");
        const text = await readLeetCodeScreenshot(file, setProgress);
        setEvidence(`LEETCODE_SCREENSHOT_EVIDENCE:${text}`);
      }

      // Frames go up for every submission, whatever the challenge. They are
      // what lets the agent rule on a commitment nobody wrote a verifier for.
      setProgress(0);
      setAnalysisLabel("Preparing it for the agent");
      setMedia(await extractProofMedia(file, setProgress));

      setAnalysisLabel("");
      setProgress(100);
    } catch (error) {
      setAnalysisLabel("");
      setMedia(null);
      setAnalysisError(
        error instanceof Error ? error.message : "The file could not be analyzed.",
      );
    }
  }

  const captureHint = isPushUp
    ? "Film from the side so your shoulders, elbows, wrists, and hips stay visible. Up to 2 minutes."
    : isLeetCode
      ? "Capture the LeetCode page with the green Accepted result showing."
      : "Record it now, or pick a photo or video you already have. Up to 2 minutes.";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="xl" className="w-full sm:w-auto">
            <Send data-icon="inline-start" />
            Submit proof
          </Button>
        }
      />

      <DialogContent className="sm:max-w-lg">
        {showVerdict && state?.status ? (
          <>
            <DialogHeader>
              <div
                className={`mx-auto mb-2 flex size-16 items-center justify-center rounded-full ${
                  passed ? "bg-verified/12 text-verified" : "bg-destructive/12 text-destructive"
                }`}
              >
                {passed ? (
                  <CheckCircle2 aria-hidden className="size-9" />
                ) : (
                  <XCircle aria-hidden className="size-9" />
                )}
              </div>
              <DialogTitle className="text-center text-2xl">
                {passed ? "Nice — that counts." : "That one's a miss."}
              </DialogTitle>
              <DialogDescription className="text-center">
                {passed
                  ? "Your streak just went up and the leaderboard is updated."
                  : "Your streak resets to zero. No money moves until you approve it."}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl bg-muted/60 p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                <Sparkles aria-hidden className="size-3.5" />
                Agent decision
              </p>
              <p className="text-sm leading-relaxed">{state.reason}</p>
            </div>

            <DialogFooter>
              {state.paymentRequestId ? (
                <Button
                  size="xl"
                  className="w-full"
                  render={<Link href={`/pay/${state.paymentRequestId}`} />}
                >
                  {`Review the ${formatMoney(commitmentAmountCents)} commitment`}
                </Button>
              ) : (
                <DialogClose
                  render={
                    <Button size="xl" className="w-full">
                      Back to the group
                    </Button>
                  }
                />
              )}
            </DialogFooter>
          </>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="groupId" value={groupId} />
            <input type="hidden" name="proof" value={proof} />
            <input
              type="hidden"
              name="media"
              value={media ? JSON.stringify(media) : ""}
            />
            <DialogHeader>
              <DialogTitle>Submit your proof</DialogTitle>
              <DialogDescription>{challengeTitle}</DialogDescription>
            </DialogHeader>

            <FieldGroup className="py-4">
              {isLeetCode ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="proof-link">Accepted submission link</FieldLabel>
                    <Input
                      id="proof-link"
                      type="url"
                      placeholder="https://leetcode.com/submissions/detail/..."
                      value={note}
                      onChange={(event) => {
                        setNote(event.target.value);
                        setAnalysisError("");
                      }}
                    />
                  </Field>
                  <div className="relative text-center text-xs font-bold uppercase text-muted-foreground">
                    <span className="relative z-10 bg-background px-3">or</span>
                    <span className="absolute inset-x-0 top-1/2 border-t" />
                  </div>
                </>
              ) : null}

              <Field data-invalid={analysisError ? true : undefined}>
                <FieldLabel htmlFor="proof-file">
                  {isLeetCode ? "Screenshot or video" : "Photo or video"}
                </FieldLabel>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {/* Opens the camera straight into capture mode on a phone.
                      Desktop browsers ignore `capture` and show a file picker. */}
                  <input
                    id="proof-capture"
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    className="sr-only"
                    disabled={analyzing}
                    onChange={(event) => void analyzeFile(event.target.files?.[0])}
                  />
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={analyzing}
                    render={<label htmlFor="proof-capture" />}
                  >
                    <Camera data-icon="inline-start" />
                    Record now
                  </Button>
                  <Input
                    id="proof-file"
                    type="file"
                    accept="image/*,video/*"
                    className="sm:flex-1"
                    disabled={analyzing}
                    onChange={(event) => void analyzeFile(event.target.files?.[0])}
                  />
                </div>
                <FieldDescription>{captureHint}</FieldDescription>
              </Field>

              {isPushUp || isLeetCode ? null : (
                <Field>
                  <FieldLabel htmlFor="proof-text">Add a note</FieldLabel>
                  <Textarea
                    id="proof-text"
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Paste a link, or describe specifically what you completed."
                  />
                  <FieldDescription>
                    Optional once you have attached a photo or video.
                  </FieldDescription>
                </Field>
              )}

              {analyzing ? (
                <div className="rounded-xl border bg-muted/50 p-3" aria-live="polite">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="flex items-center gap-2">
                      <Spinner className="size-4" />
                      {analysisLabel}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : media ? (
                <p className="text-sm font-medium text-verified" aria-live="polite">
                  {media.kind === "video"
                    ? `${media.durationSeconds}-second video ready to send.`
                    : "Photo ready to send."}
                </p>
              ) : null}
              {analysisError || state?.error ? (
                <FieldError>{analysisError || state?.error}</FieldError>
              ) : null}
            </FieldGroup>

            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="ghost" size="lg">
                    Cancel
                  </Button>
                }
              />
              <Button type="submit" size="lg" disabled={pending || analyzing || !proof.trim()}>
                {pending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Agent is reviewing…
                  </>
                ) : (
                  "Send to the agent"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** What gets stored as the proof text when the media is the whole story. */
function describeMedia(media: ProofMedia | null) {
  if (!media) return "";
  return media.kind === "video"
    ? `Recorded a ${media.durationSeconds ?? 0}-second video.`
    : "Submitted a photo.";
}
