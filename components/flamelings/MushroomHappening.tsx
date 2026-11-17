import { useEffect, useRef, useState } from "react";
import { MUSHROOM_RING, mushroomSequence } from "@/lib/flamelings/happenings";
import { playSound, type SoundName } from "@/lib/flamelings/sound";
import { useFlamelings } from "@/lib/flamelings/store";
import { MushroomArt } from "./HappeningArt";
import type { HappeningProps } from "./happeningProps";
import { FOCUS_RING } from "./styles";
import { useLater } from "./useLater";

/** Where the ring of mushrooms sits, as percentages of the glade. */
const SPOTS = [
  "left-[8%] top-[66%]",
  "left-[24%] top-[74%]",
  "left-[50%] top-[77%] -translate-x-1/2",
  "right-[24%] top-[74%]",
  "right-[8%] top-[66%]",
];
const STEP_MS = 800;
const LEAD_MS = 1000;

/** Mushrooms pop up in a ring and glow in order; tap them in the same order. */
export default function MushroomHappening({
  petId,
  happening,
  onCheer,
}: HappeningProps) {
  const complete = useFlamelings((s) => s.completeHappening);
  const [wasDone] = useState(happening.done);
  const steps = Number(happening.variant) || 3;
  const [sequence] = useState(() =>
    mushroomSequence(`${petId}|${happening.window}`, steps)
  );
  const [phase, setPhase] = useState<"watch" | "play" | "win" | "gone">(
    "watch"
  );
  const [lit, setLit] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const later = useLater();
  const started = useRef(false);

  function showSequence(first: number) {
    setPhase("watch");
    setProgress(0);
    sequence.forEach((mushroom, i) => {
      later(
        () => {
          setLit(mushroom);
          playSound(`mush${mushroom}` as SoundName);
        },
        first + i * STEP_MS
      );
      later(() => setLit(null), first + i * STEP_MS + STEP_MS * 0.6);
    });
    later(() => setPhase("play"), first + sequence.length * STEP_MS);
  }

  useEffect(() => {
    if (wasDone || started.current) return;
    started.current = true;
    showSequence(LEAD_MS);
    // Starts once; the sequence is fixed for this happening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (wasDone || phase === "gone") return null;

  function tap(index: number) {
    if (phase !== "play") return;
    if (index !== sequence[progress]) {
      // A gentle "not that one": wiggle, then show the dance again.
      setWrong(index);
      later(() => setWrong(null), 350);
      showSequence(900);
      return;
    }
    setLit(index);
    playSound(`mush${index}` as SoundName);
    later(() => setLit(null), 250);
    const next = progress + 1;
    setProgress(next);
    if (next < sequence.length) return;
    setPhase("win");
    complete(petId);
    onCheer("dance");
    later(() => setPhase("gone"), 2600);
  }

  return (
    <div
      data-testid="happening-mushrooms"
      data-phase={phase}
      className="pointer-events-none absolute inset-0"
    >
      <p
        aria-hidden="true"
        className="absolute left-1/2 top-[26%] flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-3xl"
      >
        <span>{phase === "watch" ? "👀" : phase === "play" ? "👆" : "🎉"}</span>
        {sequence.map((_, i) => (
          <span
            key={i}
            className={`size-3.5 rounded-full ${
              i < progress ? "bg-amber-300" : "bg-white/50"
            }`}
          />
        ))}
      </p>
      {Array.from({ length: MUSHROOM_RING }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => tap(i)}
          disabled={phase !== "play"}
          aria-label={`Mushroom ${i + 1} of ${MUSHROOM_RING}`}
          data-testid="mushroom"
          data-lit={lit === i ? "1" : "0"}
          style={{ animationDelay: `${i * 120}ms` }}
          className={`fl-mush-pop pointer-events-auto absolute grid size-20 place-items-center disabled:opacity-100 sm:size-24 ${SPOTS[i]} ${FOCUS_RING}`}
        >
          <span
            className={`block size-full ${
              phase === "win"
                ? "fl-mush-dance"
                : wrong === i
                  ? "fl-mush-wrong"
                  : lit === i
                    ? "fl-mush-lit"
                    : "transition-transform"
            }`}
          >
            <MushroomArt index={i} className="size-full" />
          </span>
        </button>
      ))}
    </div>
  );
}
