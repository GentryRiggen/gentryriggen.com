import { useCallback, useEffect, useRef, useState } from "react";
import useVisibilityPause from "@/components/game-kit/useVisibilityPause";
import { playSound } from "@/lib/flamelings/sound";
import { SAFE_INSETS } from "@/lib/game-kit/safeArea";
import { FOCUS_RING, PRIMARY_BUTTON } from "./styles";

export const CATCH_SECONDS = 20;
const SLOTS = [
  "left-[12%] top-[28%]",
  "left-[62%] top-[22%]",
  "left-[30%] top-[46%]",
  "left-[72%] top-[40%]",
  "left-[18%] top-[58%]",
  "left-[52%] top-[52%]",
  "left-[80%] top-[60%]",
  "left-[40%] top-[34%]",
];
/** A caught firefly drifts back in after this long. */
const RESPAWN_MS = 900;

interface FireflyCatchProps {
  /** Called once with the score when the 20 seconds are up and the player taps "Done". */
  onDone: (score: number) => void;
}

/** Firefly Catch: tap the drifting fireflies for 20 seconds. */
export default function FireflyCatch({ onDone }: FireflyCatchProps) {
  const [left, setLeft] = useState(CATCH_SECONDS);
  const [score, setScore] = useState(0);
  const [caughtAt, setCaughtAt] = useState<Record<number, number>>({});
  const [nowMs, setNowMs] = useState(0);
  const endsAt = useRef(0);
  const hiddenAt = useRef<number | null>(null);

  // The clock stops while the page is hidden, so a phone call costs no fireflies.
  useVisibilityPause({
    onHidden: () => {
      hiddenAt.current = Date.now();
    },
    onVisible: () => {
      if (hiddenAt.current !== null) {
        endsAt.current += Date.now() - hiddenAt.current;
        hiddenAt.current = null;
      }
    },
  });

  useEffect(() => {
    endsAt.current = Date.now() + CATCH_SECONDS * 1000;
    const id = window.setInterval(() => {
      if (hiddenAt.current !== null) return;
      const remaining = Math.max(
        0,
        Math.ceil((endsAt.current - Date.now()) / 1000)
      );
      setLeft(remaining);
      setNowMs(Date.now());
      if (remaining === 0) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const over = left === 0;
  const catchOne = useCallback(
    (slot: number) => {
      if (over) return;
      playSound("pip");
      setScore((n) => Math.min(99, n + 1));
      const at = Date.now();
      setNowMs(at);
      setCaughtAt((c) => ({ ...c, [slot]: at }));
    },
    [over]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Firefly Catch"
      className={`fixed inset-0 z-20 overflow-hidden bg-indigo-950/55 ${SAFE_INSETS}`}
    >
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-[max(1rem,env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="rounded-2xl bg-black/50 px-4 py-2 text-2xl font-black text-white">
          <span aria-hidden="true">✨ </span>
          <span data-testid="catch-score">{score}</span>
        </p>
        <p
          className="rounded-2xl bg-black/50 px-4 py-2 text-2xl font-black text-white"
          role="timer"
          aria-label={`${left} seconds left`}
        >
          <span aria-hidden="true">⏱ </span>
          {left}
        </p>
      </div>
      {!over &&
        SLOTS.map((position, slot) => {
          const t = caughtAt[slot];
          const hidden = t !== undefined && nowMs - t < RESPAWN_MS;
          return (
            <button
              key={slot}
              type="button"
              data-slot={slot}
              aria-label="Catch a firefly"
              onClick={() => catchOne(slot)}
              className={`fl-catch absolute grid size-20 place-items-center rounded-full ${position} ${FOCUS_RING} ${
                hidden ? "pointer-events-none opacity-0" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className="size-6 rounded-full bg-lime-200 shadow-[0_0_24px_10px_rgba(226,255,122,0.85)]"
              />
            </button>
          );
        })}
      {over && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="fl-card-in flex flex-col items-center gap-4 rounded-3xl bg-white p-8 text-center text-stone-900 shadow-xl dark:bg-slate-800 dark:text-amber-50">
            <p className="text-3xl font-black">
              You caught {score} firefl{score === 1 ? "y" : "ies"}!
            </p>
            <p aria-hidden="true" className="text-5xl">
              ✨🎉✨
            </p>
            <button
              type="button"
              onClick={() => onDone(score)}
              className={PRIMARY_BUTTON}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
