import {
  Captions,
  Download,
  Film,
  FolderClock,
  KeyRound,
  Lock,
  MousePointerClick,
  Music,
  Puzzle,
  Scissors,
  Sparkles,
  Type,
  Wand2,
  ZoomIn,
} from "lucide-react";
import Link from "next/link";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { MotionRoot, Reveal } from "@/components/landing/Reveal";
import { LINKS, SiteFooter, SiteHeader } from "@/components/site/SiteHeader";

// The landing page. Static HTML (a server component), with two client
// islands: the live demo (the real renderer) and scroll reveals.

const FEATURES = [
  {
    icon: ZoomIn,
    title: "Zooms that follow your clicks",
    text: "Recordings from the extension open already zoomed in on every click, and the camera glides with your cursor.",
    wide: true,
  },
  {
    icon: MousePointerClick,
    title: "A calm, smooth cursor",
    text: "Shaky mouse paths become deliberate motion, landing exactly on each click with a ripple.",
  },
  {
    icon: Captions,
    title: "Captions on your device",
    text: "Whisper runs in your browser. Edit, style and burn them in, or export SRT/VTT.",
  },
  {
    icon: Type,
    title: "Text, arrows & spotlights",
    text: "Titles, callouts and lower thirds with animations; arrows and spotlights that stick to the content.",
  },
  {
    icon: Scissors,
    title: "Cut like an editor",
    text: "Select and cut, speed up the boring parts, remove silences and “um”s in one click.",
  },
  {
    icon: Wand2,
    title: "Looks & transitions",
    text: "Backgrounds, color looks, fades and transitions at every cut.",
  },
  {
    icon: FolderClock,
    title: "Autosaved projects",
    text: "Every edit is kept in your browser. Pick up any project from your dashboard.",
  },
  {
    icon: Music,
    title: "Music that ducks under your voice",
    text: "Add a track; it loops, fades and gets quieter whenever you talk.",
    wide: true,
  },
  {
    icon: Film,
    title: "Export MP4 up to 4K",
    text: "Rendered in your browser with WebCodecs, at 30 or 60 fps. What you preview is what you get.",
    wide: true,
  },
];

const STEPS = [
  { title: "Record", text: "Click the Vidzart icon on any tab and press Record. Your clicks and cursor are tracked; your typing never is." },
  { title: "Polish", text: "The editor opens with zooms already in place. Trim, add text, music and captions. It autosaves in your browser." },
  { title: "Export", text: "Download an MP4 and subtitles, or a .vidz project file to continue later." },
];

export default function Home() {
  return (
    <MotionRoot>
      <SiteHeader />
      <main className="flex-1 overflow-x-clip">
        {/* Hero */}
        <section className="relative">
          {/* Soft brand glow behind the hero. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[520px] max-w-4xl rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--accent), transparent), radial-gradient(closest-side, var(--accent-2), transparent)" }}
          />
          <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
            <Reveal>
              <span className="rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs text-ink-muted">
                free · open source · runs in your browser
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="max-w-4xl text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
                Screen recordings that <span className="text-brand">edit themselves</span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="max-w-2xl text-lg text-pretty text-ink-muted">
                Record a tab and Vidzart zooms in on every click, smooths your cursor and frames it beautifully. Add captions,
                text and music, then export. Your videos never leave your computer.
              </p>
            </Reveal>
            <Reveal delay={0.15} className="flex flex-wrap justify-center gap-3">
              <Link
                href="/editor"
                className="bg-brand inline-flex h-11 items-center gap-2 rounded-xl px-5 font-semibold text-white shadow-[0_0_32px_-8px_var(--accent)] hover:brightness-110"
              >
                <Sparkles className="size-4" aria-hidden /> Open the editor
              </Link>
              <a
                href="#install"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-surface px-5 font-semibold hover:bg-surface-2"
              >
                <Puzzle className="size-4" aria-hidden /> Get the Chrome extension
              </a>
            </Reveal>
            <Reveal delay={0.2} className="mt-8 w-full">
              <div className="rounded-3xl border border-line bg-surface/60 p-2 shadow-2xl shadow-black/60 sm:p-3">
                <HeroDemo />
              </div>
              <p className="mt-3 font-mono text-xs text-ink-faint">Live: this is Vidzart’s own renderer running in your browser.</p>
            </Reveal>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="features-title">
          <Reveal>
            <h2 id="features-title" className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              Everything a great demo needs
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-ink-muted">The polish of a pro screen-recording studio, without the editing hours.</p>
          </Reveal>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <li key={f.title} className={f.wide ? "lg:col-span-2" : undefined}>
                <Reveal delay={(i % 4) * 0.04} className="h-full">
                  <div className="h-full rounded-2xl border border-line bg-surface p-6 transition-colors duration-200 hover:border-line-strong">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-surface-3">
                      <f.icon className="size-5 text-accent" aria-hidden />
                    </span>
                    <h3 className="mt-4 font-semibold">{f.title}</h3>
                    <p className="mt-1.5 text-sm text-ink-muted">{f.text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section className="border-y border-line bg-surface/40" aria-labelledby="how-title">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <Reveal>
              <h2 id="how-title" className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
                Record. Polish. Export.
              </h2>
            </Reveal>
            <ol className="mt-12 grid gap-6 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <Reveal delay={i * 0.06}>
                    <span className="font-mono text-sm text-accent">0{i + 1}</span>
                    <h3 className="mt-2 text-xl font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm text-ink-muted">{step.text}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Install */}
        <section id="install" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6" aria-labelledby="install-title">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <Reveal>
              <h2 id="install-title" className="text-3xl font-bold tracking-tight sm:text-4xl">
                Get the Chrome extension
              </h2>
              <p className="mt-3 text-ink-muted">
                The extension records a tab together with your clicks and cursor, which is what makes the automatic zooms
                possible. It’s installed from source for now (it isn’t on the Chrome Web Store), which takes a minute.
              </p>
              <p className="mt-4 text-sm text-ink-muted">
                No extension? You can still{" "}
                <Link href="/record" className="text-ink underline underline-offset-4">
                  record your screen here
                </Link>{" "}
                or{" "}
                <Link href="/editor" className="text-ink underline underline-offset-4">
                  edit any video
                </Link>
                .
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <ol className="space-y-3 rounded-2xl border border-line bg-surface p-6 text-sm">
                <li className="flex gap-3">
                  <span className="font-mono text-accent">1</span>
                  <span>
                    Clone and build:{" "}
                    <code className="mt-2 block rounded-lg bg-bg px-3 py-2 font-mono text-xs leading-relaxed text-ink">
                      git clone {LINKS.extension}.git
                      <br />
                      cd vidzart-extension && pnpm install && pnpm build
                    </code>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-accent">2</span>
                  <span>
                    Open <code className="font-mono text-ink">chrome://extensions</code> and turn on <b>Developer mode</b>.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-accent">3</span>
                  <span>
                    <b>Load unpacked</b> → choose the <code className="font-mono text-ink">dist/chrome-mv3</code> folder. Pin
                    Vidzart, open any tab and press Record.
                  </span>
                </li>
              </ol>
              <a href={LINKS.extension} className="mt-4 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
                <Download className="size-4" aria-hidden /> Source on GitHub
              </a>
            </Reveal>
          </div>
        </section>

        {/* Privacy */}
        <section className="border-t border-line bg-surface/40" aria-labelledby="privacy-title">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-3">
            <Reveal>
              <h2 id="privacy-title" className="text-3xl font-bold tracking-tight">
                Private by design
              </h2>
              <p className="mt-3 text-ink-muted">There are no Vidzart servers, accounts or cloud storage. Everything happens on your device.</p>
            </Reveal>
            {[
              { icon: Lock, title: "Your videos stay local", text: "Projects autosave in your browser. Export or save a file whenever you like." },
              {
                icon: KeyRound,
                title: "AI on your terms",
                text: "Captions run on-device. Optional writing tools use your own API key, stored only in your browser.",
              },
            ].map((p, i) => (
              <Reveal key={p.title} delay={0.05 + i * 0.05}>
                <p.icon className="size-5 text-accent" aria-hidden />
                <h3 className="mt-3 font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-sm text-ink-muted">{p.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
          <Reveal>
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Make your next demo look great</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/editor" className="bg-brand inline-flex h-11 items-center rounded-xl px-6 font-semibold text-white hover:brightness-110">
                Open the editor
              </Link>
              <a
                href={LINKS.coffee}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center rounded-xl border border-line-strong px-6 font-semibold hover:bg-surface-2"
              >
                Buy me a coffee
              </a>
            </div>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </MotionRoot>
  );
}
