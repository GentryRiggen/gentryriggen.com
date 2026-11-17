import { useCallback, useEffect, useRef, useState } from "react";
import useVisibilityPause from "@/components/game-kit/useVisibilityPause";
import {
  baseLog,
  dropLog,
  MAX_LOGS,
  swing,
  swingSpeed,
  type Log,
} from "@/lib/flamelings/logStack";
import { playTuning } from "@/lib/flamelings/playTuning";
import { stageFor } from "@/lib/flamelings/progress";
import { playSound } from "@/lib/flamelings/sound";
import type { Pet } from "@/lib/flamelings/types";
import { SAFE_INSETS } from "@/lib/game-kit/safeArea";
import Blob from "./Blob";
import { PRIMARY_BUTTON } from "./styles";

/** One log is this tall, in percent of the stacking field. */
const LOG_H = 6.2;
/** The hearth slab the base log rests on, in percent of the field. */
const SLAB_H = 6;
const OVER_DELAY_MS = 800;
const CHEER_MS = 800;
const MAX_STEP_S = 0.05;

interface Fall {
  id: number;
  log: Log;
  level: number;
}

interface LogStackProps {
  pet: Pet;
  /** Called once with the number of logs stacked (1 to 12) on "Done". */
  onDone: (score: number) => void;
}

function bottomOf(level: number): number {
  return SLAB_H + level * LOG_H;
}

/**
 * Log Stack: a log swings across the top and a tap drops it onto the tower.
 * What hangs over falls off; the round ends on a clean miss or at 12 logs.
 */
export default function LogStack({ pet, onDone }: LogStackProps) {
  const [tower, setTower] = useState<Log[]>(() => [baseLog()]);
  const [falls, setFalls] = useState<Fall[]>([]);
  const [over, setOver] = useState(false);
  const [cheering, setCheering] = useState(false);
  const movingEl = useRef<HTMLDivElement>(null);
  const motion = useRef({ x: 0, dir: 1 as 1 | -1 });
  const lastFrame = useRef(0);
  const frame = useRef<number | undefined>(undefined);
  const timers = useRef<number[]>([]);
  const fallId = useRef(0);
  const busy = useRef(false);
  const [dropping, setDropping] = useState(false);
  const towerRef = useRef(tower);
  const running = useRef(true);

  const top = tower[tower.length - 1];
  const movingWidth = top.width;

  // The swinging log starts in the middle of the hearth each time.
  useEffect(() => {
    towerRef.current = tower;
    motion.current = {
      x: (100 - movingWidth) / 2,
      dir: tower.length % 2 === 0 ? -1 : 1,
    };
  }, [tower, movingWidth]);

  const loopRef = useRef<() => void>(() => {});

  const start = useCallback(() => {
    running.current = true;
    lastFrame.current = 0;
    if (frame.current === undefined) {
      frame.current = window.requestAnimationFrame(loopRef.current);
    }
  }, []);
  const stop = useCallback(() => {
    running.current = false;
    if (frame.current !== undefined) window.cancelAnimationFrame(frame.current);
    frame.current = undefined;
  }, []);

  useEffect(() => {
    const loop = () => {
      frame.current = undefined;
      if (!running.current) return;
      const now = performance.now();
      const seconds = Math.min(
        MAX_STEP_S,
        lastFrame.current ? (now - lastFrame.current) / 1000 : 0
      );
      lastFrame.current = now;
      const stack = towerRef.current;
      const width = stack[stack.length - 1].width;
      if (!busy.current) {
        motion.current = swing(
          motion.current.x,
          motion.current.dir,
          width,
          swingSpeed(stack.length) * playTuning.logs,
          seconds
        );
      }
      const el = movingEl.current;
      if (el) {
        el.style.transform = `translateX(${(motion.current.x / width) * 100}%)`;
      }
      frame.current = window.requestAnimationFrame(loop);
    };
    loopRef.current = loop;
    start();
    const pending = timers.current;
    return () => {
      stop();
      pending.forEach((t) => window.clearTimeout(t));
    };
  }, [start, stop]);

  useVisibilityPause({ onHidden: stop, onVisible: start });

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const drop = useCallback(() => {
    if (busy.current || over) return;
    busy.current = true;
    setDropping(true);
    const stack = towerRef.current;
    const below = stack[stack.length - 1];
    const dropped: Log = { left: motion.current.x, width: below.width };
    const result = dropLog(below, dropped);
    const level = stack.length;
    if (result.kind === "miss") {
      playSound("thud");
      const id = (fallId.current += 1);
      setFalls((f) => [...f, { id, log: dropped, level }]);
      later(() => setOver(true), OVER_DELAY_MS);
      return;
    }
    playSound("thud");
    const next = [...stack, result.log];
    setTower(next);
    if (result.cutOff.length > 0) {
      const added = result.cutOff.map((log) => ({
        id: (fallId.current += 1),
        log,
        level,
      }));
      setFalls((f) => [...f, ...added]);
    }
    if (result.perfect || next.length % 3 === 0) playSound("cheer");
    setCheering(true);
    later(() => setCheering(false), CHEER_MS);
    if (next.length >= MAX_LOGS) {
      playSound("sparkle");
      later(() => setOver(true), OVER_DELAY_MS);
      return;
    }
    later(() => {
      busy.current = false;
      setDropping(false);
    }, 250);
  }, [over, later]);

  const score = tower.length;
  const won = tower.length >= MAX_LOGS;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Log Stack"
      className={`fixed inset-0 z-20 overflow-hidden bg-gradient-to-b from-indigo-950 via-indigo-900 to-orange-950 ${SAFE_INSETS}`}
    >
      {!over && (
        <button
          type="button"
          data-testid="logs-drop"
          aria-label="Drop the log"
          onPointerDown={drop}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) drop();
          }}
          className="absolute inset-0 z-10 touch-none select-none focus-visible:outline-none focus-visible:ring-8 focus-visible:ring-sky-400"
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-[max(1rem,env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="rounded-2xl bg-black/50 px-4 py-2 text-2xl font-black text-white">
          <span aria-hidden="true">🪵 </span>
          <span data-testid="logs-score">{score}</span>
          <span className="text-base opacity-70"> / {MAX_LOGS}</span>
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 top-[18%] w-[min(88vw,40rem)] -translate-x-1/2">
        <div
          className="absolute inset-x-0 bottom-0 rounded-2xl bg-stone-600 shadow-lg"
          style={{ height: `${SLAB_H}%` }}
        >
          <span
            aria-hidden="true"
            className="absolute -top-1 left-0 right-0 h-2 rounded-full bg-stone-400"
          />
        </div>

        {tower.map((log, i) => (
          <div
            key={i}
            data-testid="log"
            className={`fl-log absolute ${i > 0 ? "fl-log-drop" : ""}`}
            style={
              {
                left: `${log.left}%`,
                width: `${log.width}%`,
                bottom: `${bottomOf(i)}%`,
                height: `${LOG_H}%`,
                "--fl-drop": ((100 - LOG_H - bottomOf(i)) / LOG_H).toFixed(2),
              } as React.CSSProperties
            }
          />
        ))}

        {falls.map((f) => (
          <div
            key={f.id}
            className="fl-log fl-log-fall absolute"
            onAnimationEnd={() =>
              setFalls((list) => list.filter((x) => x.id !== f.id))
            }
            style={{
              left: `${f.log.left}%`,
              width: `${f.log.width}%`,
              bottom: `${bottomOf(f.level)}%`,
              height: `${LOG_H}%`,
            }}
          />
        ))}

        {!over && (
          <div
            className={`absolute top-0 ${dropping ? "invisible" : ""}`}
            style={{ left: 0, width: `${movingWidth}%`, height: `${LOG_H}%` }}
          >
            <div
              ref={movingEl}
              data-testid="log-moving"
              className="fl-log h-full w-full"
            />
          </div>
        )}
      </div>

      <div
        className={`pointer-events-none absolute bottom-[calc(max(0.5rem,env(safe-area-inset-bottom))+2.5rem)] right-[max(0.5rem,env(safe-area-inset-right))] z-0 ${
          cheering ? "fl-giggle" : ""
        }`}
      >
        <Blob
          look={pet.look}
          worn={pet.worn}
          form={pet.form}
          mood={cheering || won ? "excited" : "happy"}
          stage={stageFor(pet.level).id}
          className="size-[min(34vw,26vh)] min-h-28 min-w-28"
        />
      </div>

      {over && (
        <div className="absolute inset-0 z-30 grid place-items-center p-6">
          <div className="fl-card-in flex flex-col items-center gap-4 rounded-3xl bg-white p-8 text-center text-stone-900 shadow-xl dark:bg-slate-800 dark:text-amber-50">
            <p className="text-3xl font-black">
              {won
                ? "Wow! A full tower!"
                : `You stacked ${score} log${score === 1 ? "" : "s"}!`}
            </p>
            <p aria-hidden="true" className="text-5xl">
              {won ? "🪵🌟🪵" : "🪵🎉🪵"}
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
