"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { trackGame } from "@/lib/analytics/trackGame";
import {
  challengeDef,
  type ChallengeId,
} from "@/lib/ship-builder/challenges/definitions";
import {
  beatItHint,
  describeShipshapeRun,
  describeValue,
} from "@/lib/ship-builder/challenges/format";
import { bestValue, designKeyOf } from "@/lib/ship-builder/challenges/progress";
import {
  challengeProgress,
  recordChallengeBest,
} from "@/lib/ship-builder/challenges/progressStore";
import type { SimState, TrialInput } from "@/lib/ship-builder/sim/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { requestShipBoardSubmit } from "../hooks/shipBoardSync";
import ChallengeStars from "./ChallengeStars";
import scoreChallengeTrial from "./scoreChallengeTrial";
import { buttonClass } from "./styles";

interface ChallengeResultProps {
  challenge: ChallengeId;
  input: TrialInput;
  state: SimState;
}

/**
 * The stars a challenge trial earned, what to change to earn the next one,
 * and a button to try again. Saves the result once when it appears, unless
 * the trial did not apply (then it says why and keeps nothing).
 */
export default function ChallengeResult({
  challenge,
  input,
  state,
}: ChallengeResultProps) {
  const ship = useShipBuilderStore((s) => s.ship);
  const startChallenge = useShipBuilderStore((s) => s.startChallenge);
  const savedId = useShipBuilderStore((s) => s.savedId);
  const designKey = designKeyOf(savedId);
  const def = challengeDef(challenge);
  const score = useMemo(
    () => scoreChallengeTrial(challenge, input, state, ship),
    [challenge, input, state, ship]
  );
  const { isScored } = score;
  // Read before the result is saved, so "new best" compares with the old one.
  const [previous] = useState(() =>
    bestValue(challengeProgress.get(), designKey, challenge)
  );
  const isNewBest =
    isScored && score.value > (previous ?? -1) && score.stars > 0;

  useEffect(() => {
    if (!isScored) return;
    trackGame("challenge_result", { id: challenge, stars: score.stars });
    if (recordChallengeBest(designKey, challenge, score.value)) {
      requestShipBoardSubmit();
    }
  }, [designKey, challenge, score.value, score.stars, isScored]);

  return (
    <section
      data-challenge-result
      aria-label={`Challenge: ${def.title}`}
      className="flex flex-col gap-1.5 rounded-xl bg-amber-50 p-2.5 dark:bg-slate-800"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="min-w-0 flex-1 text-sm font-semibold">{def.title}</h2>
        {isNewBest && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            New best!
          </span>
        )}
        {isScored && <ChallengeStars stars={score.stars} className="h-6 w-6" />}
      </div>
      <p className="text-sm font-medium">
        {describeValue(challenge, score.value)}
      </p>
      {score.sea !== undefined && score.peakRollDeg !== undefined && (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {describeShipshapeRun(score.sea, score.peakRollDeg, score.value < 2)}
        </p>
      )}
      {isScored && (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {beatItHint(challenge, score.value)}
        </p>
      )}
      <button
        type="button"
        onClick={() => startChallenge(challenge)}
        className={`${buttonClass} min-h-11 self-start`}
      >
        <RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0" />
        Try the challenge again
      </button>
    </section>
  );
}
