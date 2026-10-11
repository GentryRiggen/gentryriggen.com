"use client";

import { useEffect, useRef } from "react";
import { LEVELS } from "@/lib/plane-builder/levels";
import type { LevelId } from "@/lib/plane-builder/levels/types";
import { cardClass, dangerButtonClass, secondaryButtonClass } from "./styles";

interface ConfirmRestartProps {
  levelId: LevelId;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmRestart({
  levelId,
  onCancel,
  onConfirm,
}: ConfirmRestartProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const name = LEVELS[levelId].name;

  useEffect(() => {
    const previous = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && document.contains(previous)) {
        previous.focus();
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div
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
