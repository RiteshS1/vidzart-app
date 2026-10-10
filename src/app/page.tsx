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
      <Link
        href="/record"
        className="mt-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85"
      >
        Start recording
      </Link>
    </main>
  );
}
