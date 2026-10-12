import type { Metadata } from "next";
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
  title: "Vidzart",
  description: "Free, local-first screen recorder and editor for polished product demos.",
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
        {children}
      </body>
    </html>
  );
}
