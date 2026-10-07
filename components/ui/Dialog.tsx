"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type DialogSize = "default" | "sm";

const SIZE_CLASSES: Record<DialogSize, string> = {
  default: "max-w-[460px]",
  sm: "max-w-[420px]",
};

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  descriptionId?: string;
  children: ReactNode;
  className?: string;
  /** `"default"` is the create/edit dialog width (460px); `"sm"` is the delete confirmation (420px). */
  size?: DialogSize;
}

export function Dialog({
  open,
  onClose,
  titleId,
  descriptionId,
  children,
  className,
  size = "default",
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? panel)?.focus();

    // Escape must close the dialog even when focus has drifted to
    // document.body (e.g. a scrim click that missed the close path), so
    // this listens at the document rather than relying on panel focus.
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", handleEscape);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;

    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-dialog grid place-items-center bg-overlay p-offset"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          "focus-ring flex w-full flex-col gap-4.5 rounded-card border border-border bg-surface p-6 shadow-dialog",
          SIZE_CLASSES[size],
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
