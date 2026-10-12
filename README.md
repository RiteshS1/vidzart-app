# Vidzart (web app)

Vidzart is a free, local-first screen recorder and editor for polished product demos and
tutorials. Record your screen and the editor adds smooth zooms that follow your clicks, a nice
background, a smoothed cursor and click effects. Then you export a clean MP4.

This repo holds the **web app**: landing page, local dashboard and editor. The recorder that also
captures cursor and click events is in the companion repo **[vidzart-extension](https://github.com/RiteshS1/vidzart-extension)**.

> **Status:** alpha. Recording, editing, export, cursor effects, autosave and the AI tools all
> work. Feedback and bug reports welcome.

## Features

- **Record** with the Chrome extension (tab + clicks, so zooms are automatic) or right here at
  `/record`; or **open** any WebM/MP4 or `.vidz` project.
- **Automatic zooms** like Cursorful: extension recordings open already zoomed in on every click,
  with a camera that glides after your cursor.
- **Timeline like a real editor:** cut parts disappear (click the ✂ seam to restore), speed up
  boring parts, drag the playhead, zoom the timeline, filmstrip thumbnails.
- **Style:** backgrounds, padding, corners, shadow, aspect ratios; color looks; fades and
  transitions at cuts.
- **Cursor & keys:** smoothed cursor with click ripples; "⌘K"-style shortcut badges.
- **Text & highlights:** titles, callouts, lower thirds (animated), arrows, boxes, circles,
  spotlights, blur boxes for sensitive info.
- **Audio:** background music that loops, fades and ducks under your voice; recording volume.
- **AI:** on-device captions (Whisper), cut silences and filler words; optional BYOK writing
  tools (title, chapters, summary, translation) with Anthropic, OpenAI, Gemini, Groq, OpenRouter
  or Mistral.
- **Export MP4** up to 4K at 30/60 fps in your browser; **autosave** and a projects dashboard.

## Privacy

Everything runs in your browser; nothing is uploaded, and there are no Vidzart servers,
accounts or cloud storage.

- The on-device captions download the speech model (from Hugging Face) and the ONNX runtime
  (from jsDelivr) once; your audio never leaves your computer.
- If you add an AI provider API key, it is stored **only in this browser** and requests go
  directly from your browser to that provider (only the transcript text is sent).

## Running locally

```sh
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # static site in out/
pnpm test       # unit tests
pnpm test:e2e   # browser tests (Playwright, uses your installed Chrome)
```

## Support

Vidzart is completely free. If you find it helpful, you can [buy me a coffee ☕](https://buymeacoffee.com/riteshs).

## License

[MIT](LICENSE)
