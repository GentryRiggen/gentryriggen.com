"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import {
  BONUS_INFO,
  BONUS_KINDS,
  squareAt,
  type BonusKind,
} from "@/lib/plane-builder/prestige";
import BonusSummary from "./BonusSummary";
import {
  cardClass,
  focusRingClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./styles";

/** Squares on each side of the player: the grid is 7 x 7. */
const RADIUS = 3;
const OFFSETS = Array.from({ length: RADIUS * 2 + 1 }, (_, i) => i - RADIUS);

const DIRECTIONS = [
  { name: "up", dx: 0, dy: -1, key: "ArrowUp" },
  { name: "down", dx: 0, dy: 1, key: "ArrowDown" },
  { name: "left", dx: -1, dy: 0, key: "ArrowLeft" },
  { name: "right", dx: 1, dy: 0, key: "ArrowRight" },
] as const;

/**
 * What a square is called to assistive tech. Unvisited squares only say
 * whether something is there, never which bonus it is.
 */
function squareLabel(x: number, y: number, isVisited: boolean): string {
  if (isVisited) return "visited square";
  return squareAt(x, y) ? "mystery bonus" : "empty sky";
}

const CELL_CLASS =
  "flex aspect-square items-center justify-center rounded-lg text-xl sm:text-2xl";

type SquareState = "mystery" | "empty" | "visited";

function squareState(kind: BonusKind | null, isVisited: boolean): SquareState {
  if (isVisited) return "visited";
  return kind ? "mystery" : "empty";
}

const STATE_CLASS: Record<SquareState, string> = {
  mystery:
    "pb-mystery bg-gradient-to-br from-violet-500 to-fuchsia-500 dark:from-violet-600 dark:to-fuchsia-600",
  empty: "bg-slate-100 dark:bg-slate-800",
  visited: "bg-emerald-100 dark:bg-emerald-900/50",
};

interface SquareFaceProps {
  state: SquareState;
  kind: BonusKind | null;
}

/** The picture inside a square: a gift, a trail mark, or the bonus you found. */
function SquareFace({ state, kind }: SquareFaceProps) {
  if (state === "mystery") {
    return (
      <span aria-hidden="true" className="pb-mystery-icon">
        🎁
      </span>
    );
  }
  if (state === "visited") {
    return (
      <span
        aria-hidden="true"
        className="text-emerald-700 opacity-70 dark:text-emerald-200"
      >
        {kind ? BONUS_INFO[kind].emoji : "✓"}
      </span>
    );
  }
  return null;
}

interface HowItWorksProps {
  isOpen: boolean;
}

function HowItWorks({ isOpen }: HowItWorksProps) {
  return (
    <details
      open={isOpen}
      className="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"
    >
      <summary
        className={`min-h-6 cursor-pointer rounded font-bold text-sky-900 dark:text-sky-100 ${focusRingClass}`}
      >
        How the Sky Map works
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Beat all 10 worlds to Prestige.</li>
        <li>Each Prestige lets you move one square on the map.</li>
        <li>
          A mystery square 🎁 holds a surprise bonus. Empty sky holds nothing.
        </li>
        <li>Squares you have visited are green. Bonuses stack forever.</li>
        <li>
          Rare prizes, like Stars, get more common farther from the start.
        </li>
      </ul>
      <h2 className="mt-3 font-bold text-sky-900 dark:text-sky-100">
        Bonuses you can win
      </h2>
      <ul className="mt-1 space-y-1">
        {BONUS_KINDS.map((kind) => (
          <li key={kind} data-legend={kind} className="flex gap-2">
            <span aria-hidden="true">{BONUS_INFO[kind].emoji}</span>
            <span>
              <span className="font-semibold">{BONUS_INFO[kind].name}</span>:{" "}
              {BONUS_INFO[kind].effect}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function SkyMap() {
  const prestige = usePlaneBuilderStore((s) => s.progress.prestige);
  const move = usePlaneBuilderStore((s) => s.move);
  const goToLevels = usePlaneBuilderStore((s) => s.goToLevels);
  const [message, setMessage] = useState<{ id: number; text: string } | null>(
    null
  );
  const { x: px, y: py, movePending, visited, bonuses, level } = prestige;
  const visitedSet = useMemo(() => new Set(visited), [visited]);

  const handleMove = useCallback(
    (dx: number, dy: number) => {
      const state = usePlaneBuilderStore.getState();
      if (!state.progress.prestige.movePending) return;
      const nx = state.progress.prestige.x + dx;
      const ny = state.progress.prestige.y + dy;
      const wasVisited = state.progress.prestige.visited.includes(
        `${nx},${ny}`
      );
      const collected = move(dx, dy);
      const text = collected
        ? `+1 ${BONUS_INFO[collected].emoji} ${BONUS_INFO[collected].name}!`
        : wasVisited
          ? "Already collected"
          : "Nothing here this time";
      setMessage((m) => ({ id: (m?.id ?? 0) + 1, text }));
    },
    [move]
  );

  useEffect(() => {
    if (!movePending) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const dir = DIRECTIONS.find((d) => d.key === event.key);
      if (!dir) return;
      event.preventDefault();
      handleMove(dir.dx, dir.dy);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [movePending, handleMove]);

  return (
    <div className="pointer-events-auto absolute inset-0 z-10 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-3 p-4">
        <section aria-labelledby="sky-map-title" className={`p-3 ${cardClass}`}>
          <header className="flex items-baseline justify-between gap-2">
            <h1
              id="sky-map-title"
              className="text-2xl font-extrabold text-sky-900 dark:text-sky-100"
            >
              Sky Map
            </h1>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
              ⭐ Prestige {level}
            </p>
          </header>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {movePending
              ? "Move one square to win a surprise bonus."
              : "Browsing the map. Your bonuses stack forever."}
          </p>
          <div
            role="group"
            aria-label="Sky Map squares"
            className="mt-3 grid grid-cols-7 gap-1"
          >
            {OFFSETS.flatMap((oy) =>
              OFFSETS.map((ox) => {
                const x = px + ox;
                const y = py + oy;
                const isPlayer = ox === 0 && oy === 0;
                const dir = DIRECTIONS.find((d) => d.dx === ox && d.dy === oy);
                const kind = squareAt(x, y);
                const isVisited = visitedSet.has(`${x},${y}`);
                if (isPlayer) {
                  return (
                    <div
                      key={`${x},${y}`}
                      role="img"
                      aria-label="You are here"
                      className={`${CELL_CLASS} bg-sky-200 ring-2 ring-sky-600 dark:bg-sky-800 dark:ring-sky-300`}
                    >
                      ✈️
                    </div>
                  );
                }
                const state = squareState(kind, isVisited);
                const face = <SquareFace state={state} kind={kind} />;
                if (dir && movePending) {
                  return (
                    <button
                      key={`${x},${y}`}
                      type="button"
                      onClick={() => handleMove(dir.dx, dir.dy)}
                      aria-label={`Move ${dir.name}: ${squareLabel(x, y, isVisited)}`}
                      data-square={state}
                      className={`${CELL_CLASS} touch-manipulation ring-2 ring-offset-1 ring-offset-white hover:brightness-110 dark:ring-offset-slate-900 ring-amber-500 dark:ring-amber-400 ${STATE_CLASS[state]} ${focusRingClass}`}
                    >
                      {face}
                    </button>
                  );
                }
                return (
                  <div
                    key={`${x},${y}`}
                    aria-hidden="true"
                    data-square={state}
                    className={`${CELL_CLASS} ${STATE_CLASS[state]} ${state === "visited" ? "ring-1 ring-emerald-400 dark:ring-emerald-500" : ""}`}
                  >
                    {face}
                  </div>
                );
              })
            )}
          </div>
          <p
            role="status"
            className="mt-2 flex min-h-8 items-center justify-center"
          >
            {message ? (
              <span
                key={message.id}
                className="pb-pop rounded-full bg-emerald-100 px-3 py-1 text-base font-extrabold text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100"
              >
                {message.text}
              </span>
            ) : null}
          </p>
          <HowItWorks isOpen={level === 0} />
          <div className="mt-3">
            <BonusSummary bonuses={bonuses} />
          </div>
          <div className="mt-4 flex gap-3">
            {movePending ? null : (
              <button
                type="button"
                onClick={goToLevels}
                className={secondaryButtonClass}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={goToLevels}
              disabled={movePending}
              className={`${primaryButtonClass} flex-1`}
            >
              Start run
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
