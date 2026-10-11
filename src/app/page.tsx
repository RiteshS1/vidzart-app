import Link from "next/link";

// The landing page: what Vidzart does, how it works, and where to start.
// Static (a server component with no data), so it's plain HTML in out/.

const EXTENSION_REPO = "https://github.com/RiteshS1/vidzart-extension";
const APP_REPO = "https://github.com/RiteshS1/vidzart-app";
const COFFEE = "https://buymeacoffee.com/riteshs";

const FEATURES = [
  {
    icon: "🔍",
    title: "Zooms that follow your clicks",
    text: "Auto zoom pushes in on what you click and eases back out. Adjust any zoom on the timeline, or let it follow the cursor.",
  },
  {
    icon: "🖱️",
    title: "A smooth cursor, with click effects",
    text: "Jittery mouse paths become calm, deliberate motion that still lands exactly on every click, with a ripple or pulse.",
  },
  {
    icon: "🎨",
    title: "Looks good out of the box",
    text: "Gradient backgrounds, padding, rounded corners and a soft shadow. Pick 16:9, vertical 9:16 or square for any platform.",
  },
  {
    icon: "💬",
    title: "Captions, made on your device",
    text: "Whisper runs right in your browser: edit the text, burn captions into the video or download SRT/VTT.",
  },
  {
    icon: "✂️",
    title: "Cut the dead air",
    text: "Remove long pauses and “um”s in one click, each as a single undo step. Trim and cut anything else by hand.",
  },
  {
    icon: "🎬",
    title: "Export MP4 up to 4K",
    text: "Rendered in your browser with WebCodecs at 30 or 60 fps. What you see in the preview is exactly what you get.",
  },
];

const STEPS = [
  {
    title: "Record",
    text: "Record a tab with the Chrome extension (it also logs your clicks for auto zoom), or record any screen or window right here.",
  },
  { title: "Polish", text: "Auto zoom, style the frame, add captions, cut silences. Your edits save in this browser as you go." },
  { title: "Export", text: "Download an MP4 (and subtitles), or save a .vidz project file to continue later." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <span className="font-semibold tracking-tight">Vidzart</span>
        <nav className="flex gap-5 text-sm opacity-70">
          <Link href="/editor" className="hover:opacity-100">
            Editor
          </Link>
          <Link href="/record" className="hover:opacity-100">
            Record
          </Link>
          <a href={APP_REPO} className="hover:opacity-100">
            GitHub
          </a>
          <a href={COFFEE} className="hover:opacity-100">
            ☕ Support
          </a>
        </nav>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pt-16 pb-20 text-center">
          <span className="rounded-full border border-black/10 px-3 py-1 text-xs opacity-70 dark:border-white/15">
            Free · open source · runs in your browser
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Polished screen demos,{" "}
            <span className="bg-gradient-to-r from-[#6d5dfc] to-[#d16ba5] bg-clip-text text-transparent">
              without the editing
            </span>
          </h1>
          <p className="max-w-xl text-balance text-lg opacity-70">
            Record your product, and Vidzart adds smooth zooms that follow your clicks, a clean cursor, a nice
            background and captions. Nothing is uploaded: your videos never leave your computer.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/record"
              className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
            >
              Start recording
            </Link>
            <Link
              href="/editor"
              className="rounded-md border border-black/15 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Open a video
            </Link>
            <a
              href={EXTENSION_REPO}
              className="rounded-md border border-black/15 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Get the Chrome extension
            </a>
          </div>
        </section>

        <section className="bg-black/[.03] py-16 dark:bg-white/[.03]" aria-labelledby="features-title">
          <div className="mx-auto max-w-5xl px-6">
            <h2 id="features-title" className="mb-10 text-center text-2xl font-semibold tracking-tight">
              Everything a good demo needs
            </h2>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="rounded-xl bg-background p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                  <span className="text-2xl" aria-hidden>
                    {f.icon}
                  </span>
                  <h3 className="mt-3 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm opacity-70">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-16" aria-labelledby="how-title">
          <h2 id="how-title" className="mb-10 text-center text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                  {i + 1}
                </span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm opacity-70">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-black/[.03] py-16 dark:bg-white/[.03]" aria-labelledby="privacy-title">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 sm:grid-cols-2">
            <div>
              <h2 id="privacy-title" className="text-2xl font-semibold tracking-tight">
                Private by design
              </h2>
              <p className="mt-3 opacity-70">
                There are no Vidzart servers, accounts or cloud storage. Recording, editing, captions and export
                all happen on your device.
              </p>
            </div>
            <ul className="flex flex-col gap-3 text-sm">
              <li>
                <strong>Your videos stay local.</strong>{" "}
                <span className="opacity-70">Projects are kept in this browser; export or save a file whenever you like.</span>
              </li>
              <li>
                <strong>Typing is never logged.</strong>{" "}
                <span className="opacity-70">The extension records clicks and cursor moves, and only Ctrl/⌘/Alt shortcuts.</span>
              </li>
              <li>
                <strong>AI on your terms.</strong>{" "}
                <span className="opacity-70">
                  Captions run on-device. Optional extras use your own API key, stored only in your browser and sent
                  straight to the provider you pick.
                </span>
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl flex-wrap justify-between gap-2 px-6 py-6 text-xs opacity-60">
        <span>
          Vidzart is free and open source (MIT). Found it helpful?{" "}
          <a href={COFFEE} className="underline">
            Buy me a coffee ☕
          </a>
        </span>
        <span className="flex gap-4">
          <a href={APP_REPO} className="hover:underline">
            Web app
          </a>
          <a href={EXTENSION_REPO} className="hover:underline">
            Chrome extension
          </a>
        </span>
      </footer>
    </div>
  );
}
