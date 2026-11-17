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
import EggArt from "./EggArt";
import {
  BIG_BUTTON,
  CARD,
  CHROME_BG,
  FOCUS_RING,
  PRIMARY_BUTTON,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
} from "./styles";

const TAPS_TO_HATCH = 5;

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
      className={`grid size-24 place-items-center rounded-3xl border-4 transition-transform active:scale-95 ${FOCUS_RING} ${
        selected
          ? "border-orange-500 bg-orange-100 dark:border-orange-300 dark:bg-orange-950"
          : "border-transparent bg-white/70 dark:bg-slate-800/70"
      }`}
    >
      {children}
    </button>
  );
}

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
  }

  function finish() {
    const id = hatch(name, look);
    go(id ? { screen: "pet", petId: id } : { screen: "shelf" });
  }

  const shell = `flex h-full flex-col items-center overflow-y-auto overflow-x-hidden ${CHROME_BG} ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`;

  if (step === "egg") {
    return (
      <div className={shell}>
        <div className="flex w-full justify-start py-2">
          <button
            type="button"
            onClick={() => go({ screen: "shelf" })}
            aria-label="Back to the shelf"
            className={`${BIG_BUTTON} bg-white/80 px-5 text-2xl dark:bg-slate-800/80`}
          >
            <span aria-hidden="true">🏠</span>
          </button>
        </div>
        <p
          className="mt-2 text-center text-2xl font-extrabold"
          aria-live="polite"
        >
          {cracked ? "It hatched!" : "Tap the egg!"}
        </p>
        <div className="my-auto flex flex-col items-center gap-6 py-6">
          {cracked ? (
            <Blob
              look={look}
              mood="excited"
              stage="spark"
              className="size-64 sm:size-80"
            />
          ) : (
            <button
              type="button"
              onClick={tapEgg}
              aria-label={`Tap the egg (${taps} of ${TAPS_TO_HATCH})`}
              data-testid="egg"
              className={`size-56 rounded-full sm:size-72 ${FOCUS_RING}`}
            >
              <EggArt taps={taps} hit={hit} />
            </button>
          )}
          {!cracked && (
            <div aria-hidden="true" className="flex gap-2">
              {Array.from({ length: TAPS_TO_HATCH }, (_, i) => (
                <span
                  key={i}
                  className={`size-4 rounded-full ${i < taps ? "bg-orange-500" : "bg-orange-500/25"}`}
                />
              ))}
            </div>
          )}
          {cracked && (
            <button
              type="button"
              onClick={() => setStep("name")}
              className={PRIMARY_BUTTON}
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
        <Blob
          look={look}
          mood="happy"
          stage="spark"
          className="size-44 shrink-0"
        />
        <div className={`${CARD} flex w-full flex-col gap-3 p-5`}>
          <label htmlFor="fl-name" className="text-xl font-extrabold">
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
              className={`min-w-0 flex-1 rounded-2xl border-4 border-orange-300 bg-white px-4 py-3 text-2xl font-bold text-stone-900 dark:border-orange-400/60 dark:bg-slate-900 dark:text-amber-50 ${FOCUS_RING}`}
            />
            <button
              type="button"
              onClick={() => setName(randomName())}
              aria-label="Pick a random name"
              className={`${BIG_BUTTON} bg-white text-3xl dark:bg-slate-700`}
            >
              <span aria-hidden="true">🎲</span>
            </button>
          </div>
        </div>
        <div className={`${CARD} flex w-full flex-col gap-2 p-4`}>
          <p className="text-lg font-extrabold">Colour</p>
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
              <p className="text-lg font-extrabold">Shape</p>
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
          <p className="text-lg font-extrabold">Eyes</p>
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
