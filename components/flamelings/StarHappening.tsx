import { useState } from "react";
import { playSound } from "@/lib/flamelings/sound";
import { useFlamelings } from "@/lib/flamelings/store";
import { StarArt } from "./HappeningArt";
import type { HappeningProps } from "./happeningProps";
import { FOCUS_RING } from "./styles";
import { useLater } from "./useLater";

/** A shooting star drifts over the sleeping pet: tap it to make a wish. */
export default function StarHappening({ petId, happening }: HappeningProps) {
  const complete = useFlamelings((s) => s.completeHappening);
  const [wasDone] = useState(happening.done);
  const [phase, setPhase] = useState<"drifting" | "wished" | "gone">(
    "drifting"
  );
  const later = useLater();
  if (wasDone || phase === "gone") return null;

  function wish() {
    if (phase !== "drifting") return;
    setPhase("wished");
    playSound("wish");
    complete(petId);
    later(() => setPhase("gone"), 1900);
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[26%] flex justify-center">
      <div className={phase === "drifting" ? "fl-star-drift" : ""}>
        <button
          type="button"
          onClick={wish}
          disabled={phase !== "drifting"}
          aria-label="A shooting star. Tap to make a wish"
          data-testid="happening-star"
          className={`pointer-events-auto grid size-24 place-items-center disabled:opacity-100 ${
            phase === "wished" ? "fl-star-wish" : "fl-bob"
          } ${FOCUS_RING}`}
        >
          <StarArt className="size-full drop-shadow-[0_0_14px_rgba(255,224,102,0.9)]" />
        </button>
      </div>
    </div>
  );
}
