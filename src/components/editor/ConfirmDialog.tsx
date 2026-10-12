"use client";

import { useEffect, useRef, useState } from "react";
import { button, primaryButton } from "./styles";

// A modal for confirming a destructive action, or asking for a name.
// Native <dialog>: focus trap, Esc to close and a backdrop for free.

export function ConfirmDialog(props: {
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  /** When set, shows a text field (e.g. rename) and passes its value to onConfirm. */
  input?: { label: string; initial: string };
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(props.input?.initial ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const confirm = async () => {
    if (busy || (props.input && !value.trim())) return;
    setBusy(true);
    try {
      await props.onConfirm(value.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        props.onCancel();
      }}
      className="m-auto w-[min(92vw,420px)] rounded-xl bg-surface p-6 text-ink shadow-2xl backdrop:bg-black/70"
    >
      <h2 id="confirm-title" className="text-lg font-semibold">
        {props.title}
      </h2>
      {props.description && <p className="mt-2 text-sm text-ink-muted">{props.description}</p>}
      {props.input && (
        <label className="mt-4 flex flex-col gap-1.5 text-sm">
          <span className="text-ink-muted">{props.input.label}</span>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void confirm()}
            className="h-9 rounded-lg border border-line-strong bg-surface-2 px-3 focus:border-accent focus:outline-none"
          />
        </label>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className={button} onClick={props.onCancel}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void confirm()}
          className={
            props.danger
              ? "inline-flex h-9 cursor-pointer items-center rounded-lg bg-danger px-4 text-sm font-semibold text-bg hover:brightness-110 disabled:opacity-50"
              : primaryButton
          }
        >
          {props.confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
