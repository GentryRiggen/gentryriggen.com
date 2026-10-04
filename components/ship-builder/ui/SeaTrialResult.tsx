"use client";

import {
  LifeBuoy,
  RotateCcw,
  ThumbsUp,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { explainTrial } from "@/lib/ship-builder/sim/explain";
import type { TrialOutcome } from "@/lib/ship-builder/sim/types";
import {
  useShipBuilderStore,
  type TrialSlice,
} from "@/lib/ship-builder/state/store";
import { focusSeaTrialButton } from "./SeaTrialButton";
import { SEA_LABELS } from "./seaTrialText";
import { buttonClass, panelClass, primaryButtonClass } from "./styles";

interface OutcomeLook {
  Icon: LucideIcon;
  /** Friendly colours for the badge: green, amber and a soft coral. */
  badge: string;
}

const OUTCOME_LOOKS: Record<TrialOutcome, OutcomeLook> = {
  steady: {
    Icon: ThumbsUp,
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  recovered: {
    Icon: LifeBuoy,
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
  capsized: {
    Icon: Waves,
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  },
  afloat: {
    Icon: ThumbsUp,
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  sank: {
    Icon: Waves,
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  },
};

/** Shows how the trial went, with a way to try again or keep building. */
export default function SeaTrialResult() {
  const trial = useShipBuilderStore((s) => s.trial);
  if (trial.status !== "result") return null;
  return <ResultCard key={trial.runId} trial={trial} />;
}

interface ResultCardProps {
  trial: Extract<TrialSlice, { status: "result" }>;
}

function ResultCard({ trial }: ResultCardProps) {
  const startTrial = useShipBuilderStore((s) => s.startTrial);
  const endTrial = useShipBuilderStore((s) => s.endTrial);
  const card = useRef<HTMLDivElement>(null);
  const { input, state } = trial;
  const summary = useMemo(() => explainTrial(state, input), [state, input]);
  const look = OUTCOME_LOOKS[state.outcome ?? "steady"];

  useEffect(() => {
    card.current?.focus();
  }, []);

  function handleBackToBuilding() {
    endTrial();
    // The card is about to unmount; put focus back where the trial began.
    focusSeaTrialButton();
  }

  return (
    <div
      ref={card}
      role="dialog"
      aria-labelledby="sea-trial-title"
      aria-describedby="sea-trial-message"
      tabIndex={-1}
      className={`absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl border p-4 shadow-xl outline-none sm:max-w-md ${panelClass}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${look.badge}`}
        >
          <look.Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Sea trial · {SEA_LABELS[input.sea]}
          </p>
          <h2 id="sea-trial-title" className="text-lg font-semibold">
            {summary.title}
          </h2>
        </div>
      </div>
      <p
        id="sea-trial-message"
        className="mt-2 text-sm text-slate-700 dark:text-slate-300"
      >
        {summary.message}
      </p>
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
          onClick={() => startTrial(input.sea)}
          className={`${buttonClass} min-h-11 flex-1`}
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0" />
          Try again
        </button>
        <button
          type="button"
          onClick={handleBackToBuilding}
          className={`${primaryButtonClass} min-h-11 flex-1`}
        >
          Back to building
        </button>
      </div>
    </div>
  );
}
