import { useEffect, useState } from "react";
import type { VisitorId } from "@/lib/flamelings/happenings";
import { playSound } from "@/lib/flamelings/sound";
import { useFlamelings } from "@/lib/flamelings/store";
import { VisitorArt } from "./HappeningArt";
import { LEFT_SPOT, type HappeningProps } from "./happeningProps";
import { FOCUS_RING } from "./styles";
import { useLater } from "./useLater";

const NAMES: Record<VisitorId, string> = {
  owl: "An owl",
  snail: "A snail",
  frog: "A frog",
  butterfly: "A butterfly",
  hedgehog: "A hedgehog",
};

/** A visitor wanders in and waits; a tap gets a present and a wave goodbye. */
export default function VisitorHappening({
  petId,
  happening,
  onCheer,
}: HappeningProps) {
  const complete = useFlamelings((s) => s.completeHappening);
  const [wasDone] = useState(happening.done);
  const [phase, setPhase] = useState<"waiting" | "waving" | "gone">("waiting");
  const later = useLater();
  const id = happening.variant as VisitorId;

  useEffect(() => {
    if (!wasDone) playSound("arrive");
  }, [wasDone]);

  if (wasDone || phase === "gone") return null;

  function give() {
    if (phase !== "waiting") return;
    setPhase("waving");
    complete(petId, happening);
    onCheer("love");
    later(() => setPhase("gone"), 2200);
  }

  return (
    <button
      type="button"
      onClick={give}
      disabled={phase !== "waiting"}
      aria-label={`${NAMES[id] ?? "A friend"} came to visit. Tap to say hello`}
      data-testid="happening-visitor"
      className={`pointer-events-auto absolute ${LEFT_SPOT} grid size-28 place-items-center disabled:opacity-100 sm:size-36 ${
        phase === "waiting" ? "fl-wander-in" : "fl-bye"
      } ${FOCUS_RING}`}
    >
      <VisitorArt id={id} className="size-full" />
      <span
        aria-hidden="true"
        className="fl-bob absolute -top-3 right-0 text-4xl drop-shadow"
      >
        {phase === "waiting" ? "🎁" : "👋"}
      </span>
    </button>
  );
}
