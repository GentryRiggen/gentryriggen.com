import Link from "next/link";
import { MAX_PETS } from "@/lib/flamelings/actions";
import { stageFor } from "@/lib/flamelings/progress";
import { hasHappeningWaiting } from "@/lib/flamelings/happenings";
import { isAwake, moodOf, type Mood } from "@/lib/flamelings/sim";
import {
  fadeLevel,
  levelLabel,
  stageTitle,
  stateGlyph,
} from "@/lib/flamelings/status";
import { useFlamelings } from "@/lib/flamelings/store";
import { FLAMELINGS_VERSION } from "@/lib/flamelings/version";
import type { Pet } from "@/lib/flamelings/types";
import Blob from "./Blob";
import EggArt from "./EggArt";
import FlIcon from "./FlIcon";
import SoundToggle from "./SoundToggle";
import {
  CHROME_BG,
  DISPLAY,
  FOCUS_RING,
  JAR_CARD,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
  STICKER_BUTTON,
} from "./styles";

/** One word for how a pet feels, under its name on the shelf. */
const MOOD_WORD: Record<Mood, string> = {
  happy: "cozy",
  excited: "excited",
  eating: "munching",
  hungry: "hungry",
  sad: "a bit sad",
  asleep: "sleepy",
  ember: "just an ember",
};

/** The empty jar waiting for a new egg: dashed, with a warm wash. */
const NEW_JAR =
  "relative overflow-hidden rounded-[30px] border-2 border-dashed border-[#f08a4b]/70 bg-[rgba(255,180,90,.14)] text-[#3a2340] shadow-[inset_0_0_56px_rgba(255,140,60,.18)] dark:border-[rgba(255,200,140,.45)] dark:bg-[rgba(255,180,90,.06)] dark:text-[#ffe6c4]";

/** A jar's lid and the glint on its glass. */
function JarGlass() {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-3 w-2/5 -translate-x-1/2 rounded-b-xl bg-gradient-to-b from-[#c98a55] to-[#8a5230] shadow-[0_2px_0_rgba(58,35,64,.15)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-12 left-4 top-20 w-2.5 rounded-full bg-white/50 dark:bg-white/15"
      />
    </>
  );
}

/** The wooden shelf the jars stand on; neighbours overlap into one plank. */
function Plank() {
  return (
    <span
      aria-hidden="true"
      className="relative -mx-6 -mt-1 block h-5 rounded-lg bg-gradient-to-b from-[#b4703f] via-[#9a5b34] to-[#6d3c20] sm:-mx-8"
    >
      {/* Shadows sit under every plank, so neighbours join without a seam. */}
      <span className="absolute inset-x-1 bottom-0 top-2 -z-10 rounded-lg shadow-[0_8px_14px_rgba(58,35,64,.4)] dark:shadow-[0_8px_16px_rgba(0,0,0,.55)]" />
      <span className="absolute inset-x-0 top-1 h-0.5 bg-[#d8975e]/60" />
    </span>
  );
}

function PetCard({ pet, nowMs }: { pet: Pet; nowMs: number }) {
  const go = useFlamelings((s) => s.go);
  const glyph = stateGlyph(pet, nowMs);
  const stage = stageFor(pet.level);
  const mood = moodOf(pet, nowMs);
  const waiting = hasHappeningWaiting(pet, nowMs, isAwake(nowMs));
  return (
    <div className="flex flex-col">
      <div className="relative">
        <button
          type="button"
          onClick={() => go({ screen: "pet", petId: pet.id })}
          aria-label={`${pet.name}, level ${pet.level} ${stageTitle(pet.level, pet.form)}${glyph ? `, ${glyph.label}` : ""}${waiting ? ", something is happening" : ""}`}
          data-testid="pet-card"
          className={`${JAR_CARD} flex min-h-64 w-full flex-col items-center justify-end gap-0.5 px-4 pb-4 pt-6 transition-transform active:scale-95 ${FOCUS_RING}`}
        >
          <JarGlass />
          <span className="absolute right-3 top-4 flex flex-col gap-2">
            {waiting && (
              <span
                aria-hidden="true"
                data-testid="happening-bubble"
                className={`${DISPLAY} fl-bob grid size-11 place-items-center rounded-full bg-gradient-to-b from-[#ff6b5a] to-[#e0352b] text-2xl font-bold text-white shadow-[0_3px_0_#a8231b]`}
              >
                !
              </span>
            )}
            {glyph && (
              <span
                aria-hidden="true"
                className="grid size-11 place-items-center rounded-full bg-[#fff6e6] text-2xl shadow-[0_3px_0_#e7c9a3]"
              >
                {glyph.glyph}
              </span>
            )}
          </span>
          <Blob
            look={pet.look}
            worn={pet.worn}
            form={pet.form}
            fade={fadeLevel(pet)}
            mood={mood}
            stage={stage.id}
            fit
            className="size-40 sm:size-44"
          />
          <span className={`${DISPLAY} max-w-full truncate text-2xl font-bold`}>
            {pet.name}
          </span>
          <span className="max-w-full truncate text-sm font-extrabold text-[#7a5a78] dark:text-[#c9a9d6]">
            {levelLabel(pet.level, pet.form)} · {MOOD_WORD[mood]}
          </span>
        </button>
        <button
          type="button"
          onClick={() =>
            go({ screen: "friends", petId: pet.id, from: "shelf" })
          }
          aria-label={`Friends of ${pet.name}`}
          data-testid="pet-friends"
          className={`absolute left-3 top-4 grid size-14 place-items-center rounded-full border-4 border-[#fff6e6] bg-[#7cc4ff] shadow-[inset_0_-4px_0_rgba(0,0,0,.15),0_4px_10px_rgba(30,10,40,.25)] transition-transform active:translate-y-[2px] ${FOCUS_RING}`}
        >
          <FlIcon name="friends" className="size-8" />
        </button>
      </div>
      <Plank />
    </div>
  );
}

/** Twinkly stars over the shelf at dusk (dark mode only). */
function ShelfStars() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1024 200"
      preserveAspectRatio="xMidYMin slice"
      className="pointer-events-none absolute inset-x-0 top-0 hidden h-48 w-full dark:block"
    >
      <g fill="#fff6e6">
        <circle className="fl-twinkle" cx="700" cy="60" r="2" />
        <circle
          className="fl-twinkle [animation-delay:1s]"
          cx="860"
          cy="110"
          r="2.4"
        />
        <circle
          className="fl-twinkle [animation-delay:.4s]"
          cx="560"
          cy="90"
          r="1.6"
        />
        <circle
          className="fl-twinkle [animation-delay:1.6s]"
          cx="960"
          cy="40"
          r="1.8"
        />
        <circle
          className="fl-twinkle [animation-delay:2.2s]"
          cx="420"
          cy="40"
          r="1.6"
        />
        <circle
          className="fl-twinkle [animation-delay:.8s]"
          cx="120"
          cy="150"
          r="1.8"
        />
      </g>
    </svg>
  );
}

/** The landing screen: every pet in a jar on a shelf, a place to hatch more. */
export default function Shelf() {
  const save = useFlamelings((s) => s.save);
  const clock = useFlamelings((s) => s.clock);
  const go = useFlamelings((s) => s.go);
  const canHatch = save.pets.length < MAX_PETS;
  return (
    <div
      className={`relative flex h-full flex-col overflow-y-auto overflow-x-hidden ${CHROME_BG} ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <ShelfStars />
      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between gap-3 py-2">
        <h1
          className={`${DISPLAY} flex items-center gap-2 text-4xl font-bold tracking-tight text-[#7a3d2c] [text-shadow:0_0_18px_rgba(255,170,90,.7)] sm:gap-3 sm:text-5xl dark:text-[#ffe6c4] dark:[text-shadow:0_0_24px_rgba(255,150,60,.55)]`}
        >
          <FlIcon
            name="fuel"
            className="size-10 drop-shadow-[0_0_10px_rgba(255,150,60,.7)] sm:size-12"
          />
          Flamelings
        </h1>
        <div className="flex items-center gap-3">
          {save.memorial.length > 0 && (
            <button
              type="button"
              onClick={() => go({ screen: "grove" })}
              className={`${STICKER_BUTTON} ${DISPLAY} flex gap-2 rounded-full px-5 text-lg font-semibold text-[#2f6b4f]`}
            >
              <span aria-hidden="true">🕯️</span>
              <span>Memory Grove</span>
            </button>
          )}
          <SoundToggle />
        </div>
      </header>
      <main className="relative isolate mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 content-start gap-x-10 gap-y-8 px-6 py-5 sm:grid-cols-2 sm:gap-x-14 sm:px-8 lg:grid-cols-3">
        {save.pets.map((pet) => (
          <PetCard key={pet.id} pet={pet} nowMs={clock} />
        ))}
        {canHatch && (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => go({ screen: "hatch" })}
              aria-label="Hatch new"
              data-testid="hatch-new"
              className={`${NEW_JAR} flex min-h-64 w-full flex-col items-center justify-end gap-0.5 px-4 pb-4 pt-6 transition-transform active:scale-95 ${FOCUS_RING}`}
            >
              <EggArt taps={0} hit={0} className="mb-1 size-36" />
              <span className={`${DISPLAY} text-2xl font-bold`}>Hatch new</span>
              <span className="text-sm font-extrabold text-[#7a5a78] dark:text-[#c9a9d6]">
                tap to begin
              </span>
            </button>
            <Plank />
          </div>
        )}
      </main>
      <footer className="relative flex justify-center py-3">
        <Link
          href="/flamelings/versions"
          className={`${DISPLAY} rounded-full bg-white/40 px-5 py-2 text-base font-medium text-[#7a5a78] dark:bg-white/[.06] dark:text-[#c9a9d6] ${FOCUS_RING}`}
        >
          What&apos;s new ·{" "}
          <b className="font-semibold">v{FLAMELINGS_VERSION}</b>
        </Link>
      </footer>
    </div>
  );
}
