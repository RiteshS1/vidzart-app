import type { Metadata, Viewport } from "next";
import { KEYWORDS, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";

// Space Grotesk for UI and headings, Space Mono for timecodes and numbers.
// next/font downloads them at build time and serves them from our own
// origin, so pages never request Google Fonts at runtime.
const sans = Space_Grotesk({
  variable: "--font-sans-face",
  subsets: ["latin"],
});

const mono = Space_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: KEYWORDS,
  authors: [{ name: "Ritesh Sharma", url: "https://github.com/RiteshS1" }],
  creator: "Ritesh Sharma",
  category: "multimedia",
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": [{ url: "/rss.xml", title: `${SITE_NAME} changelog` }] },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
    // A real file with a .png extension (not a generated extensionless
    // route): every static host then serves it with the right content type.
    images: [{ url: "/og.png", width: 1200, height: 630, alt: `${SITE_NAME}: ${SITE_TAGLINE}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      {/*
        suppressHydrationWarning: browser extensions (e.g. ColorZilla adds
        cz-shortcut-listen) edit <body> attributes before React hydrates,
        which triggers a hydration-mismatch warning that isn't our bug. This
        only silences attribute diffs on <body> itself, not on its children.
      */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* First tab stop: lets keyboard and screen-reader users skip the header. */}
        <a
          href="#main"
          className="sr-only z-[100] rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
