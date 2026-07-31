"use client";

import type { PushUpEvidence } from "@/lib/proof-verifiers";

/**
 * Push-up counting against a live camera.
 *
 * The uploaded-video path samples a file after the fact, which means you finish
 * your set, wait for an upload, and only then learn the count was wrong. Here
 * the same pose model runs on the camera feed as you go, so the number moves
 * while you move and a bad angle is obvious immediately rather than afterwards.
 *
 * The rep state machine is deliberately the same one the file path uses — a rep
 * shouldn't count differently depending on how it was recorded.
 */

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

function angle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  const ab = Math.atan2(a.y - b.y, a.x - b.x);
  const cb = Math.atan2(c.y - b.y, c.x - b.x);
  let degrees = Math.abs(((ab - cb) * 180) / Math.PI);
  if (degrees > 180) degrees = 360 - degrees;
  return degrees;
}

export interface LiveCoachState extends PushUpEvidence {
  /** What the camera can see right now, shown as live guidance. */
  hint: string;
  /** True while the working side is clearly visible. */
  tracking: boolean;
}

export interface LiveSession {
  /** Frames captured at rep boundaries, for the model to sanity-check. */
  keyframes(): string[];
  stop(): void;
}

/**
 * Starts counting against a video element already bound to a camera stream.
 *
 * Returns immediately; progress arrives through `onState`. Cancel with `stop()`,
 * which also releases the model — leaving it running would keep the camera hot.
 */
export async function startLivePushUpCount(
  video: HTMLVideoElement,
  onState: (state: LiveCoachState) => void,
): Promise<LiveSession> {
  const { FilesetResolver, PoseLandmarker } = await import(
    "@mediapipe/tasks-vision"
  );
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
  const landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.55,
    minPosePresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
  });

  let count = 0;
  let analyzedFrames = 0;
  let confidentFrames = 0;
  let phase: "up" | "down" = "up";
  let running = true;
  let lastTimestamp = -1;
  const keyframes: string[] = [];

  // A still from each of the first few reps is enough for the model to confirm
  // this is the activity claimed. Capturing every rep would balloon the payload
  // for no extra assurance.
  const canvas = document.createElement("canvas");
  function captureKeyframe() {
    if (keyframes.length >= 4 || !video.videoWidth) return;
    canvas.width = 320;
    canvas.height = Math.round((video.videoHeight / video.videoWidth) * 320);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    keyframes.push(canvas.toDataURL("image/jpeg", 0.6).split(",")[1] ?? "");
  }

  function tick() {
    if (!running) return;

    // The model rejects a repeated timestamp, and rAF can outrun the camera.
    const timestamp = performance.now();
    if (video.readyState < 2 || timestamp <= lastTimestamp) {
      requestAnimationFrame(tick);
      return;
    }
    lastTimestamp = timestamp;

    const result = landmarker.detectForVideo(video, timestamp);
    const points = result.landmarks[0];
    analyzedFrames += 1;

    let hint = "Get your whole body in frame, side on.";
    let tracking = false;

    if (points) {
      const leftScore = Math.min(
        points[11].visibility ?? 0,
        points[13].visibility ?? 0,
        points[15].visibility ?? 0,
        points[23].visibility ?? 0,
      );
      const rightScore = Math.min(
        points[12].visibility ?? 0,
        points[14].visibility ?? 0,
        points[16].visibility ?? 0,
        points[24].visibility ?? 0,
      );
      const useLeft = leftScore >= rightScore;
      const shoulder = points[useLeft ? 11 : 12];
      const elbow = points[useLeft ? 13 : 14];
      const wrist = points[useLeft ? 15 : 16];
      const hip = points[useLeft ? 23 : 24];

      if (Math.max(leftScore, rightScore) >= 0.55) {
        confidentFrames += 1;
        tracking = true;

        const elbowAngle = angle(shoulder, elbow, wrist);
        const torsoToArm = angle(elbow, shoulder, hip);
        const bodyIsHorizontal = Math.abs(shoulder.y - hip.y) < 0.35;

        if (!bodyIsHorizontal) {
          hint = "Get into a plank — shoulders and hips level.";
        } else if (bodyIsHorizontal && torsoToArm > 25 && elbowAngle <= 95) {
          phase = "down";
          hint = "Down. Now press up.";
        } else if (phase === "down" && bodyIsHorizontal && elbowAngle >= 155) {
          count += 1;
          phase = "up";
          hint = "Counted. Go again.";
          captureKeyframe();
        } else {
          hint = phase === "down" ? "Press all the way up." : "Lower your chest.";
        }
      }
    }

    onState({ count, analyzedFrames, confidentFrames, hint, tracking });
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  return {
    keyframes: () => keyframes.filter(Boolean),
    stop() {
      running = false;
      landmarker.close();
    },
  };
}
