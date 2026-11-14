"use client";

import type { PhaseDef } from "@/lib/ever-onward/engine/types";
import ListenButton from "../narration/ListenButton";
import { introSentences } from "./storyEntries";
import { pixelClass, retroSecondaryButtonClass } from "./retro/retroStyles";

interface PhaseBriefingProps {
  phase: PhaseDef;
  /** Narration clip for the briefing, if one is recorded. */
  clipId?: string;
  /** Fades the sentences in one by one (the opening moment). */
  isStaggered?: boolean;
}

const DELAYS = [
  "",
  "[animation-delay:350ms]",
  "[animation-delay:700ms]",
  "[animation-delay:1050ms]",
  "[animation-delay:1400ms]",
];

/** The intro sentences, the goal line and the narration button of a phase. */
export default function PhaseBriefing({
  phase,
  clipId,
  isStaggered = false,
}: PhaseBriefingProps) {
  const sentences = introSentences(phase.intro ?? "");
  return (
    <div className="space-y-4 text-left">
      {sentences.length > 0 && (
        <div className="space-y-2 font-mono text-sm text-slate-200 sm:text-base">
          {sentences.map((sentence, i) => (
            <p
              key={sentence}
              className={isStaggered ? `lm-fade-up ${DELAYS[i] ?? ""}` : ""}
            >
              {sentence}
            </p>
          ))}
        </div>
      )}
      {phase.goal && (
        <p
          data-testid="lm-phase-goal"
          className="border-2 border-cyan-300/70 bg-cyan-950/40 p-3 font-mono text-sm text-cyan-100"
        >
          <span className={`${pixelClass} mr-2 text-[10px] text-cyan-200`}>
            Your goal:
          </span>
          {phase.goal}
        </p>
      )}
      {sentences.length > 0 && clipId && (
        <div>
          <ListenButton
            clipId={clipId}
            label="Listen"
            accessibleLabel="Listen to this introduction"
            className={`${retroSecondaryButtonClass} gap-2`}
          />
        </div>
      )}
    </div>
  );
}
