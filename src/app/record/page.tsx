import type { Metadata } from "next";
import Link from "next/link";
import { Recorder } from "@/components/recorder/Recorder";

export const metadata: Metadata = {
  title: "Record · Vidzart",
};

// Phase 0 spike: record a tab/window/screen and download the raw file.
// The page itself is static; <Recorder> is a Client Component and only
// touches browser APIs inside event handlers and effects, so prerendering it
// at build time is safe.
export default function RecordPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <header className="flex w-full max-w-3xl items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Record</h1>
        <Link href="/" className="text-sm opacity-60 hover:opacity-100">
          ← Vidzart
        </Link>
      </header>
      <Recorder />
    </main>
  );
}
