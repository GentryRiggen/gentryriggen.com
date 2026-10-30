"use client";

import { useEffect, useMemo, useRef } from "react";
import { scoreSmooth } from "@/lib/ship-builder/challenges/score";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { ChallengeCard } from "./ChallengeResult";
import { primaryButtonClass, panelClass } from "./styles";

/**
 * The card after a Smooth sailing run: the stars for the distance sailed,
 * how it ended, and ways to sail again or go back to building.
 */
export default function SailChallengeResult() {
  const result = useShipBuilderStore((s) => s.sailResult);
  const dismiss = useShipBuilderStore((s) => s.dismissSailResult);
  const card = useRef<HTMLDivElement>(null);
  const score = useMemo(
    () => (result ? scoreSmooth(result.run) : null),
    [result]
  );

  useEffect(() => {
    if (result) card.current?.focus();
  }, [result]);

  if (!result || !score) return null;
  return (
    <div
      ref={card}
      role="region"
      data-sail-challenge-result
      aria-label="Sail challenge result"
      tabIndex={-1}
      key={result.runId}
      className={`absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto flex max-h-[75dvh] flex-col gap-2 overflow-y-auto rounded-2xl border p-2 shadow-xl outline-none sm:max-w-2xl ${panelClass}`}
    >
      <ChallengeCard challenge={result.challenge} score={score} />
      <button
        type="button"
        onClick={dismiss}
        className={`${primaryButtonClass} min-h-11 self-end`}
      >
        Back to building
      </button>
    </div>
  );
}
