// Receives a recording from the Vidzart extension's "Open in editor" button.
//
// The extension's ready page opens /editor?from=extension with window.open,
// so we are its popup and `window.opener` is that page. We tell it we're
// ready (a message sent before our listener exists would be lost), and it
// replies with the .vidz File via postMessage, which structured-clones the
// File across origins, so nothing is uploaded or copied through a server.

export const EDITOR_READY = "vidzart:editor-ready";
export const OPEN_PROJECT = "vidzart:open-project";

/**
 * Starts listening if this page was opened by the extension. Returns a
 * cleanup function. `onFile` is called at most once.
 */
export function listenForExtensionHandoff(onFile: (file: File) => void): () => void {
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") !== "extension" || !window.opener) return () => {};
  const opener = window.opener as Window;

  const onMessage = (event: MessageEvent) => {
    // Only from the window that opened us, and only from an extension page:
    // a random website can't push files into the editor this way.
    if (event.source !== opener || !event.origin.startsWith("chrome-extension://")) return;
    const data = event.data as { type?: unknown; file?: unknown } | null;
    if (data?.type !== OPEN_PROJECT || !(data.file instanceof Blob)) return;
    window.removeEventListener("message", onMessage);
    const file = data.file instanceof File ? data.file : new File([data.file], "recording.vidz");
    // Drop ?from=extension so a reload doesn't wait for a handoff again.
    window.history.replaceState(null, "", window.location.pathname);
    onFile(file);
  };
  window.addEventListener("message", onMessage);
  // We don't know the extension's id (origin) up front, hence "*". The
  // message carries no data, so there's nothing to leak.
  opener.postMessage({ type: EDITOR_READY }, "*");
  return () => window.removeEventListener("message", onMessage);
}
