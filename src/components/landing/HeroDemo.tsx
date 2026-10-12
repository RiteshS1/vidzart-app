"use client";

import { useEffect, useRef } from "react";
import { generateAutoZooms } from "@/lib/effects/autoZoom";
import { createCursorTrack } from "@/lib/effects/cursorTrack";
import { createCursorLookup } from "@/lib/events/cursor";
import type { VidzEvent, VidzEvents } from "@/lib/events/types";
import { createProject } from "@/lib/project/defaults";
import { renderFrame } from "@/lib/render/renderFrame";

// The landing page's live demo: Vidzart's real renderer (renderFrame, auto
// zoom, the smoothed cursor and click ripples) running on a mock app drawn
// on a canvas, with a scripted "user" clicking around. What you see is
// exactly what the editor produces, not a pre-rendered video.

const W = 1280;
const H = 800;
const LOOP_MS = 9000;

/** The scripted user: where the cursor goes, and where it clicks. */
const PATH: [t: number, x: number, y: number, click?: boolean][] = [
  [0, 640, 620],
  [900, 420, 420],
  [1700, 1040, 150],
  [2200, 1060, 160, true],
  [2600, 1050, 165],
  [3800, 760, 470],
  [4600, 330, 520],
  [5200, 340, 525, true],
  [5500, 330, 520, true],
  [6400, 620, 690],
  [7400, 640, 640],
  [LOOP_MS, 640, 620],
];

function scriptedEvents(): VidzEvents {
  const events: VidzEvent[] = [];
  for (let i = 0; i < PATH.length - 1; i++) {
    const [t0, x0, y0, click] = PATH[i]!;
    const [t1, x1, y1] = PATH[i + 1]!;
    if (click) {
      events.push({ t: t0, type: "down", x: x0, y: y0, button: 0 }, { t: t0 + 90, type: "up", x: x0, y: y0, button: 0 });
      events.push({ t: t0 + 90, type: "click", x: x0, y: y0, button: 0 });
    }
    // Human-ish motion: eased, with a little wobble the smoother removes.
    for (let t = t0; t < t1; t += 16) {
      const p = (t - t0) / (t1 - t0);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      events.push({ t, type: "move", x: x0 + (x1 - x0) * e + Math.sin(t / 37) * 3, y: y0 + (y1 - y0) * e + Math.cos(t / 41) * 3 });
    }
  }
  events.sort((a, b) => a.t - b.t);
  return { version: 1, viewport: { width: W, height: H, devicePixelRatio: 1 }, startedAt: 0, events };
}

/** A believable little analytics app, drawn fresh each frame (the chart animates). */
function drawApp(ctx: CanvasRenderingContext2D, t: number, clicked: { export: boolean; tab: boolean }) {
  ctx.fillStyle = "#f6f7fb";
  ctx.fillRect(0, 0, W, H);
  // sidebar
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, 220, H);
  ctx.fillStyle = "#8b7cff";
  ctx.beginPath();
  ctx.roundRect(28, 30, 36, 36, 10);
  ctx.fill();
  ctx.fillStyle = "#e5e7eb";
  ctx.font = "600 20px system-ui, sans-serif";
  ctx.fillText("Acme", 76, 56);
  ["Overview", "Reports", "Customers", "Settings"].forEach((label, i) => {
    const active = clicked.tab ? i === 1 : i === 0;
    if (active) {
      ctx.fillStyle = "rgba(139,124,255,0.18)";
      ctx.beginPath();
      ctx.roundRect(16, 120 + i * 56 - 26, 188, 42, 10);
      ctx.fill();
    }
    ctx.fillStyle = active ? "#ffffff" : "#9ca3af";
    ctx.font = "500 17px system-ui, sans-serif";
    ctx.fillText(label, 36, 120 + i * 56);
  });
  // header
  ctx.fillStyle = "#111827";
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText(clicked.tab ? "Reports" : "Overview", 260, 80);
  ctx.fillStyle = clicked.export ? "#4ade80" : "#6d5dfc";
  ctx.beginPath();
  ctx.roundRect(980, 128, 160, 48, 12);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillText(clicked.export ? "✓ Exported" : "Export", clicked.export ? 1004 : 1030, 159);
  // stat cards
  ["Revenue $48.2k", "Users 12,409", "Churn 1.8%"].forEach((label, i) => {
    const x = 260 + i * 300;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x, 210, 280, 120, 16);
    ctx.fill();
    const [name, value] = label.split(" ");
    ctx.fillStyle = "#6b7280";
    ctx.font = "500 16px system-ui, sans-serif";
    ctx.fillText(name!, x + 24, 248);
    ctx.fillStyle = "#111827";
    ctx.font = "700 32px system-ui, sans-serif";
    ctx.fillText(value!, x + 24, 296);
  });
  // chart
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(260, 360, 880, 380, 16);
  ctx.fill();
  ctx.strokeStyle = "#8b7cff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const x = 290 + i * 20.5;
    const y = 620 - 140 * (0.5 + 0.35 * Math.sin(i / 4 + t / 900) + 0.15 * Math.sin(i / 1.7));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function HeroDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;
    const app = document.createElement("canvas");
    app.width = W;
    app.height = H;
    const appCtx = app.getContext("2d")!;

    const log = scriptedEvents();
    const project = createProject({ duration: LOOP_MS, width: W, height: H, fps: 60 });
    project.settings.padding = 0.07;
    project.settings.background = { type: "gradient", from: "#6d5dfc", to: "#e27bc0", angle: 135 };
    project.settings.cursor = { visible: true, scale: 1.4, smoothing: 0.6 };
    project.segments = generateAutoZooms(log, LOOP_MS, { scale: 2, holdMs: 1400 });
    const cursorAt = createCursorLookup(log);
    const cursor = createCursorTrack(log, { smoothing: 0.6 });

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    const observer = new IntersectionObserver(([entry]) => (visible = entry?.isIntersecting ?? true));
    observer.observe(canvas);

    const start = performance.now();
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!visible) return; // don't burn CPU while scrolled away
      const t = reduced ? 2600 : (performance.now() - start) % LOOP_MS;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      drawApp(appCtx, t, { export: t > 2290 && t < 8000, tab: t > 5300 && t < 8000 });
      renderFrame(ctx, { width: w, height: h }, { image: app, size: { width: W, height: H } }, project, { sourceTime: t, cursorAt, cursor });
      if (reduced) cancelAnimationFrame(frame); // one still frame is enough
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="aspect-video w-full rounded-2xl"
      role="img"
      aria-label="Live demo: Vidzart zooms in on each click and follows a smooth cursor in a sample dashboard app"
    />
  );
}
