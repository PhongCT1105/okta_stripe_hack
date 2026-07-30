"use client";

import type { ProofMedia } from "@/lib/types";

/**
 * Turns whatever the phone camera produced into frames the agent can read.
 *
 * The Claude API accepts images, not video, so a recording has to be decoded
 * somewhere. Doing it here rather than server-side means the raw file never
 * leaves the device: a two-minute clip becomes six small JPEGs, which is both
 * cheaper to send and the only shape the model can actually look at.
 *
 * Frames are deliberately small. Legibility, not fidelity, is what decides a
 * verdict, and every pixel is a token.
 */

const IMAGE_MAX_EDGE = 1568;
const VIDEO_MAX_EDGE = 896;
const VIDEO_FRAME_COUNT = 6;
const JPEG_QUALITY = 0.62;
const MIN_VIDEO_SECONDS = 1;
const MAX_VIDEO_SECONDS = 120;

export function isVideoFile(file: File) {
  return file.type.startsWith("video/");
}

export function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

/** Resolves once the element has seeked, so the next draw reads that frame. */
export function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not read this video."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = time;
  });
}

function scaleToFit(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Draws a decoded frame and hands back bare base64 — no `data:` prefix. */
function drawToBase64Jpeg(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxEdge: number,
) {
  const { width, height } = scaleToFit(sourceWidth, sourceHeight, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not process the file.");
  context.drawImage(source, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

async function decodeImage(file: File) {
  // createImageBitmap applies EXIF orientation, so a photo taken sideways on a
  // phone reaches the model the way the member saw it in the viewfinder.
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error("Unsupported or damaged image file.");
  }
}

async function framesFromImage(file: File, onProgress: (percent: number) => void) {
  const bitmap = await decodeImage(file);
  try {
    onProgress(50);
    const frame = drawToBase64Jpeg(bitmap, bitmap.width, bitmap.height, IMAGE_MAX_EDGE);
    onProgress(100);
    return [frame];
  } finally {
    bitmap.close();
  }
}

async function framesFromVideo(file: File, onProgress: (percent: number) => void) {
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

    const { duration } = video;
    if (
      !Number.isFinite(duration) ||
      duration < MIN_VIDEO_SECONDS ||
      duration > MAX_VIDEO_SECONDS
    ) {
      throw new Error("Use a video between 1 second and 2 minutes.");
    }

    // Sample inside the clip rather than at its edges: the first and last
    // frames are usually the member reaching for the phone.
    const frames: string[] = [];
    for (let index = 0; index < VIDEO_FRAME_COUNT; index += 1) {
      const time = (duration * (index + 0.5)) / VIDEO_FRAME_COUNT;
      await seek(video, Math.min(time, Math.max(0, duration - 0.01)));
      frames.push(
        drawToBase64Jpeg(video, video.videoWidth, video.videoHeight, VIDEO_MAX_EDGE),
      );
      onProgress(Math.round(((index + 1) / VIDEO_FRAME_COUNT) * 100));
    }

    return { frames, durationSeconds: Math.round(duration) };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Reduces a photo or recording to the frames that get sent to the agent.
 *
 * Throws with a message meant for the member — every failure here is something
 * they can fix by retaking it.
 */
export async function extractProofMedia(
  file: File,
  onProgress: (percent: number) => void,
): Promise<ProofMedia> {
  if (isImageFile(file)) {
    return { kind: "image", frames: await framesFromImage(file, onProgress) };
  }
  if (isVideoFile(file)) {
    const { frames, durationSeconds } = await framesFromVideo(file, onProgress);
    return { kind: "video", frames, durationSeconds };
  }
  throw new Error("Attach a photo or a video.");
}
