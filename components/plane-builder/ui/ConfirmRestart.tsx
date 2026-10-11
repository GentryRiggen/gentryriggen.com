"use client";

import { useEffect, useRef } from "react";
import { LEVELS } from "@/lib/plane-builder/levels";
import type { LevelId } from "@/lib/plane-builder/levels/types";
import { cardClass, dangerButtonClass, secondaryButtonClass } from "./styles";

interface ConfirmRestartProps {
  levelId: LevelId;
  onCancel: () => void;
  onConfirm: () => void;
  /**
   * Where focus goes on close when the button that opened the dialog is gone
   * (a restarted level has no Restart button any more).
   */
  getFallbackFocus?: () => HTMLElement | null;
}

const FOCUSABLE = "button:not([disabled])";

export default function ConfirmRestart({
  levelId,
  onCancel,
  onConfirm,
  getFallbackFocus,
}: ConfirmRestartProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const latest = useRef({ onCancel, getFallbackFocus });
  const name = LEVELS[levelId].name;

  useEffect(() => {
    latest.current = { onCancel, getFallbackFocus };
  });

  useEffect(() => {
    const previous = document.activeElement;
    cancelRef.current?.focus();

    // Document level, so Escape works wherever focus has wandered, and Tab
    // wraps inside the dialog.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        latest.current.onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const isInside =
        active instanceof Node && dialogRef.current?.contains(active);
      if (!isInside || (event.shiftKey && active === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const target =
        previous instanceof HTMLElement && document.contains(previous)
          ? previous
          : latest.current.getFallbackFocus?.();
      target?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="restart-title"
        className={`w-full max-w-sm p-5 ${cardClass}`}
      >
        <h2 id="restart-title" className="text-xl font-bold">
          Restart {name}?
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Your upgrades and coins for this level go back to zero. Other levels
          stay the same.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={dangerButtonClass}
          >
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}
