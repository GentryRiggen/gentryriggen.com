import { useState } from "react";
import { playSound } from "@/lib/flamelings/sound";
import { useFlamelings } from "@/lib/flamelings/store";
import { ChestArt, MarkArt } from "./HappeningArt";
import { LEFT_SPOT, type HappeningProps } from "./happeningProps";
import { FOCUS_RING } from "./styles";
import { useLater } from "./useLater";

/** How many taps it takes to dig the treasure up. */
export const DIG_TAPS = 5;

/** A glowing X: tap it five times to dig, then the chest pops open. */
export default function TreasureHappening({
  petId,
  happening,
  onCheer,
}: HappeningProps) {
  const complete = useFlamelings((s) => s.completeHappening);
  const [wasDone] = useState(happening.done);
  const [taps, setTaps] = useState(0);
  const [gone, setGone] = useState(false);
  const [dugAt, setDugAt] = useState(0);
  const later = useLater();

  if (wasDone || gone) return null;
  const open = taps >= DIG_TAPS;

  function dig() {
    if (open) return;
    const next = taps + 1;
    setTaps(next);
    setDugAt((n) => n + 1);
    if (next < DIG_TAPS) {
      playSound("dig");
      return;
    }
    playSound("chest");
    complete(petId, happening);
    onCheer("wow");
    later(() => setGone(true), 2600);
  }

  return (
    <button
      type="button"
      onClick={dig}
      disabled={open}
      aria-label={
        open
          ? "The treasure chest is open"
          : `Dig up the treasure, ${taps} of ${DIG_TAPS} taps`
      }
      data-testid="happening-treasure"
      data-taps={taps}
      className={`pointer-events-auto absolute ${LEFT_SPOT} grid size-28 place-items-center disabled:opacity-100 sm:size-36 ${FOCUS_RING}`}
    >
      <span
        key={dugAt}
        className={open ? "fl-chest-pop size-full" : "fl-dig size-full"}
      >
        {open ? (
          <ChestArt open className="size-full" />
        ) : (
          <MarkArt className="fl-mark-glow size-full" />
        )}
      </span>
      {!open && (
        <span
          aria-hidden="true"
          className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 gap-1"
        >
          {Array.from({ length: DIG_TAPS }, (_, i) => (
            <span
              key={i}
              className={`size-3 rounded-full ${
                i < taps ? "bg-amber-300" : "bg-white/60"
              }`}
            />
          ))}
        </span>
      )}
    </button>
  );
}
