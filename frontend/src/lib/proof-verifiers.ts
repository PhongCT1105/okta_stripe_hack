"use client";

import { seek } from "@/lib/media-frames";

export interface PushUpEvidence {
  count: number;
  analyzedFrames: number;
  confidentFrames: number;
}

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

export async function countPushUps(
  file: File,
  onProgress: (progress: number) => void,
): Promise<PushUpEvidence> {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
  const landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: POSE_MODEL, delegate: "CPU" },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.55,
    minPosePresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
  });

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Unsupported or damaged video file."));
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 120) {
      throw new Error("Use a video between 1 second and 2 minutes.");
    }

    const fps = 8;
    const frameCount = Math.max(2, Math.ceil(video.duration * fps));
    let count = 0;
    let confidentFrames = 0;
    let phase: "up" | "down" = "up";

    for (let frame = 0; frame < frameCount; frame += 1) {
      const time = Math.min(frame / fps, Math.max(0, video.duration - 0.01));
      await seek(video, time);
      const result = landmarker.detectForVideo(video, Math.round(time * 1000));
      const points = result.landmarks[0];

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
          const elbowAngle = angle(shoulder, elbow, wrist);
          const torsoToArm = angle(elbow, shoulder, hip);
          const bodyIsHorizontal = Math.abs(shoulder.y - hip.y) < 0.35;

          if (bodyIsHorizontal && torsoToArm > 25 && elbowAngle <= 95) {
            phase = "down";
          } else if (phase === "down" && bodyIsHorizontal && elbowAngle >= 155) {
            count += 1;
            phase = "up";
          }
        }
      }
      onProgress(Math.round(((frame + 1) / frameCount) * 100));
    }

    return { count, analyzedFrames: frameCount, confidentFrames };
  } finally {
    landmarker.close();
    URL.revokeObjectURL(objectUrl);
  }
}

export async function readLeetCodeScreenshot(
  file: File,
  onProgress: (progress: number) => void,
) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", undefined, {
    logger: (message) => {
      if (message.status === "recognizing text") {
        onProgress(Math.round(message.progress * 100));
      }
    },
  });
  try {
    const result = await worker.recognize(file);
    return result.data.text.replace(/\s+/g, " ").trim();
  } finally {
    await worker.terminate();
  }
}
