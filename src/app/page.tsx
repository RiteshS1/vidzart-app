import Link from "next/link";

// Placeholder landing page. The real landing page and dashboard arrive in
// later phases (see CLAUDE.md → Roadmap).
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Vidzart</h1>
      <p className="max-w-md text-balance opacity-70">
        Record your screen, get a polished demo. Free, private, and it all
        runs in your browser.
      </p>
      <div className="mt-2 flex gap-3">
        <Link
          href="/record"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85"
        >
          Start recording
        </Link>
        <Link
          href="/editor"
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Open a video
        </Link>
      </div>
    </main>
  );
}
