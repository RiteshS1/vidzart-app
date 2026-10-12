import { Rss } from "lucide-react";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { CHANGELOG } from "@/lib/site";

export const metadata: Metadata = {
  title: "Changelog",
  description: "What's new in Vidzart: features, fixes and improvements.",
  alternates: { canonical: "/changelog" },
};

export default function ChangelogPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-bold tracking-tight">Changelog</h1>
          <a href="/rss.xml" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
            <Rss className="size-4" aria-hidden /> RSS
          </a>
        </div>
        <ol className="mt-10 space-y-10 border-l border-line pl-6">
          {CHANGELOG.map((entry, i) => (
            <li key={`${entry.date}-${i}`} id={`${entry.date}-${i}`}>
              <time dateTime={entry.date} className="font-mono text-xs text-ink-faint">
                {entry.date}
              </time>
              <h2 className="mt-1 text-xl font-semibold">{entry.title}</h2>
              <p className="mt-2 text-ink-muted">{entry.summary}</p>
            </li>
          ))}
        </ol>
      </main>
      <SiteFooter />
    </>
  );
}
