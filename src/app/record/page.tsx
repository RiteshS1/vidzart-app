import type { Metadata } from "next";
import Link from "next/link";
import { Recorder } from "@/components/recorder/Recorder";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Record your screen",
  description: "Record a tab, a window or your whole screen in the browser, then edit it with automatic zooms. Free, nothing is uploaded.",
  alternates: { canonical: "/record" },
};

// Phase 0 spike: record a tab/window/screen and download the raw file.
// The page itself is static; <Recorder> is a Client Component and only
// touches browser APIs inside event handlers and effects, so prerendering it
// at build time is safe.
export default function RecordPage() {
  return (
    <>
      <SiteHeader current="record" />
      <main id="main" className="flex flex-1 flex-col items-center gap-8 px-6 py-12">
        <div className="w-full max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight">Record your screen</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Records a tab, window or your whole screen right here. For automatic zooms on your clicks, record with the{" "}
            <Link href="/#install" className="text-ink underline underline-offset-4">
              Chrome extension
            </Link>{" "}
            instead.
          </p>
        </div>
        <Recorder />
      </main>
    </>
  );
}
