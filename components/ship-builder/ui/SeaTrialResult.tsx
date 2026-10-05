"use client";

import {
  ArrowDownToLine,
  LifeBuoy,
  Repeat,
  ThumbsUp,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  explainTrial,
  type TrialSummary,
} from "@/lib/ship-builder/sim/explain";
import type { TrialOutcome } from "@/lib/ship-builder/sim/types";
import {
  useShipBuilderStore,
  type TrialSlice,
} from "@/lib/ship-builder/state/store";
import { trialTimelineFor } from "../scene/trialTimeline";
import ResultDetails from "./ResultDetails";
import { focusSeaTrialButton } from "./SeaTrialButton";
import { FOLLOW_HER_DOWN } from "./seaTrialText";
import { buttonClass, panelClass, primaryButtonClass } from "./styles";
import SoundToggle from "./SoundToggle";
import TrialScrubber from "./TrialScrubber";

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

/** Summary fields shown on their own; any other text field is an extra line. */
const SUMMARY_CORE_FIELDS = new Set(["title", "message", "tips"]);

/**
 * The explanation's extra lines (lights failing, the break, the sea floor)
 * beyond the title, message and tips, in the order explainTrial gives them.
 * Read generically so a summary without them (or with new ones) still works.
 */
export function extraSummaryLines(summary: TrialSummary): string[] {
  return Object.entries(summary).flatMap(([key, value]: [string, unknown]) => {
    if (SUMMARY_CORE_FIELDS.has(key)) return [];
    if (typeof value === "string") return value.trim() ? [value] : [];
    if (Array.isArray(value)) {
      return value.filter(
        (line): line is string => typeof line === "string" && line.trim() !== ""
      );
    }
    return [];
  });
}

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
  const endTrial = useShipBuilderStore((s) => s.endTrial);
  const replay = useShipBuilderStore((s) => s.replay);
  const descend = useShipBuilderStore((s) => s.descend);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsButton = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const { input, state } = trial;
  const summary = useMemo(() => explainTrial(state, input), [state, input]);
  const extraLines = useMemo(() => extraSummaryLines(summary), [summary]);
  const timeline = useMemo(
    () => (input.iceberg ? trialTimelineFor(input, trial.descending) : null),
    [input, trial.descending]
  );
  const canFollow =
    input.iceberg !== undefined &&
    !trial.descending &&
    state.outcome === "sank";
  const look = OUTCOME_LOOKS[state.outcome ?? "steady"];

  useEffect(() => {
    card.current?.focus();
  }, []);

  function handleBackToBuilding() {
    endTrial();
    // The card is about to unmount; put focus back where the trial began.
    focusSeaTrialButton();
  }

  function closeDetails() {
    setDetailsOpen(false);
    detailsButton.current?.focus();
  }

  return (
    <>
      <div
        ref={card}
        role="region"
        aria-label="Sea trial result"
        tabIndex={-1}
        className={`absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto flex flex-col gap-2 rounded-2xl border p-2 shadow-xl outline-none sm:max-w-2xl ${panelClass}`}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${look.badge}`}
          >
            <look.Icon className="h-5 w-5" />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">
            {summary.title}
          </p>
          <button
            ref={detailsButton}
            type="button"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen(true)}
            className={`${buttonClass} min-h-11`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={handleBackToBuilding}
            className={`${primaryButtonClass} min-h-11`}
          >
            Back to building
          </button>
        </div>
        {timeline && (
          <div className="flex items-center gap-2">
            <TrialScrubber timeline={timeline} compact />
            <button
              type="button"
              onClick={replay}
              className={`${buttonClass} min-h-11`}
            >
              <Repeat aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="max-sm:sr-only">Watch again</span>
            </button>
            <SoundToggle />
            {canFollow && (
              <button
                type="button"
                onClick={descend}
                className={`${buttonClass} min-h-11`}
              >
                <ArrowDownToLine
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0"
                />
                <span className="max-sm:sr-only">{FOLLOW_HER_DOWN}</span>
              </button>
            )}
          </div>
        )}
      </div>
      {detailsOpen && (
        <ResultDetails
          input={input}
          summary={summary}
          extraLines={extraLines}
          onClose={closeDetails}
        />
      )}
    </>
  );
}
