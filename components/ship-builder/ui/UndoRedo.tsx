"use client";

import { Redo2, Undo2 } from "lucide-react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

const BUTTON_CLASS =
  "inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800";

/** Floating undo / redo pair in the bottom-right of the 3D view. */
export default function UndoRedo() {
  const canUndo = useShipBuilderStore((s) => s.past.length > 0);
  const canRedo = useShipBuilderStore((s) => s.future.length > 0);
  const isTrialActive = useShipBuilderStore((s) => s.trial.status !== "idle");
  const undo = useShipBuilderStore((s) => s.undo);
  const redo = useShipBuilderStore((s) => s.redo);

  return (
    <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-10 flex items-center gap-0.5 rounded-lg border border-slate-300 bg-white/90 p-0.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
      <button
        type="button"
        disabled={!canUndo || isTrialActive}
        onClick={undo}
        className={BUTTON_CLASS}
      >
        <Undo2 aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="sr-only xl:not-sr-only">Undo</span>
      </button>
      <button
        type="button"
        disabled={!canRedo || isTrialActive}
        onClick={redo}
        className={BUTTON_CLASS}
      >
        <Redo2 aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="sr-only xl:not-sr-only">Redo</span>
      </button>
    </div>
  );
}
