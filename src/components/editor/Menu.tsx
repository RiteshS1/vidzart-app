"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// A small dropdown menu: a trigger button and a floating list of actions.
// Closes on Escape, on a click outside, and after choosing an item; focus
// returns to the trigger. Items are plain buttons (role="menuitem").

export function Menu(props: {
  label: string;
  trigger: ReactNode;
  triggerClassName: string;
  align?: "left" | "right";
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // The menu is anchored to its trigger's edge, which on a narrow screen can
  // leave part of it off-screen. After it opens, measure and slide it back
  // inside the viewport (before paint, so it never visibly jumps).
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!open || !el) return;
    el.style.transform = "";
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let dx = 0;
    if (rect.left < margin) dx = margin - rect.left;
    else if (rect.right > window.innerWidth - margin) dx = window.innerWidth - margin - rect.right;
    if (dx !== 0) el.style.transform = `translateX(${dx}px)`;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={props.label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={props.triggerClassName}
        onClick={() => setOpen((v) => !v)}
      >
        {props.trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={props.label}
          className={`absolute top-full z-50 mt-2 w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-line-strong bg-surface p-1.5 shadow-2xl shadow-black/60 ${
            props.align === "left" ? "left-0" : "right-0"
          }`}
        >
          {props.children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem(props: {
  icon?: ReactNode;
  title: string;
  description?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={props.onClick}
      className={`flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-3 ${
        props.danger ? "text-danger" : "text-ink"
      }`}
    >
      {props.icon && <span className="mt-0.5 shrink-0" aria-hidden>{props.icon}</span>}
      <span className="min-w-0">
        <span className="block text-sm font-medium">{props.title}</span>
        {props.description && <span className="block text-xs text-ink-muted">{props.description}</span>}
      </span>
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}
