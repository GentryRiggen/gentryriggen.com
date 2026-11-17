import { useEffect, useRef, useState } from "react";
import { PLAYDATE_REWARD } from "@/lib/flamelings/online/friendActions";
import { finishPlaydate } from "@/lib/flamelings/online/controller";
import { onlineName } from "@/lib/flamelings/online/names";
import { playSound } from "@/lib/flamelings/sound";
import { fadeLevel } from "@/lib/flamelings/status";
import { stageFor } from "@/lib/flamelings/progress";
import { moodOf } from "@/lib/flamelings/sim";
import { useFlamelings } from "@/lib/flamelings/store";
import type { Friend, Pet } from "@/lib/flamelings/types";
import { SAFE_INSETS } from "@/lib/game-kit/safeArea";
import Blob from "../Blob";
import { burstConfetti } from "../confetti";
import Glade from "../Glade";
import FlIcon from "../FlIcon";
import {
  DIALOG_BACKDROP,
  DISPLAY,
  FOCUS_RING,
  PRIMARY_BUTTON,
  STICKER,
  STICKER_BUTTON,
} from "../styles";
import { useLater } from "../useLater";
import CardBlob from "./CardBlob";

type Step = "arrive" | "highfive" | "share" | "eat" | "done";

const STEPS: { id: Step; icon: string }[] = [
  { id: "arrive", icon: "🚶" },
  { id: "highfive", icon: "🖐️" },
  { id: "share", icon: "🍡" },
  { id: "done", icon: "🎉" },
];

const ARRIVE_MS = 1900;
const EAT_MS = 1500;

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

interface PlaydateSceneProps {
  pet: Pet;
  friend: Friend;
  onClose: () => void;
}

/**
 * A playdate in the pet's own glade: the friend walks in, they high-five (tap
 * both pets), share a marshmallow, and the pet is cheered up. Icons lead the
 * way; there is nothing to read.
 */
export default function PlaydateScene({
  pet,
  friend,
  onClose,
}: PlaydateSceneProps) {
  const clock = useFlamelings((s) => s.clock);
  const later = useLater();
  const [step, setStep] = useState<Step>("arrive");
  const [fiveMine, setFiveMine] = useState(false);
  const [fiveTheirs, setFiveTheirs] = useState(false);
  const [paid, setPaid] = useState<boolean | null>(null);
  const finished = useRef(false);

  // The friend walks in; reduced motion skips the walk.
  useEffect(() => {
    if (step !== "arrive") return;
    const id = window.setTimeout(
      () => {
        playSound("arrive");
        setStep("highfive");
      },
      reducedMotion() ? 0 : ARRIVE_MS
    );
    return () => window.clearTimeout(id);
  }, [step]);

  // Both pets high-fived: on to the marshmallow.
  useEffect(() => {
    if (step !== "highfive" || !fiveMine || !fiveTheirs) return;
    playSound("sparkle");
    void burstConfetti({ particleCount: 60, originY: 0.5 });
    const id = window.setTimeout(() => setStep("share"), 700);
    return () => window.clearTimeout(id);
  }, [step, fiveMine, fiveTheirs]);

  // Paid once, when the playdate is over (never twice for a re-render).
  useEffect(() => {
    if (step !== "done" || finished.current) return;
    finished.current = true;
    playSound("cheer");
    void burstConfetti();
    void finishPlaydate(pet.id, friend.code).then(setPaid);
  }, [step, pet.id, friend.code]);

  function share() {
    if (step !== "share") return;
    playSound("chomp");
    setStep("eat");
    later(() => setStep("done"), EAT_MS);
  }

  const stageId = stageFor(pet.level).id;
  const mine = moodOf(pet, clock);
  const dancing = step === "highfive" || step === "share" || step === "eat";
  const eating = step === "eat";
  const friendName = onlineName(friend.card.nameId);
  const petSize = "size-[min(42vw,32vh)] max-h-[22rem] max-w-[22rem]";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Playdate with ${friendName}`}
      data-testid="playdate"
      data-step={step}
      className={`fixed inset-0 z-30 overflow-hidden bg-slate-900 ${SAFE_INSETS}`}
    >
      {/* fl-playdate: the scene fills the whole screen here, so the decor
          tiers for narrow screens are tuned for it (see globals.css). */}
      <div className="fl-playdate absolute inset-0">
        <Glade nowMs={clock} decor={pet.decor} />
      </div>

      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-[max(1rem,env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <ol
          aria-label="Playdate steps"
          className="flex gap-1.5 rounded-full bg-[#fff6e6] p-1.5 shadow-[0_4px_0_#e7c9a3,0_8px_18px_rgba(30,10,40,.25)] sm:gap-2 sm:p-2"
        >
          {STEPS.map((s) => {
            const here = s.id === step || (s.id === "share" && step === "eat");
            return (
              <li
                key={s.id}
                aria-current={here ? "step" : undefined}
                className={`grid size-12 place-items-center rounded-full text-2xl transition-transform ${
                  here
                    ? "scale-110 bg-gradient-to-b from-[#ff8a3d] to-[#f2542d] shadow-[0_3px_0_#c2410c]"
                    : "bg-[#ffe9cc] opacity-60"
                }`}
              >
                <span aria-hidden="true">{s.icon}</span>
              </li>
            );
          })}
        </ol>
        {step !== "done" && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Stop the playdate"
            className={`${STICKER_BUTTON} size-16`}
          >
            <FlIcon name="close" className="size-8" />
          </button>
        )}
      </div>

      {/* My pet on the left, the friend walks in on the right. */}
      <div className="absolute left-[27%] top-[80%] -translate-x-1/2 -translate-y-full">
        <button
          type="button"
          disabled={step !== "highfive" || fiveMine}
          onClick={() => {
            playSound("pip");
            setFiveMine(true);
          }}
          aria-label={`High five ${pet.name}`}
          data-testid="highfive-mine"
          className={`relative block rounded-full ${petSize} ${FOCUS_RING}`}
        >
          {step === "highfive" && !fiveMine && (
            <span
              aria-hidden="true"
              className="fl-hint-bob absolute inset-x-0 -top-2 z-10 text-center text-5xl"
            >
              🖐️
            </span>
          )}
          <Blob
            look={pet.look}
            worn={pet.worn}
            form={pet.form}
            fade={fadeLevel(pet)}
            mood={eating ? "eating" : mine === "asleep" ? "happy" : mine}
            stage={stageId}
            emote={dancing ? "dance" : null}
            emoteKey={step === "highfive" ? 1 : 2}
            className="size-full"
          />
        </button>
      </div>
      <div className="absolute left-[73%] top-[80%] -translate-x-1/2 -translate-y-full">
        <div className={step === "arrive" ? "fl-walk-in" : ""}>
          <button
            type="button"
            disabled={step !== "highfive" || fiveTheirs}
            onClick={() => {
              playSound("pip");
              setFiveTheirs(true);
            }}
            aria-label={`High five ${friendName}`}
            data-testid="highfive-friend"
            className={`relative block rounded-full ${petSize} ${FOCUS_RING}`}
          >
            {step === "highfive" && !fiveTheirs && (
              <span
                aria-hidden="true"
                className="fl-hint-bob absolute inset-x-0 -top-2 z-10 text-center text-5xl"
              >
                🖐️
              </span>
            )}
            <CardBlob
              card={friend.card}
              mood={eating ? "eating" : "happy"}
              emote={dancing ? "dance" : null}
              emoteKey={step === "highfive" ? 1 : 2}
              className="size-full"
            />
          </button>
        </div>
        <p
          data-testid="friend-name"
          className={`${DISPLAY} mx-auto mt-1 w-fit rounded-full bg-[#fff6e6] px-4 py-1 text-xl font-semibold text-[#3a2340] shadow-[0_3px_0_#e7c9a3]`}
        >
          {friendName}
        </p>
      </div>

      {step === "share" && (
        <button
          type="button"
          onClick={share}
          aria-label="Share a marshmallow"
          data-testid="share-marshmallow"
          className={`absolute left-1/2 top-[42%] grid size-28 -translate-x-1/2 place-items-center rounded-full border-4 border-white/80 bg-[#fff6e6] text-7xl shadow-[0_6px_0_#e7c9a3,0_14px_30px_rgba(30,10,40,.35)] active:translate-y-[3px] ${FOCUS_RING}`}
        >
          <span aria-hidden="true" className="fl-hint-bob">
            🍡
          </span>
        </button>
      )}

      {(step === "eat" || step === "done") && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[55%] flex -translate-x-1/2 gap-6 text-6xl"
        >
          <span className="fl-heart-rise">❤️</span>
          <span className="fl-heart-rise [animation-delay:0.25s]">💛</span>
          <span className="fl-heart-rise [animation-delay:0.5s]">🧡</span>
        </div>
      )}

      {step === "done" && (
        <div
          className={`absolute inset-0 z-10 grid place-items-center p-5 ${DIALOG_BACKDROP}`}
        >
          <div
            data-testid="playdate-done"
            className={`${STICKER} fl-pop-in flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center`}
          >
            <p className={`${DISPLAY} text-4xl font-bold text-[#7a3d2c]`}>
              <span aria-hidden="true">🎉 </span>Playdate!
            </p>
            {paid ? (
              <p
                role="img"
                aria-label={`${PLAYDATE_REWARD.joy} joy and ${PLAYDATE_REWARD.sparks} sparks`}
                className={`${DISPLAY} flex gap-3 text-3xl font-bold`}
              >
                <span
                  aria-hidden="true"
                  className="flex items-center gap-1 rounded-full bg-[#ffe1e6] px-4 py-1 text-[#be123c] shadow-[0_3px_0_#f5b5c0]"
                >
                  <FlIcon name="joy" className="size-7" />+{PLAYDATE_REWARD.joy}
                </span>
                <span
                  aria-hidden="true"
                  className="flex items-center gap-1 rounded-full bg-gradient-to-b from-[#ffe58a] to-[#ffc53d] px-4 py-1 text-[#7a3d00] shadow-[0_3px_0_#d9952a]"
                >
                  <FlIcon name="spark" className="size-7" />+
                  {PLAYDATE_REWARD.sparks}
                </span>
              </p>
            ) : (
              <p className="text-5xl" aria-hidden="true">
                💛
              </p>
            )}
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className={PRIMARY_BUTTON}
            >
              Yay!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
