// One source of truth for everything search engines, social cards, feeds and
// AI crawlers read about Vidzart: metadata, robots, sitemap, RSS, llms.txt and
// the visible FAQ/changelog pages all come from here, so they can't drift.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://vidzart.vercel.app").replace(/\/$/, "");
export const SITE_NAME = "Vidzart";
export const SITE_TAGLINE = "Screen recordings that edit themselves";
export const SITE_DESCRIPTION =
  "Free, private screen recorder and video editor in your browser: automatic zooms on every click, smooth cursor, captions, text, music and 4K export. Nothing is uploaded.";
export const REPO_APP = "https://github.com/RiteshS1/vidzart-app";
export const REPO_EXTENSION = "https://github.com/RiteshS1/vidzart-extension";
export const COFFEE_URL = "https://buymeacoffee.com/riteshs";
export const KEYWORDS = [
  "screen recorder",
  "screen recording editor",
  "auto zoom screen recording",
  "product demo video",
  "tutorial video maker",
  "Cursorful alternative",
  "Screen Studio alternative",
  "free video editor",
  "browser video editor",
  "local first",
  "privacy",
];

export interface Page {
  path: string;
  title: string;
  description: string;
  /** In the sitemap and indexable. */
  indexable: boolean;
  priority: number;
}

export const PAGES: Page[] = [
  { path: "/", title: `${SITE_NAME}: ${SITE_TAGLINE}`, description: SITE_DESCRIPTION, indexable: true, priority: 1 },
  {
    path: "/record",
    title: "Record your screen",
    description: "Record a tab, a window or your whole screen in the browser, then edit it with automatic zooms. Free, nothing is uploaded.",
    indexable: true,
    priority: 0.7,
  },
  {
    path: "/faq",
    title: "FAQ",
    description: "How Vidzart works, what it costs, what it records, and where your videos and API keys are kept.",
    indexable: true,
    priority: 0.6,
  },
  {
    path: "/privacy",
    title: "Privacy",
    description: "Vidzart has no servers, accounts or analytics: recording, editing and export all happen on your device.",
    indexable: true,
    priority: 0.5,
  },
  {
    path: "/changelog",
    title: "Changelog",
    description: "What's new in Vidzart: features, fixes and improvements.",
    indexable: true,
    priority: 0.5,
  },
  // App shells: useful to people, thin for search engines.
  { path: "/editor", title: "Editor", description: "The Vidzart editor.", indexable: false, priority: 0 },
  { path: "/projects", title: "Projects", description: "Your projects, saved in this browser.", indexable: false, priority: 0 },
];

export const absoluteUrl = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

export const FAQ: { question: string; answer: string }[] = [
  {
    question: "Is Vidzart free?",
    answer:
      "Yes, completely. There is no paid tier, no accounts and no watermark. If it helps you, there's an optional Buy me a coffee link.",
  },
  {
    question: "Are my videos uploaded anywhere?",
    answer:
      "No. Recording, editing, captions and export all run in your browser. Projects are kept in your browser's storage on your device. Vidzart has no servers that receive your videos.",
  },
  {
    question: "How do automatic zooms work?",
    answer:
      "The Chrome extension records a tab together with your clicks and cursor position (never your typing). The editor uses that click log to zoom in on each click and glide with the cursor. Recordings made without the extension can still be edited with manual zooms.",
  },
  {
    question: "Does it record what I type?",
    answer:
      "No. Only keyboard shortcuts that include Ctrl, Cmd or Alt are noted (to show badges like ⌘K). Plain typed characters, including passwords, are never recorded.",
  },
  {
    question: "Which formats can I export?",
    answer: "MP4 (plays everywhere), MOV (for Apple apps and editors) and WebM (open format, small files), up to 4K at 30 or 60 fps.",
  },
  {
    question: "How do captions work?",
    answer:
      "Captions can be generated on your device with the Whisper speech model (downloaded once, then cached), or you can upload an .srt or .vtt file. They can be edited, styled, burned into the video or downloaded as SRT or VTT.",
  },
  {
    question: "Can I use my own AI provider?",
    answer:
      "Yes. Optional writing tools (titles, chapters, summaries, translation) work with your own API key for Anthropic, OpenAI, Google Gemini, Groq, OpenRouter or Mistral. Keys are stored only in your browser and sent directly to the provider you choose.",
  },
  {
    question: "Is the Chrome extension on the Chrome Web Store?",
    answer: "Not yet. It installs from source in about a minute; the steps are on the home page and in the extension's README.",
  },
  {
    question: "Is it open source?",
    answer: `Yes, MIT licensed. The web app is at ${REPO_APP} and the extension at ${REPO_EXTENSION}.`,
  },
];

export interface ChangelogEntry {
  date: string; // ISO date
  title: string;
  summary: string;
}

/** Newest first. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-10-13",
    title: "Captions from files, caption styles, more backgrounds",
    summary:
      "Upload .srt or .vtt captions and they fill in automatically. Style them with presets, fonts, colors, boxes or outlines and a spoken-word highlight. Backgrounds now come in genres (aesthetic gradients, pastels, nature, warm, cool, neon, night) with a color picker for your own.",
  },
  {
    date: "2026-10-13",
    title: "Export as MP4, MOV or WebM; clearer saving",
    summary:
      "Export now asks for the format. Save is a choice between keeping the project in your browser or downloading the video. Projects can be renamed, discarded back to the original, or deleted.",
  },
  {
    date: "2026-10-12",
    title: "A studio redesign, text, shapes, effects and music",
    summary:
      "A new editor layout with all tools on the right, text overlays, arrows and spotlights, color looks and transitions, background music that ducks under your voice, and a new landing page.",
  },
  {
    date: "2026-10-12",
    title: "Automatic zooms that follow your cursor",
    summary:
      "Recordings from the extension open already zoomed in on every click, with a camera that glides with your cursor and ignores small movements.",
  },
  {
    date: "2026-10-11",
    title: "Vidzart is here",
    summary: "Record a tab with the Chrome extension, edit in the browser, and export. Free and private.",
  },
];
