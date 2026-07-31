"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, RotateCcw, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { startLivePushUpCount, type LiveCoachState, type LiveSession } from "@/lib/live-pose";
import { cn } from "@/lib/utils";

/**
 * Counts reps against the live camera instead of an uploaded recording.
 *
 * Recording first means you find out the framing was wrong after the set is
 * over. Counting live turns the phone into a mirror that disagrees with you in
 * time to matter — the number and the coaching line move as you do.
 *
 * Nothing is uploaded while filming. The evidence that leaves the device is the
 * count, how much of the time the body was actually visible, and a few stills
 * taken at rep boundaries.
 */
export function LivePoseCapture({
  onEvidence,
  disabled,
}: {
  onEvidence: (evidence: { count: number; analyzedFrames: number; confidentFrames: number; frames: string[] } | null) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<"idle" | "starting" | "live" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [state, setState] = useState<LiveCoachState | null>(null);

  const teardown = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // The camera must not outlive the dialog. Without this it keeps running —
  // and on a phone that means a light staying on after you've walked away.
  useEffect(() => teardown, [teardown]);

  async function start() {
    setError("");
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Rear camera on a phone: you prop it up and step into frame.
        video: { facingMode: { ideal: "environment" }, width: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("Camera view is not ready.");
      video.srcObject = stream;
      await video.play();

      sessionRef.current = await startLivePushUpCount(video, setState);
      setStatus("live");
    } catch (cause) {
      teardown();
      setStatus("error");
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Camera access was blocked. Allow it in your browser settings, or upload a video instead."
          : cause instanceof Error
            ? cause.message
            : "The camera could not be started.",
      );
    }
  }

  function finish() {
    const frames = sessionRef.current?.keyframes() ?? [];
    teardown();
    setStatus("done");
    if (state) {
      onEvidence({
        count: state.count,
        analyzedFrames: state.analyzedFrames,
        confidentFrames: state.confidentFrames,
        frames,
      });
    }
  }

  function reset() {
    teardown();
    setState(null);
    setStatus("idle");
    onEvidence(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn(
            "aspect-[3/4] w-full object-cover sm:aspect-video",
            status === "idle" || status === "error" ? "opacity-0" : "opacity-100",
          )}
        />

        {status === "live" && state ? (
          <>
            <div className="absolute top-3 left-3 rounded-full bg-black/60 px-4 py-2 backdrop-blur">
              <span className="numeric text-3xl font-extrabold text-white tabular-nums">
                {state.count}
              </span>
              <span className="ml-1.5 text-sm font-semibold text-white/70">reps</span>
            </div>
            <div
              className={cn(
                "absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold backdrop-blur",
                state.tracking ? "bg-verified/80 text-white" : "bg-pending/80 text-white",
              )}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {state.tracking ? "Tracking" : "Searching"}
            </div>
            <p className="absolute inset-x-3 bottom-3 rounded-xl bg-black/60 px-3 py-2 text-center text-sm font-medium text-white backdrop-blur">
              {state.hint}
            </p>
          </>
        ) : null}

        {status === "idle" || status === "error" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <VideoOff aria-hidden className="size-8 text-white/40" />
            <p className="text-sm text-white/60">
              Prop your phone side-on so your shoulders, elbows and hips are all
              in frame.
            </p>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive">{error}</p>
      ) : null}

      {status === "done" && state ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-verified">
          <Check aria-hidden className="size-4" />
          {`${state.count} rep${state.count === 1 ? "" : "s"} counted. Send it to the agent below.`}
        </p>
      ) : null}

      <div className="flex gap-2">
        {status === "idle" || status === "error" ? (
          <Button type="button" size="lg" className="flex-1" onClick={start} disabled={disabled}>
            <Camera data-icon="inline-start" />
            Start camera
          </Button>
        ) : null}

        {status === "starting" ? (
          <Button type="button" size="lg" className="flex-1" disabled>
            <Spinner data-icon="inline-start" />
            Starting camera…
          </Button>
        ) : null}

        {status === "live" ? (
          <Button type="button" size="lg" className="flex-1" onClick={finish}>
            <Check data-icon="inline-start" />
            Done
          </Button>
        ) : null}

        {status === "done" ? (
          <Button type="button" variant="ghost" size="lg" onClick={reset}>
            <RotateCcw data-icon="inline-start" />
            Record again
          </Button>
        ) : null}
      </div>
    </div>
  );
}
