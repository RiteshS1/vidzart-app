import { Clapperboard, Coffee } from "lucide-react";
import Link from "next/link";

/** External destinations, kept in one place so the header, footer and landing agree. */
export const LINKS = {
  app: "https://github.com/RiteshS1/vidzart-app",
  extension: "https://github.com/RiteshS1/vidzart-extension",
  coffee: "https://buymeacoffee.com/riteshs",
};

/** The header shared by the landing page, the projects dashboard and the recorder. */
export function SiteHeader({ current }: { current?: "projects" | "record" }) {
  // Hide secondary links on small screens; "Open editor" always stays visible.
  const item = (active: boolean) =>
    `rounded-md px-3 py-1.5 transition-colors duration-150 ${active ? "bg-surface-2 text-ink" : "text-ink-muted hover:text-ink"}`;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="mr-2 flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent" aria-hidden>
            <Clapperboard className="size-4 text-accent-ink" />
          </span>
          Vidzart
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          <Link href="/projects" className={item(current === "projects")} aria-current={current === "projects" ? "page" : undefined}>
            Projects
          </Link>
          <Link href="/record" className={`${item(current === "record")} hidden sm:block`} aria-current={current === "record" ? "page" : undefined}>
            Record
          </Link>
          <a href={LINKS.app} className={`${item(false)} hidden sm:block`}>
            GitHub
          </a>
        </nav>
        <span className="flex-1" />
        <a
          href={LINKS.coffee}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 text-sm text-ink-muted hover:text-ink md:flex"
        >
          <Coffee className="size-4" aria-hidden /> Support
        </a>
        <Link href="/editor" className="ml-2 rounded-lg bg-ink px-3.5 py-1.5 text-sm font-semibold text-bg hover:bg-white">
          Open editor
        </Link>
      </div>
    </header>
  );
}

/** Footer shared by the content pages: legal-ish links, feeds and the repos. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ink-muted sm:px-6">
        <span>Vidzart is free and open source (MIT). No accounts, no uploads.</span>
        <span className="flex flex-wrap gap-4">
          <a href="/faq" className="hover:text-ink">
            FAQ
          </a>
          <a href="/privacy" className="hover:text-ink">
            Privacy
          </a>
          <a href="/changelog" className="hover:text-ink">
            Changelog
          </a>
          <a href="/rss.xml" className="hover:text-ink">
            RSS
          </a>
          <a href={LINKS.app} className="hover:text-ink">
            Web app
          </a>
          <a href={LINKS.extension} className="hover:text-ink">
            Chrome extension
          </a>
          <a href={LINKS.coffee} target="_blank" rel="noreferrer" className="hover:text-ink">
            Buy me a coffee
          </a>
        </span>
      </div>
    </footer>
  );
}
