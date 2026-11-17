import { useState } from "react";
import {
  COLOURS,
  EYES,
  MAX_NAME_LENGTH,
  SHAPES,
  randomName,
  unlockKey,
  type ColourId,
  type EyesId,
  type ShapeId,
} from "@/lib/flamelings/catalog";
import { collectionOf } from "@/lib/flamelings/actions";
import { STARTING_UNLOCKS } from "@/lib/flamelings/catalog";
import { useFlamelings } from "@/lib/flamelings/store";
import type { Look } from "@/lib/flamelings/types";
import Blob from "./Blob";
import { burstConfetti } from "./confetti";
import EggArt, { EggNest, EggShell } from "./EggArt";
import FlIcon from "./FlIcon";
import {
  CHROME_BG,
  DISPLAY,
  FOCUS_RING,
  PRIMARY_BUTTON,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
  STICKER,
  STICKER_BUTTON,
} from "./styles";

const TAPS_TO_HATCH = 5;

/** What the egg screen says as it cracks: a little more excited each tap. */
const EGG_TALK = [
  "Tap the egg!",
  "Something wiggled!",
  "Keep going!",
  "It's cracking!",
  "One more tap!",
];

function Choice({
  selected,
  label,
  onPick,
  children,
}: {
  selected: boolean;
  label: string;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onPick}
      className={`relative grid size-24 place-items-center rounded-3xl border-4 transition-transform active:scale-95 ${FOCUS_RING} ${
        selected
          ? "border-[#ff8a3d] bg-[#ffe3c4] shadow-[0_4px_0_#e0874a]"
          : "border-white bg-white shadow-[0_4px_0_#e7c9a3]"
      }`}
    >
      {children}
      {selected && (
        <span
          aria-hidden="true"
          className="fl-pop-in absolute -right-2 -top-2 grid size-8 place-items-center rounded-full border-[3px] border-white bg-[#e8fff3] shadow-[0_2px_0_rgba(58,35,64,.2)]"
        >
          <FlIcon name="check" className="size-5" />
        </span>
      )}
    </button>
  );
}

/** A label on a naming panel. */
const PANEL_LABEL = `${DISPLAY} text-xl font-semibold`;

/** Tap the egg five times, then name the baby spark and pick its look. */
export default function Hatch() {
  const save = useFlamelings((s) => s.save);
  const go = useFlamelings((s) => s.go);
  const hatch = useFlamelings((s) => s.hatch);
  const [taps, setTaps] = useState(0);
  const [hit, setHit] = useState(0);
  const [step, setStep] = useState<"egg" | "name">("egg");
  const [name, setName] = useState("");
  const [look, setLook] = useState<Look>({
    colour: "ember",
    shape: "flame",
    eyes: "round",
  });

  const owned = new Set<string>([...STARTING_UNLOCKS, ...collectionOf(save)]);
  const colours = COLOURS.filter((id) => owned.has(unlockKey("colour", id)));
  const shapes = SHAPES.filter((id) => owned.has(unlockKey("shape", id)));
  const eyes = EYES.filter((id) => owned.has(unlockKey("eyes", id)));
  const cracked = taps >= TAPS_TO_HATCH;

  function tapEgg() {
    if (cracked) return;
    setTaps((n) => n + 1);
    setHit((n) => n + 1);
    if (taps + 1 >= TAPS_TO_HATCH) {
      void burstConfetti({ particleCount: 140, originY: 0.5 });
    }
  }

  function finish() {
    const id = hatch(name, look);
    go(id ? { screen: "pet", petId: id } : { screen: "shelf" });
  }

  const shell = `flex h-full flex-col items-center overflow-y-auto overflow-x-hidden ${CHROME_BG} ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`;
  const heading = `${DISPLAY} text-center text-3xl font-bold text-[#7a3d2c] [text-shadow:0_0_18px_rgba(255,170,90,.7)] sm:text-4xl dark:text-[#ffe6c4] dark:[text-shadow:0_0_24px_rgba(255,150,60,.55)]`;

  if (step === "egg") {
    return (
      <div className={shell}>
        <div className="flex w-full justify-start py-2">
          <button
            type="button"
            onClick={() => go({ screen: "shelf" })}
            aria-label="Back to the shelf"
            className={`${STICKER_BUTTON} size-16`}
          >
            <FlIcon name="home" className="size-8" />
          </button>
        </div>
        <p className={`mt-2 ${heading}`} aria-live="polite">
          {cracked ? "It hatched!" : EGG_TALK[taps]}
        </p>
        <div className="my-auto flex flex-col items-center gap-6 py-6">
          {cracked ? (
            <div className="relative size-64 sm:size-80">
              <div
                aria-hidden="true"
                className="fl-hatch-rays absolute inset-[-30%] rounded-full bg-[repeating-conic-gradient(rgba(255,226,140,.6)_0deg_9deg,transparent_9deg_30deg)] [mask-image:radial-gradient(circle,#000_20%,transparent_68%)]"
              />
              <div
                aria-hidden="true"
                className="fl-hatch-burst absolute inset-[-10%] rounded-full bg-[radial-gradient(circle,#fff_0%,#fff3b0_22%,rgba(255,170,60,.55)_45%,transparent_70%)]"
              />
              <EggNest
                part="back"
                className="absolute bottom-[1%] left-[-4%] w-[108%]"
              />
              <div className="fl-hatch-pop pointer-events-none absolute inset-x-0 bottom-[6%] top-0">
                <Blob
                  look={look}
                  mood="excited"
                  stage="spark"
                  fit
                  className="size-full"
                />
              </div>
              <EggNest
                part="front"
                className="absolute bottom-[1%] left-[-4%] w-[108%]"
              />
              <EggShell
                side="left"
                className="fl-shell-left absolute inset-x-[13%] bottom-[9%] top-[2%]"
              />
              <EggShell
                side="right"
                className="fl-shell-right absolute inset-x-[13%] bottom-[9%] top-[2%]"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={tapEgg}
              aria-label={`Tap the egg (${taps} of ${TAPS_TO_HATCH})`}
              data-testid="egg"
              className={`size-64 rounded-full sm:size-80 ${FOCUS_RING}`}
            >
              <EggArt taps={taps} hit={hit} />
            </button>
          )}
          {!cracked && (
            <div aria-hidden="true" className="flex gap-3">
              {Array.from({ length: TAPS_TO_HATCH }, (_, i) => (
                <span
                  key={i}
                  className={`size-5 rounded-full transition-transform duration-300 ${
                    i < taps
                      ? "scale-110 bg-gradient-to-b from-[#ffd166] to-[#ff8a3d] shadow-[0_0_12px_rgba(255,150,60,.8)]"
                      : "bg-[#7a5a78]/20 dark:bg-white/15"
                  }`}
                />
              ))}
            </div>
          )}
          {cracked && (
            <button
              type="button"
              onClick={() => setStep("name")}
              className={`fl-hatch-pop ${PRIMARY_BUTTON}`}
            >
              Hello, little flame!
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="flex w-full max-w-xl flex-1 flex-col items-center gap-4 py-4">
        <div className="relative size-44 shrink-0">
          <div
            aria-hidden="true"
            className="absolute inset-[-12%] rounded-full bg-[radial-gradient(circle,rgba(255,200,110,.55)_0%,transparent_65%)]"
          />
          <Blob
            look={look}
            mood="happy"
            stage="spark"
            fit
            className="relative size-full"
          />
        </div>
        <div className={`${STICKER} flex w-full flex-col gap-3 p-5`}>
          <label htmlFor="fl-name" className={PANEL_LABEL}>
            Name your flameling
          </label>
          <div className="flex gap-3">
            <input
              id="fl-name"
              type="text"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              autoCapitalize="words"
              spellCheck={false}
              enterKeyHint="done"
              onChange={(e) => setName(e.target.value)}
              placeholder="Type a name"
              className={`${DISPLAY} min-w-0 flex-1 rounded-full border-4 border-[#f5d0a6] bg-white px-5 py-3 text-2xl font-semibold text-[#3a2340] placeholder:text-[#b9a0b4] focus:border-[#ff8a3d] focus:outline-none focus:ring-[6px] focus:ring-[#ff8a3d]/45`}
            />
            <button
              type="button"
              onClick={() => setName(randomName())}
              aria-label="Pick a random name"
              className={`grid size-16 shrink-0 place-items-center rounded-full bg-[#efe6ff] shadow-[0_4px_0_#cbb8f0,0_8px_18px_rgba(30,10,40,.2)] transition-transform active:translate-y-[3px] active:shadow-[0_2px_0_#cbb8f0] ${FOCUS_RING}`}
            >
              <FlIcon name="dice" className="size-9" />
            </button>
          </div>
        </div>
        <div className={`${STICKER} flex w-full flex-col gap-3 p-5`}>
          <p className={PANEL_LABEL}>Colour</p>
          <div
            role="radiogroup"
            aria-label="Colour"
            className="flex flex-wrap gap-3"
          >
            {colours.map((colour: ColourId) => (
              <Choice
                key={colour}
                selected={look.colour === colour}
                label={colour}
                onPick={() => setLook({ ...look, colour })}
              >
                <div className="fl-still size-20">
                  <Blob
                    look={{ ...look, colour }}
                    mood="happy"
                    className="size-full"
                  />
                </div>
              </Choice>
            ))}
          </div>
          {shapes.length > 1 && (
            <>
              <p className={PANEL_LABEL}>Shape</p>
              <div
                role="radiogroup"
                aria-label="Shape"
                className="flex flex-wrap gap-3"
              >
                {shapes.map((shape: ShapeId) => (
                  <Choice
                    key={shape}
                    selected={look.shape === shape}
                    label={shape}
                    onPick={() => setLook({ ...look, shape })}
                  >
                    <div className="fl-still size-20">
                      <Blob
                        look={{ ...look, shape }}
                        mood="happy"
                        className="size-full"
                      />
                    </div>
                  </Choice>
                ))}
              </div>
            </>
          )}
          <p className={PANEL_LABEL}>Eyes</p>
          <div
            role="radiogroup"
            aria-label="Eyes"
            className="flex flex-wrap gap-3"
          >
            {eyes.map((eye: EyesId) => (
              <Choice
                key={eye}
                selected={look.eyes === eye}
                label={`${eye} eyes`}
                onPick={() => setLook({ ...look, eyes: eye })}
              >
                <div className="fl-still size-20">
                  <Blob
                    look={{ ...look, eyes: eye }}
                    mood="happy"
                    className="size-full"
                  />
                </div>
              </Choice>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={finish}
          disabled={name.trim().length === 0}
          className={PRIMARY_BUTTON}
        >
          Welcome home!
        </button>
      </div>
    </div>
  );
}
