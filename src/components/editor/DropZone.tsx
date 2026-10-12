"use client";

import { UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { primaryButton } from "./styles";

export function DropZone(props: { onFile: (file: File) => void; error?: string | null; busy?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault(); // otherwise the browser navigates to the file
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file) props.onFile(file);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault(); // required for the drop event to fire
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-colors duration-150 ${
        over ? "border-accent bg-accent/10" : "border-line-strong bg-surface/50"
      }`}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-surface-3" aria-hidden>
        <UploadCloud className="size-6 text-accent" />
      </span>
      <p className="text-lg font-semibold">Drop a video or .vidz project here</p>
      <p className="text-sm text-ink-muted">
        WebM, MP4 or a Vidzart project. It stays on your device; nothing is uploaded.
      </p>
      <button
        type="button"
        className={primaryButton}
        disabled={props.busy}
        onClick={() => inputRef.current?.click()}
      >
        {props.busy ? "Opening…" : "Choose a file"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,.vidz"
        aria-label="Choose a video file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) props.onFile(file);
          event.target.value = ""; // allow choosing the same file again
        }}
      />
      {props.error && (
        <p role="alert" className="text-sm text-danger">
          {props.error}
        </p>
      )}
    </div>
  );
}
