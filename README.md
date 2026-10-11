# Vidzart (web app)

Vidzart is a free, local-first screen recorder and editor for polished product demos and
tutorials. Record your screen and the editor adds smooth zooms that follow your clicks, a nice
background, a smoothed cursor and click effects. Then you export a clean MP4.

This repo holds the **web app**: landing page, local dashboard and editor. The recorder that also
captures cursor and click events is in the companion repo **[vidzart-extension](https://github.com/RiteshS1/vidzart-extension)**.

> **Status:** alpha. Recording, editing, export, cursor effects, autosave and the AI tools all
> work. Feedback and bug reports welcome.

## Features

- **Open** a `.vidz` project (from the extension, via "Open in editor" or a saved file) or **any
  plain video file**. Or record your screen right here at `/record`.
- **Style:** background presets, padding, rounded corners, shadow, aspect ratio (16:9, 9:16, 1:1,
  4:3, original), with a live 60fps canvas preview.
- **Edit:** trim start/end, cut ranges, **speed up** boring parts (1.5×–8×), **blur** boxes to
  hide sensitive info, undo/redo, keyboard shortcuts.
- **Zooms:** drag on the timeline, pick a target or follow the cursor; **Auto zoom** creates
  them around your clicks (recordings from the extension).
- **Cursor & clicks:** a smoothed cursor drawn from the click log (size, smoothing, hide when
  idle) with ripple or pulse click effects.
- **AI tab:**
  - **Captions** on your device (Whisper in the browser): edit them, style them, burn them in,
    or download `.srt` / `.vtt`.
  - **Cut silences** and **cut filler words** ("um", "uh"), each one undo step.
  - **Write with AI** using **your own API key** (Anthropic, OpenAI, Gemini, Groq, OpenRouter or
    Mistral): title & description, YouTube chapters, summary, caption translation.
- **Export MP4** (720p–4K, 30/60 fps) rendered in your browser with WebCodecs.
- **Autosave** in your browser, with a "Recent projects" list; or **Save project** as a `.vidz`
  file to keep or move.

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
