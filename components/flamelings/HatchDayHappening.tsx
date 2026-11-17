import { useState } from "react";
import { playSound } from "@/lib/flamelings/sound";
import { useFlamelings } from "@/lib/flamelings/store";
import { CakeArt } from "./HappeningArt";
import { burstConfetti } from "./confetti";
import { LEFT_SPOT, type HappeningProps } from "./happeningProps";
import { FOCUS_RING } from "./styles";
import { useLater } from "./useLater";

/** Hatch Day: a cake with candles; tap to blow them out for confetti and a gift. */
export default function HatchDayHappening({
  petId,
  happening,
  onCheer,
}: HappeningProps) {
  const complete = useFlamelings((s) => s.completeHappening);
  const [wasDone] = useState(happening.done);
  const [phase, setPhase] = useState<"lit" | "out" | "gone">("lit");
  const later = useLater();
  if (wasDone || phase === "gone") return null;

  function blow() {
    if (phase !== "lit") return;
    setPhase("out");
    playSound("blow");
    void burstConfetti({ particleCount: 140, originY: 0.55 });
    complete(petId);
    onCheer("dance");
    later(() => setPhase("gone"), 2800);
  }

  return (
    <>
      <span
        aria-hidden="true"
        className="fl-bob pointer-events-none absolute left-[24%] top-[40%] text-6xl"
      >
        🎈
      </span>
      <button
        type="button"
        onClick={blow}
        disabled={phase !== "lit"}
        aria-label="Happy Hatch Day! Tap to blow out the candles"
        data-testid="happening-hatchday"
        className={`pointer-events-auto absolute ${LEFT_SPOT} grid size-32 place-items-center disabled:opacity-100 sm:size-40 ${
          phase === "lit" ? "fl-bob" : ""
        } ${FOCUS_RING}`}
      >
        <CakeArt lit={phase === "lit"} className="size-full" />
        {phase === "out" && (
          <span
            aria-hidden="true"
            className="fl-pop-burst absolute top-0 text-5xl"
          >
            💨
          </span>
        )}
      </button>
    </>
  );
}
