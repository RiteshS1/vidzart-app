import { absoluteUrl, FAQ, REPO_APP, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

// Structured data (schema.org JSON-LD): tells search engines what this is, in
// a machine-readable way. Rendered into the static HTML at build time.

export function JsonLd({ data }: { data: object | object[] }) {
  // `<` is escaped so the JSON can never close the script tag early.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export const softwareApplication = () => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any (Chromium-based browser)",
  browserRequirements: "Requires WebCodecs (Chrome, Edge, or another Chromium browser)",
  isAccessibleForFree: true,
  license: "https://opensource.org/licenses/MIT",
  codeRepository: REPO_APP,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Automatic zooms on every click",
    "Smooth cursor and click effects",
    "On-device captions with SRT/VTT import and export",
    "Text, arrows and spotlights",
    "Background music with ducking",
    "Export to MP4, MOV and WebM up to 4K",
  ],
});

export const webSite = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: "en",
});

export const organization = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: absoluteUrl("/icon.svg"),
  sameAs: [REPO_APP, "https://github.com/RiteshS1/vidzart-extension"],
});

export const faqPage = () => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
});
