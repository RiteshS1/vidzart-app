# Vidzart (web app)

Vidzart is a free, local-first screen recorder and editor for polished product demos and
tutorials. Record your screen and the editor adds smooth zooms that follow your clicks, a nice
background, a smoothed cursor and click effects. Then you export a clean MP4.

This repo holds the **web app**: landing page, local dashboard and editor. The recorder that also
captures cursor and click events is in the companion repo **vidzart-extension**.

> **Status:** pre-alpha. Next.js is scaffolded; the recorder and editor are not built yet.

## Planned features

- Open a `.vidz` project (from the extension) or **any plain video file**
- Canvas preview at 60fps: background, padding, rounded corners, shadow
- Timeline with trim, speed, blur and zoom segments, plus auto-zooms from click events
- Cursor smoothing and click effects
- MP4 export in your browser (WebCodecs, nothing uploaded)
- Optional AI: on-device captions and silence/filler removal (Whisper in the browser), plus
  bring-your-own-key extras like chapters, titles, summaries and translations

## Privacy

Everything runs in your browser. Videos and projects are stored on your device (OPFS/IndexedDB).
If you add an AI provider API key, it is stored **only on this device** and requests go directly
from your browser to that provider. There are no Vidzart servers, accounts or cloud storage.

## Running locally

```sh
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # static site in out/
```

## Support

Vidzart is completely free. If you find it helpful, a "Buy me a coffee" link is coming.

## License

TBD.
