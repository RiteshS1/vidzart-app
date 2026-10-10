"use client";

import dynamic from "next/dynamic";

// The editor touches browser-only APIs (video, canvas, Mediabunny) at module
// level and during render, so it must never be prerendered. `ssr: false` is
// only allowed inside a Client Component, hence this small wrapper.
const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm opacity-60">Loading editor…</p>,
});

export function EditorLoader() {
  return <Editor />;
}
