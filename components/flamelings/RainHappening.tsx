import { useEffect, useRef, useState } from "react";
import { playSound } from "@/lib/flamelings/sound";
import { useFlamelings } from "@/lib/flamelings/store";
import { CloudArt, DropArt } from "./HappeningArt";
import type { HappeningProps } from "./happeningProps";
import { FOCUS_RING } from "./styles";
import { useLater } from "./useLater";

export const RAIN_MS = 12_000;
const TICK_MS = 100;
const SPAWN_MS = 700;
const FALL_MS = 3200;
const DROP_SPOTS = [18, 34, 50, 66, 82, 26, 58, 74, 42];

interface Drop {
  id: number;
  x: number;
  born: number;
}

/**
 * A little shower: clouds roll in and drops fall towards the pet. Tap a drop
 * to pop it for about twelve seconds. Drops that get through only make the
 * pet a bit soggy. The clock only runs while the page is showing and nothing
 * else is open on top.
 */
export default function RainHappening({
  petId,
  happening,
  onCheer,
  paused,
}: HappeningProps & { paused: boolean }) {
  const complete = useFlamelings((s) => s.completeHappening);
  const [wasDone] = useState(happening.done);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [popped, setPopped] = useState(0);
  const [bursts, setBursts] = useState<{ id: number; x: number }[]>([]);
  const [phase, setPhase] = useState<"rain" | "clearing" | "gone">("rain");
  const clock = useRef({
    elapsed: 0,
    spawned: 0,
    missed: 0,
    popped: 0,
    next: 0,
    drops: [] as Drop[],
  });
  const pausedRef = useRef(paused);
  const later = useLater();

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (wasDone) return;
    const timer = window.setInterval(() => {
      if (pausedRef.current || document.hidden) return;
      const c = clock.current;
      c.elapsed += TICK_MS;
      if (c.elapsed >= RAIN_MS) {
        window.clearInterval(timer);
        c.missed += c.drops.length;
        c.drops = [];
        setDrops([]);
        setPhase("clearing");
        complete(petId, { popped: c.popped, missed: c.missed });
        playSound("sparkle");
        later(() => setPhase("gone"), 1700);
        return;
      }
      if (c.elapsed >= c.next && c.elapsed < RAIN_MS - FALL_MS / 2) {
        c.next += SPAWN_MS;
        c.spawned += 1;
        const id = c.spawned;
        const x = DROP_SPOTS[id % DROP_SPOTS.length];
        c.drops = [...c.drops, { id, x, born: c.elapsed }];
        setDrops(c.drops);
        playSound("drizzle");
      }
      const live = c.drops.filter((d) => c.elapsed - d.born < FALL_MS);
      if (live.length !== c.drops.length) {
        c.missed += c.drops.length - live.length;
        c.drops = live;
        setDrops(live);
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
    // The shower runs once; the callbacks it calls are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (wasDone || phase === "gone") return null;

  function pop(drop: Drop) {
    clock.current.drops = clock.current.drops.filter((d) => d.id !== drop.id);
    setDrops(clock.current.drops);
    clock.current.popped += 1;
    setPopped((n) => n + 1);
    setBursts((list) => [...list, { id: drop.id, x: drop.x }]);
    later(() => setBursts((list) => list.filter((b) => b.id !== drop.id)), 450);
    playSound("pop");
    onCheer(drop.id % 2 ? "laugh" : "dance");
  }

  return (
    <div
      data-testid="happening-rain"
      data-popped={popped}
      className="pointer-events-none absolute inset-0"
    >
      <div
        className={`absolute inset-x-0 top-[17%] flex justify-center gap-2 ${
          phase === "rain" ? "fl-cloud-in" : "fl-cloud-out"
        }`}
      >
        <CloudArt className="w-[44%] max-w-72 opacity-95" />
        <CloudArt className="hidden w-[30%] max-w-52 opacity-90 sm:block" />
      </div>
      {drops.map((drop) => (
        <button
          key={drop.id}
          type="button"
          aria-label="Pop the raindrop"
          data-testid="raindrop"
          onClick={() => pop(drop)}
          style={{
            left: `${drop.x}%`,
            animationPlayState: paused ? "paused" : "running",
          }}
          className={`fl-drop pointer-events-auto absolute top-[26%] -ml-8 grid size-16 place-items-center rounded-full ${FOCUS_RING}`}
        >
          <DropArt className="size-12" />
        </button>
      ))}
      {bursts.map((b) => (
        <span
          key={b.id}
          aria-hidden="true"
          style={{ left: `${b.x}%` }}
          className="fl-pop-burst absolute top-[60%] -ml-6 text-5xl"
        >
          ✨
        </span>
      ))}
    </div>
  );
}
