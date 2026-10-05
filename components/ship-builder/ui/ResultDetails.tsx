"use client";

import { Crosshair, RotateCcw, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { TrialSummary } from "@/lib/ship-builder/sim/explain";
import {
  useShipBuilderStore,
  type TrialSlice,
} from "@/lib/ship-builder/state/store";
import { SEA_LABELS } from "./seaTrialText";
import { buttonClass, panelClass } from "./styles";

type ResultTrial = Extract<TrialSlice, { status: "result" }>;

interface ResultDetailsProps {
  input: ResultTrial["input"];
  summary: TrialSummary;
  extraLines: string[];
  onClose: () => void;
}

/** The full explanation, opened from the result bar and put away again. */
export default function ResultDetails({
  input,
  summary,
  extraLines,
  onClose,
}: ResultDetailsProps) {
  const startTrial = useShipBuilderStore((s) => s.startTrial);
  const aimIceberg = useShipBuilderStore((s) => s.aimIceberg);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sheet.current?.focus();
  }, []);

  return (
    <div
      ref={sheet}
      role="dialog"
      aria-labelledby="sea-trial-title"
      aria-describedby="sea-trial-message"
      tabIndex={-1}
      className={`absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl border p-4 shadow-xl outline-none sm:max-w-md ${panelClass}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Sea trial · {SEA_LABELS[input.sea]}
          </p>
          <h2 id="sea-trial-title" className="text-lg font-semibold">
            {summary.title}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <p
        id="sea-trial-message"
        className="mt-2 text-sm text-slate-700 dark:text-slate-300"
      >
        {summary.message}
      </p>
      {extraLines.length > 0 && (
        <ul
          data-testid="sea-trial-extra-lines"
          className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300"
        >
          {extraLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {summary.tips.length > 0 && (
        <div className="mt-3 rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Try this
          </h3>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-800 dark:text-slate-200">
            {summary.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => startTrial(input.sea, input.iceberg?.impactX)}
          className={`${buttonClass} min-h-11 flex-1`}
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0" />
          Try again
        </button>
        {input.iceberg && (
          <button
            type="button"
            onClick={aimIceberg}
            className={`${buttonClass} min-h-11 flex-1`}
          >
            <Crosshair aria-hidden="true" className="h-4 w-4 shrink-0" />
            Try another spot
          </button>
        )}
      </div>
    </div>
  );
}
