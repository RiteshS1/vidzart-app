// Renders a project to an MP4 file. Runs inside a Web Worker (see
// src/workers/export.worker.ts) so the editor stays responsive, but has no
// worker-specific code itself: it's a plain async function.
//
// Pipeline, per output frame at the chosen fps:
//
//   output time ──timeMap──▶ source time ──Mediabunny decode──▶ VideoFrame
//        ──renderFrame (same as the preview!)──▶ OffscreenCanvas
//        ──WebCodecs VideoEncoder (via Mediabunny CanvasSource)──▶ MP4 muxer
//
// Audio: the kept pieces of the source audio are copied in order and
// re-timestamped onto the output timeline, then re-encoded (AAC).

import {
  ALL_FORMATS,
  AudioSampleSink,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  VideoSampleSink,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
} from "mediabunny";
import { decodeMono, decodeStereo } from "@/lib/audio/decode";
import { duckCurve } from "@/lib/audio/music";
import { speechMask } from "@/lib/audio/silence";
import { createCursorTrack } from "@/lib/effects/cursorTrack";
import { createCursorLookup } from "@/lib/events/cursor";
import type { VidzEvents } from "@/lib/events/types";
import type { VidzProject } from "@/lib/project/types";
import { outputAspect, outputSize } from "@/lib/render/layout";
import { renderFrame } from "@/lib/render/renderFrame";
import { buildTimeMap, cutPoints, outputToSource } from "@/lib/timeline/timeMap";
import { MIX_RATE, mixAudio } from "./mixAudio";

export interface ExportOptions {
  /** Length of the output's longer side in pixels, e.g. 1920 for 1080p 16:9. */
  longSide: number;
  fps: number;
}

export interface ExportJob {
  video: Blob;
  /** The background music file (project.audio.music.src), if any. */
  music?: Blob | null;
  project: VidzProject;
  events: VidzEvents | null;
  options: ExportOptions;
}

export interface ExportResult {
  blob: Blob;
  width: number;
  height: number;
  durationMs: number;
  videoCodec: string;
  audioCodec: string | null;
}

export class ExportCanceledError extends Error {
  constructor() {
    super("Export canceled.");
  }
}

export async function exportVideo(
  job: ExportJob,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<ExportResult> {
  const { project, options } = job;
  const map = buildTimeMap(project.source.duration, project.segments);
  if (map.outputDuration <= 0) throw new Error("Nothing to export: the whole video is cut.");

  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(job.video) });
  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error("The source has no video track.");
    const audioTrack = await input.getPrimaryAudioTrack();

    const size = outputSize(outputAspect(project.settings.aspectRatio, project.source), options.longSide);
    const canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("This browser can't render in a worker (no OffscreenCanvas 2D).");

    // H.264 ("avc") first: it plays everywhere. Others only if the browser
    // can't encode H.264 at this size.
    const videoCodec = await getFirstEncodableVideoCodec(["avc", "hevc", "vp9", "av1"], size);
    if (!videoCodec) throw new Error("This browser can't encode video at this size. Try a smaller resolution.");

    const output = new Output({
      // in-memory fastStart puts the index at the front of the file, so the
      // MP4 starts playing before it's fully downloaded/loaded.
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new BufferTarget(),
    });
    const videoSource = new CanvasSource(canvas, { codec: videoCodec, quality: QUALITY_HIGH, keyFrameInterval: 2 });
    output.addVideoTrack(videoSource, { frameRate: options.fps });

    // With music (or a changed recording volume) the audio is mixed sample
    // by sample (mixAudio.ts); otherwise the recording's audio is copied
    // piece by piece, keeping its own channel layout.
    const musicSettings = project.audio?.music;
    const sourceVolume = project.audio?.sourceVolume ?? 1;
    const sourceAudio = audioTrack && (await audioTrack.canDecode()) ? audioTrack : null;
    const mixing = Boolean(musicSettings && job.music) || sourceVolume < 1;

    let audio: { source: AudioSampleSource; codec: string } | null = null;
    if (mixing) {
      const codec = await getFirstEncodableAudioCodec(["aac", "opus"], { numberOfChannels: 2, sampleRate: MIX_RATE });
      if (codec) {
        audio = { source: new AudioSampleSource({ codec, quality: QUALITY_HIGH }), codec };
        output.addAudioTrack(audio.source);
      }
    } else if (audioTrack && (await audioTrack.canDecode())) {
      const codec = await getFirstEncodableAudioCodec(["aac", "opus"], {
        numberOfChannels: await audioTrack.getNumberOfChannels(),
        sampleRate: await audioTrack.getSampleRate(),
      });
      if (codec) {
        audio = { source: new AudioSampleSource({ codec, quality: QUALITY_HIGH }), codec };
        output.addAudioTrack(audio.source);
      }
    }

    await output.start();
    const abort = async () => {
      await output.cancel();
      throw new ExportCanceledError();
    };

    // Video and audio run concurrently: the muxer interleaves tracks, so
    // feeding all video first could stall waiting for audio.
    const firstTimestamp = await videoTrack.getFirstTimestamp();
    const cursorAt = job.events
      ? createCursorLookup(job.events, { offsetMs: project.source.eventsOffsetMs ?? 0 })
      : undefined;
    const cursor = job.events
      ? createCursorTrack(job.events, {
          smoothing: project.settings.cursor.smoothing,
          hideWhenIdleMs: project.settings.cursor.hideWhenIdleMs,
          offsetMs: project.source.eventsOffsetMs ?? 0,
        })
      : undefined;

    const cuts = cutPoints(map);
    const renderVideo = async () => {
      const frameCount = Math.max(1, Math.round((map.outputDuration / 1000) * options.fps));
      const sourceTimes = (function* () {
        for (let i = 0; i < frameCount; i++) {
          const sourceMs = outputToSource(map, (i / options.fps) * 1000);
          // Mediabunny returns the frame showing at a time; times before the
          // first frame would return null, so clamp to it.
          yield Math.max(firstTimestamp, sourceMs / 1000);
        }
      })();

      const sink = new VideoSampleSink(videoTrack);
      let i = 0;
      for await (const sample of sink.samplesAtTimestamps(sourceTimes)) {
        if (signal.aborted) {
          sample?.close();
          await abort();
        }
        const frame = sample?.toVideoFrame() ?? null;
        renderFrame(
          ctx,
          size,
          { image: frame, size: { width: frame?.displayWidth ?? project.source.width, height: frame?.displayHeight ?? project.source.height } },
          project,
          {
            sourceTime: outputToSource(map, (i / options.fps) * 1000),
            cursorAt,
            cursor,
            output: { time: (i / options.fps) * 1000, duration: map.outputDuration, cuts },
          },
        );
        // Close decoded frames promptly: they hold GPU/decoder memory, and
        // the decoder stalls if too many are left open.
        frame?.close();
        sample?.close();
        await videoSource.add(i / options.fps, 1 / options.fps);
        i++;
        onProgress(i / frameCount);
      }
      videoSource.close();
    };

    const copyAudio = async () => {
      if (audio && mixing) {
        const music =
          musicSettings && job.music
            ? await decodeStereo(job.music, MIX_RATE, map.outputDuration)
            : null;
        // Ducking needs to know when someone speaks in the recording.
        let duck: Float32Array | null = null;
        if (music && musicSettings?.duckUnderVoice && sourceAudio) {
          const mono = await decodeMono(job.video, 8_000);
          const speech = mono && speechMask(mono.samples, mono.sampleRate);
          if (speech) duck = duckCurve(speech, map);
        }
        await mixAudio({
          map,
          source: sourceAudio,
          sourceVolume,
          music: music && musicSettings ? { audio: music, settings: musicSettings } : null,
          duck,
          destination: audio.source,
          signal,
          onAbort: abort,
        });
        return;
      }
      if (!audio || !audioTrack) return;
      const sink = new AudioSampleSink(audioTrack);
      for (const piece of map.pieces) {
        // Speed changes would need resampling/time-stretching; until that
        // exists, sped-up/slowed parts are silent instead of wrong.
        if (piece.rate !== 1) continue;
        const start = piece.sourceStart / 1000;
        const end = piece.sourceEnd / 1000;
        for await (const sample of sink.samples(start, end)) {
          if (signal.aborted) {
            sample.close();
            await abort();
          }
          // A decoded chunk can straddle the cut points; keep only the frames
          // inside [start, end).
          const from = Math.max(0, Math.round((start - sample.timestamp) * sample.sampleRate));
          const to = Math.min(sample.numberOfFrames, Math.round((end - sample.timestamp) * sample.sampleRate));
          if (to > from) {
            const part = from === 0 && to === sample.numberOfFrames ? sample : sample.trim(from, to);
            const sourceTime = sample.timestamp + from / sample.sampleRate;
            part.setTimestamp(piece.outputStart / 1000 + (sourceTime - start));
            await audio.source.add(part);
            if (part !== sample) part.close();
          }
          sample.close();
        }
      }
      audio.source.close();
    };

    await Promise.all([renderVideo(), copyAudio()]);
    await output.finalize();

    const buffer = output.target.buffer;
    if (!buffer) throw new Error("The encoder produced no output.");
    return {
      blob: new Blob([buffer], { type: "video/mp4" }),
      width: size.width,
      height: size.height,
      durationMs: map.outputDuration,
      videoCodec,
      audioCodec: audio?.codec ?? null,
    };
  } finally {
    input.dispose();
  }
}

/** Output size for the export dialog's preview, without starting anything. */
export function exportSize(project: VidzProject, longSide: number) {
  return outputSize(outputAspect(project.settings.aspectRatio, project.source), longSide);
}
