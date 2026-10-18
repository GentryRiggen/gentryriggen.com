"use client";

import { useEffect, useRef } from "react";
import { cardClass, primaryButtonClass, secondaryButtonClass } from "./styles";

interface ConfirmPrestigeProps {
  onCancel: () => void;
  onConfirm: () => void;
}

const FOCUSABLE = "button:not([disabled])";

export default function ConfirmPrestige({
  onCancel,
  onConfirm,
}: ConfirmPrestigeProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const latest = useRef(onCancel);

  useEffect(() => {
    latest.current = onCancel;
  });

  useEffect(() => {
    const previous = document.activeElement;
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        latest.current();
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
      if (previous instanceof HTMLElement && document.contains(previous)) {
        previous.focus();
      }
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
        aria-labelledby="prestige-title"
        className={`w-full max-w-sm p-5 ${cardClass}`}
      >
        <h2 id="prestige-title" className="text-xl font-bold">
          Prestige?
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          All 10 worlds, coins and upgrades reset. You keep your Sky Map bonuses
          and move one square to win a new one.
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
            className={primaryButtonClass}
          >
            Prestige ⭐
          </button>
        </div>
      </div>
    </div>
  );
}
