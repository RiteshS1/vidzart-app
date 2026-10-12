import { absoluteUrl, CHANGELOG, FAQ, REPO_APP, REPO_EXTENSION, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

// The long form of llms.txt: enough detail for an assistant to answer
// questions about Vidzart accurately without crawling every page.
export const dynamic = "force-static";

export function GET() {
  const faq = FAQ.map((f) => `### ${f.question}\n\n${f.answer}`).join("\n\n");
  const changes = CHANGELOG.map((c) => `- ${c.date}: **${c.title}**. ${c.summary}`).join("\n");
  const body = `# ${SITE_NAME}: full description

> ${SITE_DESCRIPTION}

URL: ${absoluteUrl("/")}
Source: ${REPO_APP} (web app) and ${REPO_EXTENSION} (Chrome extension), MIT license.

## What it is

${SITE_NAME} is a screen recorder and video editor for product demos and tutorials, similar in spirit to Cursorful and Screen Studio. It runs in the browser. Recordings stay on the user's device.

## Features

- Automatic zooms: recordings from the Chrome extension open already zoomed in on every click (double and triple clicks make one zoom), and the camera follows the cursor with a dead zone and spring easing so it doesn't shake.
- A smoothed cursor drawn from the click log, with click ripples and keyboard shortcut badges (for example ⌘K).
- Timeline: cut ranges (cut parts disappear, with a seam to restore), speed-ups, blur boxes, undo/redo, zoomable timeline with thumbnails.
- Style: background colors and gradients in genres, a custom color picker, padding, rounded corners, shadow, aspect ratios (16:9, 9:16, 1:1, 4:3, original), color looks, fades and transitions at cuts.
- Text overlays with animations, arrows, boxes, circles and spotlights.
- Captions: generated on device with Whisper, or uploaded as .srt/.vtt; styled and burned in, or exported as SRT/VTT. Silence and filler-word removal.
- Audio: background music that loops, fades and ducks under speech.
- Optional bring-your-own-key AI writing tools (titles, chapters, summaries, translation) for Anthropic, OpenAI, Google Gemini, Groq, OpenRouter and Mistral.
- Export to MP4, MOV or WebM up to 4K at 30 or 60 fps, rendered in the browser with WebCodecs.

## Constraints

- Works best in Chrome or another Chromium browser (WebCodecs, tab capture).
- The Chrome extension is installed from source (not on the Chrome Web Store yet).
- Projects are stored in the browser's own storage; clearing site data removes them.
- There are no Vidzart servers, accounts, uploads or analytics.

## Privacy

The extension requests activeTab, scripting, tabCapture and offscreen, and no host permissions. It logs pointer movement, clicks, scrolls and keyboard shortcuts that include Ctrl, Cmd or Alt; typed characters are never recorded. API keys for optional AI providers are stored only in the browser and sent only to the chosen provider.

## FAQ

${faq}

## Changelog

${changes}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
