import { useCallback, useEffect, useRef, useState } from "react";
import useVisibilityPause from "@/components/game-kit/useVisibilityPause";
import { playTuning } from "@/lib/flamelings/playTuning";
import { stageFor } from "@/lib/flamelings/progress";
import { playSound } from "@/lib/flamelings/sound";
import {
  TOAST_MARSHMALLOWS,
  TOAST_MAX,
  TOAST_RATE,
  toastPoints,
  toastStage,
  type ToastStage,
} from "@/lib/flamelings/toast";
import type { Pet } from "@/lib/flamelings/types";
import { SAFE_INSETS } from "@/lib/game-kit/safeArea";
import Blob from "./Blob";
import { PRIMARY_BUTTON } from "./styles";

const TICK_MS = 60;
/** The longest step one tick may add, so a stalled page cannot burn a marshmallow. */
const MAX_STEP_S = 0.2;
const RESULT_MS = 1200;
const SIZZLE_EVERY_MS = 380;

const FILL: Record<ToastStage, string> = {
  white: "bg-orange-50",
  golden: "bg-amber-300",
  brown: "bg-amber-700",
  burnt: "bg-stone-900",
};
const STAGE_DOT: Record<ToastStage, string> = {
  white: "⚪",
  golden: "🟡",
  brown: "🟤",
  burnt: "⚫",
};
const STAGES: ToastStage[] = ["white", "golden", "brown", "burnt"];
const RESULT_ICON: Record<ToastStage, string> = {
  white: "🙂",
  golden: "🌟",
  brown: "😋",
  burnt: "😂",
};

type Phase = "ready" | "toasting" | "result" | "over";

interface MarshmallowToastProps {
  pet: Pet;
  /** Called once with the score (5 to 15) when the player taps "Done". */
  onDone: (score: number) => void;
}

/**
 * Marshmallow Toast: hold to toast a marshmallow over the pet's flame, let go
 * at golden. Five marshmallows a round; the pet giggles at every one.
 */
export default function MarshmallowToast({
  pet,
  onDone,
}: MarshmallowToastProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [stage, setStage] = useState<ToastStage>("white");
  const [finished, setFinished] = useState(0);
  const [score, setScore] = useState(0);
  const [last, setLast] = useState<{
    points: number;
    stage: ToastStage;
  } | null>(null);
  const finishedCount = useRef(0);
  const doneness = useRef(0);
  const lastTick = useRef(0);
  const lastSizzle = useRef(0);
  const smoked = useRef(false);
  const phaseRef = useRef<Phase>("ready");
  const timers = useRef<number[]>([]);
  const ticker = useRef<number | undefined>(undefined);

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      window.clearInterval(ticker.current);
    };
  }, []);

  const finish = useCallback(() => {
    if (phaseRef.current !== "toasting") return;
    window.clearInterval(ticker.current);
    const level = doneness.current;
    const got = toastPoints(level);
    const at = toastStage(level);
    setScore((n) => n + got);
    setLast({ points: got, stage: at });
    finishedCount.current += 1;
    setFinished(finishedCount.current);
    go("result");
    if (at === "golden") {
      playSound("cheer");
      playSound("sparkle");
    } else {
      if (at === "burnt" && !smoked.current) playSound("puff");
      playSound("giggle");
    }
    timers.current.push(
      window.setTimeout(() => {
        setLast(null);
        setStage("white");
        go(finishedCount.current >= TOAST_MARSHMALLOWS ? "over" : "ready");
      }, RESULT_MS / playTuning.toast)
    );
  }, [go]);

  const press = useCallback(() => {
    if (phaseRef.current !== "ready") return;
    doneness.current = 0;
    smoked.current = false;
    setStage("white");
    go("toasting");
    lastTick.current = Date.now();
    lastSizzle.current = 0;
    window.clearInterval(ticker.current);
    ticker.current = window.setInterval(() => {
      const at = Date.now();
      const step = Math.min(MAX_STEP_S, (at - lastTick.current) / 1000);
      lastTick.current = at;
      doneness.current = Math.min(
        TOAST_MAX,
        doneness.current + step * TOAST_RATE * playTuning.toast
      );
      const now = toastStage(doneness.current);
      setStage(now);
      if (now === "burnt" && !smoked.current) {
        smoked.current = true;
        playSound("puff");
      }
      if (at - lastSizzle.current > SIZZLE_EVERY_MS) {
        lastSizzle.current = at;
        playSound("sizzle");
      }
      if (doneness.current >= TOAST_MAX) finish();
    }, TICK_MS);
  }, [finish, go]);

  // Only the finger that started the hold can end it (a second touch or a
  // stray pointer is ignored); losing the capture also lets go.
  const holdPointer = useRef<number | null>(null);
  const endHold = useCallback(
    (pointerId: number) => {
      if (holdPointer.current !== pointerId) return;
      holdPointer.current = null;
      finish();
    },
    [finish]
  );

  // Hiding the page lets go of the stick, so nothing burns while away.
  useVisibilityPause({ onHidden: finish });

  const toasting = phase === "toasting";
  const giggling = phase === "result";
  const left = TOAST_MARSHMALLOWS - finished - (toasting ? 1 : 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Marshmallow Toast"
      className={`fixed inset-0 z-20 overflow-hidden bg-gradient-to-b from-indigo-950 via-indigo-900 to-orange-950 ${SAFE_INSETS}`}
    >
      {phase !== "over" && (
        <button
          type="button"
          data-testid="toast-hold"
          aria-label="Hold to toast the marshmallow, let go when it is golden"
          onPointerDown={(e) => {
            if (
              phaseRef.current === "toasting" &&
              holdPointer.current !== null
            ) {
              return;
            }
            holdPointer.current = e.pointerId;
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // A browser without pointer capture still gets the up event.
            }
            press();
          }}
          onPointerUp={(e) => endHold(e.pointerId)}
          onPointerCancel={(e) => endHold(e.pointerId)}
          onLostPointerCapture={(e) => endHold(e.pointerId)}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) press();
          }}
          onKeyUp={(e) => {
            if (e.key === " " || e.key === "Enter") finish();
          }}
          className="absolute inset-0 z-10 touch-none select-none focus-visible:outline-none focus-visible:ring-8 focus-visible:ring-sky-400"
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-[max(1rem,env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="rounded-2xl bg-black/50 px-4 py-2 text-2xl font-black text-white">
          <span aria-hidden="true">✨ </span>
          <span data-testid="toast-score">{score}</span>
        </p>
        <p
          className="rounded-2xl bg-black/50 px-4 py-2 text-2xl font-black text-white"
          aria-label={`${Math.max(0, left)} marshmallows left`}
          data-testid="toast-left"
        >
          <span aria-hidden="true">
            {"🍡".repeat(Math.max(0, left)) || "✔️"}
          </span>
        </p>
      </div>

      {/* The doneness meter: the star marks golden. */}
      {phase !== "over" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[14%] z-20 flex -translate-x-1/2 items-end gap-3 rounded-3xl bg-black/40 px-4 py-2"
        >
          {STAGES.map((s) => (
            <span
              key={s}
              className={`relative text-4xl transition-transform ${
                stage === s && (toasting || giggling)
                  ? "scale-150"
                  : "opacity-60"
              }`}
            >
              {s === "golden" && (
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xl">
                  ⭐
                </span>
              )}
              {STAGE_DOT[s]}
            </span>
          ))}
        </div>
      )}

      {phase !== "over" && (
        <div
          data-testid="toast-marshmallow"
          data-stage={stage}
          className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 transition-[bottom] duration-500 ${
            toasting
              ? "bottom-[calc(min(80vw,46vh)*0.58)]"
              : "bottom-[calc(min(80vw,46vh)*0.58+9rem)]"
          }`}
        >
          <div className="absolute left-1/2 top-1/2 -z-10 h-2.5 w-[60vmin] origin-left -rotate-[28deg] rounded-full bg-amber-900" />
          <div
            className={`h-20 w-28 rounded-[1.8rem] shadow-[inset_0_-6px_0_rgba(0,0,0,0.12),inset_0_6px_0_rgba(255,255,255,0.35),0_6px_10px_rgba(0,0,0,0.35)] transition-colors duration-500 ${FILL[stage]} ${
              toasting ? "fl-mallow-wobble" : ""
            }`}
          />
          {stage === "burnt" && (
            <span
              aria-hidden="true"
              className="fl-smoke absolute -top-8 left-1/2 text-5xl"
            >
              💨
            </span>
          )}
        </div>
      )}

      {last && (
        <p
          data-testid="toast-result"
          className="fl-card-in pointer-events-none absolute left-1/2 top-[22%] z-20 -translate-x-1/2 rounded-full bg-white px-6 py-2 text-4xl font-black text-stone-900 shadow-xl"
        >
          <span aria-hidden="true">{RESULT_ICON[last.stage]} </span>+
          {last.points}
        </p>
      )}

      {phase === "ready" && finished === 0 && (
        <p
          aria-hidden="true"
          className="fl-bob pointer-events-none absolute left-1/2 top-[40%] z-20 -translate-x-1/2 text-6xl"
        >
          👇🔥
        </p>
      )}

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))] ${
          giggling ? "fl-giggle" : ""
        }`}
      >
        <Blob
          look={pet.look}
          worn={pet.worn}
          form={pet.form}
          mood={giggling || toasting ? "excited" : "happy"}
          stage={stageFor(pet.level).id}
          className="size-[min(80vw,46vh)]"
        />
      </div>

      {phase === "over" && (
        <div className="absolute inset-0 z-30 grid place-items-center p-6">
          <div className="fl-card-in flex flex-col items-center gap-4 rounded-3xl bg-white p-8 text-center text-stone-900 shadow-xl dark:bg-slate-800 dark:text-amber-50">
            <p className="text-3xl font-black">Yum! {score} points!</p>
            <p aria-hidden="true" className="text-5xl">
              🍡🌟🍡
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
