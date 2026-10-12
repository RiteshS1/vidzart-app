import type { Metadata } from "next";
import { JsonLd, faqPage } from "@/components/site/JsonLd";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { FAQ } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ",
  description: "How Vidzart works, what it costs, what it records, and where your videos and API keys are kept.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <>
      <SiteHeader />
      <JsonLd data={faqPage()} />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="text-4xl font-bold tracking-tight">Frequently asked questions</h1>
        <dl className="mt-10 divide-y divide-line border-y border-line">
          {FAQ.map((f) => (
            <div key={f.question} className="py-6">
              <dt className="text-lg font-semibold">{f.question}</dt>
              <dd className="mt-2 text-ink-muted">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </main>
      <SiteFooter />
    </>
  );
}
