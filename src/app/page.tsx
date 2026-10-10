// Placeholder landing page. The real landing, dashboard and editor routes
// arrive in later phases (see CLAUDE.md → Roadmap).
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Vidzart</h1>
      <p className="max-w-md text-balance opacity-70">
        Record your screen, get a polished demo. Free, private, and it all
        runs in your browser.
      </p>
      <p className="text-sm opacity-50">Pre-alpha. Nothing to see yet.</p>
    </main>
  );
}
