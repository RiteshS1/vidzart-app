"use client";

import { useEffect, useRef } from "react";
import { outputAspect } from "@/lib/render/layout";
import { renderFrame } from "@/lib/render/renderFrame";
import { useEditorContext } from "./EditorContext";

// The live preview. Everything here runs in one requestAnimationFrame loop
// set up once in an effect: React renders this component a single time and
// never again, no matter how fast the video plays.
export function PreviewCanvas() {
  const { store, controller, video, cursorAt, getCursorTrack } = useEditorContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    // alpha: false: the background covers every pixel, and an opaque canvas
    // lets the browser skip blending it with the page.
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!container || !canvas || !ctx) return;

    // Redraw only when something changed. While playing, that's every frame;
    // while paused, only after a seek, an edit or a resize.
    let dirty = true;
    const markDirty = () => {
      dirty = true;
    };

    // Size the canvas to the largest box of the output's aspect ratio that
    // fits the container, at device-pixel resolution so it stays sharp on
    // retina screens.
    const resize = () => {
      const { project } = store.getState();
      const aspect = outputAspect(project.settings.aspectRatio, project.source);
      const box = container.getBoundingClientRect();
      let width = box.width;
      let height = width / aspect;
      if (height > box.height) {
        height = box.height;
        width = height * aspect;
      }
      canvas.style.width = `${Math.floor(width)}px`;
      canvas.style.height = `${Math.floor(height)}px`;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(2, Math.round(width * dpr));
      canvas.height = Math.max(2, Math.round(height * dpr));
      dirty = true;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let aspectSetting = store.getState().project.settings.aspectRatio;
    const unsubscribe = store.subscribe(() => {
      const next = store.getState().project.settings.aspectRatio;
      if (next !== aspectSetting) {
        aspectSetting = next;
        resize();
      }
      dirty = true;
    });

    // `seeked` fires once the frame at the new position is decoded, the
    // moment it's worth redrawing.
    video.addEventListener("seeked", markDirty);
    video.addEventListener("loadeddata", markDirty);

    let frame = 0;
    const loop = () => {
      controller.tick();
      if (dirty || controller.playing) {
        dirty = false;
        const { project } = store.getState();
        // readyState >= HAVE_CURRENT_DATA means there's a frame to draw.
        const hasFrame = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
        renderFrame(
          ctx,
          { width: canvas.width, height: canvas.height },
          {
            image: hasFrame ? video : null,
            // Intrinsic pixel size of the element's frames; falls back to the
            // probed size before the first frame has loaded.
            size: {
              width: video.videoWidth || project.source.width,
              height: video.videoHeight || project.source.height,
            },
          },
          project,
          { sourceTime: controller.getSourceTime(), cursorAt, cursor: getCursorTrack(project) },
        );
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      unsubscribe();
      video.removeEventListener("seeked", markDirty);
      video.removeEventListener("loadeddata", markDirty);
    };
  }, [store, controller, video, cursorAt, getCursorTrack]);

  return (
    <div ref={containerRef} className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
      <canvas
        ref={canvasRef}
        data-testid="preview-canvas"
        className="rounded-md shadow-sm"
        onClick={() => controller.toggle()}
      />
    </div>
  );
}
