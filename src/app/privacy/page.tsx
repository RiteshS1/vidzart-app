import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Vidzart has no servers, accounts or analytics: recording, editing and export all happen on your device.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Your videos",
    body: [
      "Recording, editing, captions and export all run in your browser. Vidzart has no servers that receive your videos, audio, screenshots or project data.",
      "Projects are kept in your browser's own storage (IndexedDB) on your device. Clearing your site data removes them. Download an export if you want a file to keep.",
    ],
  },
  {
    title: "The Chrome extension",
    body: [
      "It records the tab you press Record on, together with pointer movement, clicks, scrolls and keyboard shortcuts that include Ctrl, Cmd or Alt. Plain typed characters are never recorded, so passwords and messages don't end up in a file.",
      "Permissions: activeTab, scripting, tabCapture and offscreen. It has no host permissions and cannot read other tabs.",
    ],
  },
  {
    title: "Captions and AI",
    body: [
      "On-device captions download the Whisper speech model from Hugging Face and the ONNX runtime from jsDelivr once; your audio is never sent anywhere.",
      "Optional writing tools use an API key you provide. The key is stored only in your browser and requests go straight from your browser to the provider you pick; only the transcript text is sent.",
    ],
  },
  {
    title: "What we don't do",
    body: ["No accounts, no analytics, no tracking cookies, no advertising, no third-party scripts on the pages you use to edit."],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="text-4xl font-bold tracking-tight">Privacy</h1>
        <p className="mt-3 text-ink-muted">Short version: it all happens on your device.</p>
        {SECTIONS.map((s) => (
          <section key={s.title} className="mt-10">
            <h2 className="text-xl font-semibold">{s.title}</h2>
            {s.body.map((p) => (
              <p key={p} className="mt-3 text-ink-muted">
                {p}
              </p>
            ))}
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
