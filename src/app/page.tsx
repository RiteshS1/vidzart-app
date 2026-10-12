import {
  ArrowRight,
  Captions,
  Download,
  Film,
  KeyRound,
  Lock,
  MousePointerClick,
  Music,
  Puzzle,
  Type,
  ZoomIn,
} from "lucide-react";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { LandingScene } from "@/components/landing/LandingScene";
import { MotionLink } from "@/components/landing/MotionLink";
import { Timecode } from "@/components/landing/Timecode";
import { JsonLd, organization, softwareApplication, webSite } from "@/components/site/JsonLd";
import { LINKS, SiteFooter, SiteHeader } from "@/components/site/SiteHeader";

// The landing page: static HTML (a server component) with client islands
// for the live demo, the timecode and the GSAP/Motion animations
// (LandingScene reads the data-* attributes below).

const TAKES = [
  {
    icon: ZoomIn,
    title: "Every click, framed",
    text: "Recordings from the extension open already zoomed in on each click. The camera glides after your cursor with a dead zone, so it never shakes.",
    spec: "auto zoom · follow camera · spring easing",
  },
  {
    icon: MousePointerClick,
    title: "A calm, deliberate cursor",
    text: "Your real mouse path, smoothed. It still lands exactly on every click, with a ripple so viewers see what happened.",
    spec: "smoothing · click effects · ⌘K badges",
  },
  {
    icon: Captions,
    title: "Captions without the cloud",
    text: "Whisper runs inside your browser. Edit the words, burn them in, or export SRT and VTT. Cut silences and “um”s in a click.",
    spec: "on-device whisper · srt / vtt",
  },
  {
    icon: Type,
    title: "Titles, arrows, spotlights",
    text: "Animated text and lower thirds that stay put, and arrows, boxes and spotlights that stick to the content while the camera moves.",
    spec: "text · shapes · blur boxes",
  },
  {
    icon: Music,
    title: "Sound that sits right",
    text: "Add a music bed that loops, fades and dips under your voice automatically. Keep, lower or mute the recording's own audio.",
    spec: "music · ducking · fades",
  },
  {
    icon: Film,
    title: "Export, up to 4K",
    text: "Rendered in your browser with WebCodecs at 30 or 60 fps. The preview and the export run the same renderer: what you see is what you get.",
    spec: "h.264 mp4 · 720p–4k · 30/60 fps",
  },
];

const MARQUEE = ["Auto zoom", "Smooth cursor", "Click ripples", "Captions", "Text & titles", "Spotlights", "Music ducking", "Cut silences", "4K export", "No uploads"];

const STEPS = [
  { title: "Record", text: "Open any tab, click the Vidzart icon, press Record. Clicks and cursor are tracked; your typing never is." },
  { title: "Polish", text: "The editor opens with zooms in place. Trim, add text, music and captions. It autosaves as you go." },
  { title: "Export", text: "Download an MP4 (and subtitles), or a .vidz project to pick up later." },
];

export default function Home() {
  return (
    <LandingScene>
      <noscript>
        <style>{`.landing [data-split],.landing [data-reveal]{opacity:1!important}`}</style>
      </noscript>
      <SiteHeader />
      <JsonLd data={[softwareApplication(), webSite(), organization()]} />
      <main id="main" className="flex-1 overflow-x-clip">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-6 sm:pt-24">
          <div data-reveal className="flex flex-wrap items-center gap-3 font-mono text-xs text-ink-muted">
            <span className="flex items-center gap-1.5 rounded-sm border border-line px-2 py-1 text-ink">
              <span className="tally size-2 rounded-full bg-record" aria-hidden /> REC <Timecode />
            </span>
            <span>free · open source · runs in your browser</span>
          </div>
          <h1
            data-split="lines"
            className="mt-6 max-w-5xl text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.95] font-bold tracking-[-0.035em]"
          >
            Screen recordings that edit themselves.
          </h1>
          <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <p data-reveal="0.2" className="max-w-xl text-lg text-ink-muted">
              Record a tab and Vidzart zooms in on every click, smooths your cursor and frames it like a studio would. Add
              captions, text and music, then export. Nothing leaves your computer.
            </p>
            <div data-reveal="0.3" className="flex shrink-0 flex-wrap gap-3">
              <MotionLink href="/editor" className="inline-flex h-12 items-center gap-2 rounded-lg bg-ink px-5 font-semibold text-bg hover:bg-white">
                Open the editor <ArrowRight className="size-4" aria-hidden />
              </MotionLink>
              <MotionLink
                href="#install"
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-line-strong px-5 font-semibold hover:bg-surface-2"
              >
                <Puzzle className="size-4" aria-hidden /> Get the extension
              </MotionLink>
            </div>
          </div>
        </section>

        {/* The live demo, framed like a camera monitor */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6" style={{ perspective: "1400px" }}>
          <div data-demo className="relative rounded-xl border border-line-strong bg-surface p-2 shadow-2xl shadow-black/70 sm:p-3">
            <div className="mb-2 flex items-center justify-between px-1 font-mono text-[11px] text-ink-muted sm:mb-3">
              <span className="flex items-center gap-2">
                <span className="tally size-2 rounded-full bg-record" aria-hidden /> LIVE · vidzart renderer
              </span>
              <span className="hidden sm:inline">auto zoom on · smooth cursor on</span>
            </div>
            <div className="relative">
              <HeroDemo />
              {/* Viewfinder corners */}
              {[
                "top-2 left-2 border-t-2 border-l-2",
                "top-2 right-2 border-t-2 border-r-2",
                "bottom-2 left-2 border-b-2 border-l-2",
                "right-2 bottom-2 border-r-2 border-b-2",
              ].map((c) => (
                <span key={c} aria-hidden className={`pointer-events-none absolute size-5 border-accent/80 ${c}`} />
              ))}
            </div>
          </div>
          <p data-reveal className="mt-4 font-mono text-xs text-ink-faint">
            Not a video: this is Vidzart’s own renderer, running live in your browser on a mock app.
          </p>
        </section>

        {/* Marquee */}
        <section aria-hidden className="overflow-hidden border-y border-line bg-surface py-4">
          <div data-marquee className="flex w-max gap-10 font-mono text-sm tracking-wide text-ink-muted uppercase">
            {[...MARQUEE, ...MARQUEE].map((word, i) => (
              <span key={i} className="flex items-center gap-10">
                {word} <span className="size-1.5 rounded-full bg-accent" />
              </span>
            ))}
          </div>
        </section>

        {/* Features: pinned, scrolling sideways through the "takes" on desktop */}
        <section data-hscroll aria-labelledby="takes-title" className="overflow-hidden py-20 lg:flex lg:h-dvh lg:items-center lg:py-0">
          <div
            data-hscroll-track
            className="flex flex-col gap-6 px-4 sm:px-6 lg:w-max lg:flex-row lg:gap-8 lg:pr-[10vw] lg:pl-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))]"
          >
            <div className="flex max-w-md shrink-0 flex-col justify-center lg:w-[28rem]">
              <p className="font-mono text-xs text-accent uppercase">The edit, done for you</p>
              <h2 id="takes-title" data-split="scroll" className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                Everything a great demo needs.
              </h2>
              <p data-reveal className="mt-4 text-ink-muted">
                The polish of a screen-recording studio, without the editing hours. Scroll through the takes.
              </p>
            </div>
            {TAKES.map((take, i) => (
              <article
                key={take.title}
                data-reveal
                className="flex shrink-0 flex-col justify-between rounded-xl border border-line bg-surface p-7 lg:h-[62vh] lg:w-[min(30rem,80vw)]"
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-sm text-ink-faint">TAKE {String(i + 1).padStart(2, "0")}</span>
                  <take.icon className="size-7 text-accent" aria-hidden />
                </div>
                {/* A big outlined take number, like a film slate. */}
                <span
                  aria-hidden
                  className="mt-6 hidden font-mono text-[9rem] leading-none font-bold text-transparent select-none lg:block"
                  style={{ WebkitTextStroke: "1px var(--line-strong)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="mt-10 lg:mt-0">
                  <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">{take.title}</h3>
                  <p className="mt-3 text-ink-muted">{take.text}</p>
                  <p className="mt-6 border-t border-line pt-4 font-mono text-xs text-ink-faint uppercase">{take.spec}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* How it works: a timeline that draws itself */}
        <section className="border-y border-line bg-surface/50" aria-labelledby="how-title">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <h2 id="how-title" data-split="scroll" className="text-4xl font-bold tracking-tight sm:text-5xl">
              Record. Polish. Export.
            </h2>
            <div className="relative mt-14">
              <div className="absolute top-3 right-0 left-0 hidden h-px bg-line sm:block" aria-hidden />
              <div data-progress className="absolute top-3 right-0 left-0 hidden h-px origin-left bg-accent sm:block" aria-hidden />
              <ol className="relative grid gap-10 sm:grid-cols-3">
                {STEPS.map((step, i) => (
                  <li key={step.title} data-reveal={String(i * 0.1)}>
                    <span className="flex size-6 items-center justify-center rounded-full border border-accent bg-bg font-mono text-[11px] text-accent">
                      {i + 1}
                    </span>
                    <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm text-ink-muted">{step.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Install */}
        <section id="install" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6" aria-labelledby="install-title">
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <div>
              <p className="font-mono text-xs text-accent uppercase">Chrome extension</p>
              <h2 id="install-title" data-split="scroll" className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                The part that sees your clicks.
              </h2>
              <p data-reveal className="mt-4 text-ink-muted">
                The extension records a tab together with your clicks and cursor, which is what makes the automatic zooms
                possible. It installs from source for now (not on the Chrome Web Store yet); it takes a minute.
              </p>
              <p data-reveal className="mt-4 text-sm text-ink-muted">
                No extension? You can still{" "}
                <MotionLink href="/record" className="text-ink underline underline-offset-4">
                  record your screen here
                </MotionLink>{" "}
                or{" "}
                <MotionLink href="/editor" className="text-ink underline underline-offset-4">
                  edit any video
                </MotionLink>
                .
              </p>
            </div>
            <div data-reveal="0.1">
              <ol className="divide-y divide-line rounded-xl border border-line bg-surface text-sm">
                <li className="flex gap-4 p-5">
                  <span className="font-mono text-accent">01</span>
                  <span className="min-w-0">
                    Clone and build
                    <code className="mt-2 block overflow-x-auto rounded-md bg-bg px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre text-ink">
                      {`git clone ${LINKS.extension}.git\ncd vidzart-extension && pnpm install && pnpm build`}
                    </code>
                  </span>
                </li>
                <li className="flex gap-4 p-5">
                  <span className="font-mono text-accent">02</span>
                  <span>
                    Open <code className="font-mono text-ink">chrome://extensions</code> and turn on <b>Developer mode</b>.
                  </span>
                </li>
                <li className="flex gap-4 p-5">
                  <span className="font-mono text-accent">03</span>
                  <span>
                    <b>Load unpacked</b> → pick <code className="font-mono text-ink">dist/chrome-mv3</code>. Pin Vidzart, open any
                    tab, press Record.
                  </span>
                </li>
              </ol>
              <a href={LINKS.extension} className="mt-4 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
                <Download className="size-4" aria-hidden /> Source on GitHub
              </a>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="border-t border-line" aria-labelledby="privacy-title">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-3">
            <div>
              <h2 id="privacy-title" data-split="scroll" className="text-4xl font-bold tracking-tight">
                Private by design.
              </h2>
              <p data-reveal className="mt-3 text-ink-muted">
                No Vidzart servers, accounts or cloud storage. Recording, editing, captions and export all happen on your
                device.
              </p>
            </div>
            {[
              { icon: Lock, title: "Your videos stay local", text: "Projects autosave in your browser. Export or save a file whenever you like." },
              {
                icon: KeyRound,
                title: "AI on your terms",
                text: "Captions run on-device. Optional writing tools use your own API key, kept only in your browser.",
              },
            ].map((p, i) => (
              <div key={p.title} data-reveal={String(0.1 + i * 0.1)} className="border-l border-line pl-6">
                <p.icon className="size-5 text-accent" aria-hidden />
                <h3 className="mt-3 font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-sm text-ink-muted">{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final call */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
            <h2 data-split="scroll" className="max-w-4xl text-[clamp(2.5rem,6vw,5rem)] leading-[0.95] font-bold tracking-[-0.03em]">
              Make your next demo look like it took a day.
            </h2>
            <div data-reveal className="mt-10 flex flex-wrap gap-3">
              <MotionLink href="/editor" className="inline-flex h-12 items-center gap-2 rounded-lg bg-ink px-6 font-semibold text-bg hover:bg-white">
                Open the editor <ArrowRight className="size-4" aria-hidden />
              </MotionLink>
              <MotionLink
                href={LINKS.coffee}
                external
                className="inline-flex h-12 items-center rounded-lg border border-line-strong px-6 font-semibold hover:bg-surface-2"
              >
                Buy me a coffee
              </MotionLink>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </LandingScene>
  );
}
