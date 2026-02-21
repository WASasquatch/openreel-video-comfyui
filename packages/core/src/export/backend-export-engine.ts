/**
 * Backend Export Engine
 *
 * Ships rendered frames (or raw media for simple projects) to the ComfyUI
 * backend where native FFmpeg encodes them into a video file.  This mirrors
 * the browser-side two-path approach:
 *
 *   1. **Direct render** – single clip, no effects → send raw media blob to
 *      `/was/openreel_video/render_direct` for native FFmpeg processing.
 *   2. **Frame render** – complex project → browser renders each frame via
 *      Canvas 2D (perfect visual fidelity), then ships JPEGs to
 *      `/was/openreel_video/render_frame` and finalises with
 *      `/was/openreel_video/render_finalize`.
 */

import type { Project } from "../types";
import type {
  VideoExportSettings,
  ExportProgress,
  ExportResult,
} from "./types";
import { DEFAULT_VIDEO_SETTINGS } from "./types";
import { getExportEngine } from "./export-engine";
import { getMediaEngine } from "../media";

// ── Public helpers ──────────────────────────────────────────────────────

export interface BackendFFmpegInfo {
  available: boolean;
  path?: string;
  version?: string;
  hwaccels?: string[];
  ffprobe?: boolean;
  error?: string;
}

/** Check whether the ComfyUI backend has native FFmpeg. */
export async function checkBackendFFmpeg(): Promise<BackendFFmpegInfo> {
  try {
    const res = await fetch("/was/openreel_video/ffmpeg_check");
    if (!res.ok) return { available: false, error: `HTTP ${res.status}` };
    return (await res.json()) as BackendFFmpegInfo;
  } catch (e) {
    return { available: false, error: String(e) };
  }
}

// ── Frame-batch size (number of concurrent uploads) ─────────────────────

const FRAME_BATCH_SIZE = 4;

// ── Export via backend ─────────────────────────────────────────────────

/**
 * Export video using the backend native FFmpeg engine.
 *
 * Mirrors `ExportEngine.exportVideoWithFFmpeg` but replaces the FFmpeg.wasm
 * encoding step with HTTP calls to the backend.
 */
export async function* exportVideoWithBackendFFmpeg(
  project: Project,
  settings: Partial<VideoExportSettings> = {},
): AsyncGenerator<ExportProgress, ExportResult> {
  const fullSettings: VideoExportSettings = {
    ...DEFAULT_VIDEO_SETTINGS,
    ...settings,
    audioSettings: {
      ...DEFAULT_VIDEO_SETTINGS.audioSettings,
      ...settings.audioSettings,
    },
  };

  if (fullSettings.codec === "prores") {
    fullSettings.codec = "h264";
    fullSettings.format = "mp4";
    fullSettings.bitrate = 25000;
    fullSettings.quality = 95;
  }

  const { timeline } = project;
  const engine = getExportEngine();

  // Calculate timeline duration (private helper exposed for us)
  const timelineDuration = calcTimelineDuration(timeline);
  if (timelineDuration <= 0) {
    return {
      success: false,
      error: {
        code: "MUXER_ERROR",
        message: "Timeline is empty. Add clips before exporting.",
        phase: "preparing",
        recoverable: false,
      },
    };
  }

  const totalFrames = Math.ceil(timelineDuration * fullSettings.frameRate);

  yield progress("preparing", 0, totalFrames);

  // ── Check for simple project (direct render path) ──────────────────

  const simpleCheck = engine.isSimpleProject(project) as { simple: boolean; singleClip?: { mediaId: string; startTime: number; endTime: number; speed: number } };
  if (simpleCheck.simple && simpleCheck.singleClip) {
    const mediaItem = project.mediaLibrary.items.find(
      (m) => m.id === simpleCheck.singleClip!.mediaId,
    );
    if (mediaItem?.blob) {
      const clip = project.timeline.tracks
        .flatMap((t) => t.clips)
        .find((c) => c.mediaId === simpleCheck.singleClip!.mediaId);

      const hasClipEffects =
        clip &&
        ((clip.effects && clip.effects.length > 0) ||
          (clip.transform &&
            (clip.transform.scale.x !== 1 ||
              clip.transform.scale.y !== 1 ||
              clip.transform.rotation !== 0 ||
              clip.transform.position.x !== 0 ||
              clip.transform.position.y !== 0 ||
              clip.transform.opacity !== 1)) ||
          (clip.keyframes && clip.keyframes.length > 0));

      const allTracks = project.timeline.tracks.filter((t) => !t.hidden);
      const hasMultipleTracks = allTracks.length > 1;
      const hasAnyTextOrGraphics = allTracks.some(
        (t) =>
          (t.type === "text" || t.type === "graphics") && t.clips.length > 0,
      );

      const canUseDirect =
        !hasClipEffects && !hasMultipleTracks && !hasAnyTextOrGraphics;

      if (canUseDirect) {
        yield progress("encoding", 0.1, totalFrames);

        const directSettings = {
          width: fullSettings.width,
          height: fullSettings.height,
          frameRate: fullSettings.frameRate,
          format: fullSettings.format === "webm" ? "webm" : "mp4",
          videoBitrate: `${fullSettings.bitrate}k`,
          audioBitrate: `${fullSettings.audioSettings.bitrate}k`,
          startTime: simpleCheck.singleClip.startTime,
          endTime: simpleCheck.singleClip.endTime,
          speed: simpleCheck.singleClip.speed,
        };

        const formData = new FormData();
        formData.append(
          "media",
          new File([mediaItem.blob], "input", { type: mediaItem.blob.type }),
        );
        formData.append("settings", JSON.stringify(directSettings));

        const res = await fetch("/was/openreel_video/render_direct", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return {
            success: false,
            error: {
              code: "FRAME_ENCODE_FAILED",
              message: err.error || `Backend render failed (HTTP ${res.status})`,
              phase: "encoding",
              recoverable: false,
            },
          };
        }

        const result = (await res.json()) as {
          status: string;
          filename: string;
          size: number;
        };

        yield progress("complete", 1, totalFrames);

        return {
          success: true,
          stats: {
            framesRendered: totalFrames,
            fileSize: result.size,
            duration: timelineDuration,
            averageBitrate: 0,
            averageSpeed: 0,
          },
          filename: result.filename,
        } as ExportResult;
      }
    }
  }

  // ── Complex project: frame render path ─────────────────────────────

  // 1. Initialize render session on backend
  const initRes = await fetch("/was/openreel_video/render_init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      width: fullSettings.width,
      height: fullSettings.height,
      frameRate: fullSettings.frameRate,
      totalFrames,
      format: fullSettings.format === "webm" ? "webm" : "mp4",
      videoBitrate: `${fullSettings.bitrate}k`,
      audioBitrate: `${fullSettings.audioSettings.bitrate}k`,
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    return {
      success: false,
      error: {
        code: "MUXER_ERROR",
        message: err.error || "Failed to initialize backend render session",
        phase: "preparing",
        recoverable: false,
      },
    };
  }

  const { render_id } = (await initRes.json()) as { render_id: string };

  // 2. Initialize export engine for frame rendering
  await engine.initialize();
  engine.videoEngine?.resetExportState();

  const mediaEngine = getMediaEngine();
  if (!mediaEngine.isAvailable()) {
    await mediaEngine.initialize();
  }
  mediaEngine.clearFrameCache();
  mediaEngine.disposeAllExportDecoders();

  // Create export decoders for video media
  const usedMediaIds = new Set<string>();
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.mediaId) usedMediaIds.add(clip.mediaId);
    }
  }
  for (const mediaId of usedMediaIds) {
    const mediaItem = project.mediaLibrary.items.find((m) => m.id === mediaId);
    if (mediaItem?.blob && mediaItem.type === "video") {
      await mediaEngine.createExportDecoder(
        mediaId,
        mediaItem.blob,
        fullSettings.width,
      );
    }
  }

  // 3. Render & ship frames
  try {
    let framesSent = 0;

    for (let frame = 0; frame < totalFrames; frame += FRAME_BATCH_SIZE) {
      const batch: Promise<void>[] = [];

      for (
        let i = frame;
        i < Math.min(frame + FRAME_BATCH_SIZE, totalFrames);
        i++
      ) {
        batch.push(renderAndShipFrame(project, i, fullSettings, render_id));
      }

      await Promise.all(batch);
      framesSent = Math.min(frame + FRAME_BATCH_SIZE, totalFrames);

      yield progress(
        "rendering",
        (framesSent / totalFrames) * 0.7,
        totalFrames,
        framesSent,
      );

      // Periodic cache cleanup
      if (framesSent % 60 === 0) {
        mediaEngine.clearFrameCache();
      }
    }

    // 4. Render & ship audio
    yield progress("encoding", 0.7, totalFrames, totalFrames);

    const audioBuffer = await engine.renderTimelineAudio(project, fullSettings);
    if (audioBuffer && audioBuffer.length > 0) {
      const wavBlob = encodeAudioBufferToWav(audioBuffer);
      if (wavBlob.size > 44) {
        const audioForm = new FormData();
        audioForm.append("render_id", render_id);
        audioForm.append(
          "audio",
          new File([wavBlob], "audio.wav", { type: "audio/wav" }),
        );
        await fetch("/was/openreel_video/render_audio", {
          method: "POST",
          body: audioForm,
        });
      }
    }

    // 5. Finalize (trigger FFmpeg encode on backend)
    yield progress("encoding", 0.75, totalFrames, totalFrames);

    const finalRes = await fetch("/was/openreel_video/render_finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ render_id }),
    });

    if (!finalRes.ok) {
      const err = await finalRes.json().catch(() => ({}));
      return {
        success: false,
        error: {
          code: "FRAME_ENCODE_FAILED",
          message: err.error || "Backend FFmpeg encoding failed",
          phase: "encoding",
          recoverable: false,
        },
      };
    }

    const finalResult = (await finalRes.json()) as {
      status: string;
      filename: string;
      size: number;
    };

    yield progress("complete", 1, totalFrames, totalFrames);

    return {
      success: true,
      stats: {
        framesRendered: totalFrames,
        fileSize: finalResult.size,
        duration: timelineDuration,
        averageBitrate: 0,
        averageSpeed: 0,
      },
      filename: finalResult.filename,
    } as ExportResult;
  } catch (error) {
    return {
      success: false,
      error: {
        code: "FRAME_ENCODE_FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
        phase: "rendering",
        recoverable: false,
      },
    };
  } finally {
    mediaEngine.disposeAllExportDecoders();
    mediaEngine.clearFrameCache();
  }
}

// ── Internal helpers ───────────────────────────────────────────────────

async function renderAndShipFrame(
  project: Project,
  frameIndex: number,
  settings: VideoExportSettings,
  renderId: string,
): Promise<void> {
  const engine = getExportEngine();
  const time = frameIndex / settings.frameRate;

  const rendered = await engine.videoEngine!.renderFrame(
    project,
    time,
    settings.width,
    settings.height,
  );

  // Convert ImageBitmap → JPEG blob
  const canvas = new OffscreenCanvas(settings.width, settings.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, settings.width, settings.height);
  ctx.drawImage(rendered.image, 0, 0, settings.width, settings.height);
  rendered.image.close();

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.95 });

  // Ship to backend
  const formData = new FormData();
  formData.append("render_id", renderId);
  formData.append("frame_index", String(frameIndex));
  formData.append(
    "frame",
    new File([blob], `frame_${String(frameIndex).padStart(6, "0")}.jpg`, {
      type: "image/jpeg",
    }),
  );

  const res = await fetch("/was/openreel_video/render_frame", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Frame upload failed for frame ${frameIndex}: HTTP ${res.status}`);
  }
}

function progress(
  phase: ExportProgress["phase"],
  progressValue: number,
  totalFrames: number,
  currentFrame = 0,
): ExportProgress {
  return {
    phase,
    progress: progressValue,
    currentFrame,
    totalFrames,
    estimatedTimeRemaining: 0,
    bytesWritten: 0,
    currentBitrate: 0,
  };
}

function calcTimelineDuration(
  timeline: Project["timeline"],
): number {
  let maxEnd = 0;
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd > maxEnd) maxEnd = clipEnd;
    }
  }
  return maxEnd;
}

function encodeAudioBufferToWav(buffer: AudioBuffer): Blob {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, totalLength - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i];
      const intSample = Math.max(
        -32768,
        Math.min(32767, Math.round(sample * 32767)),
      );
      view.setInt16(offset, intSample, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}
