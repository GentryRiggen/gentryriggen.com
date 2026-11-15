"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/planet-smasher/store";
import { TROPHIES, TROPHY_REWARD } from "@/lib/planet-smasher/trophies";
import { playCue } from "../audio/sfx";
import { useShelfOpen } from "./shelfState";

const SHOW_MS = 2500;
const SPARKLES = [
  "[--ps-a:0deg]",
  "[--ps-a:45deg]",
  "[--ps-a:90deg]",
  "[--ps-a:135deg]",
  "[--ps-a:180deg]",
  "[--ps-a:225deg]",
  "[--ps-a:270deg]",
  "[--ps-a:315deg]",
];

/**
 * A gold "TROPHY!" card for each trophy, one after another. It queues behind
 * any unlock cards (it waits until they are cleared).
 */
export default function TrophyToast() {
  const trophies = useGameStore((s) => s.lastTrophies);
  const waiting = useGameStore((s) => s.lastUnlocks.length > 0);
  const ended = useGameStore((s) => s.phase !== "playing");
  const shelfOpen = useShelfOpen((s) => s.open);
  const [index, setIndex] = useState(0);
  const count = waiting || shelfOpen ? 0 : trophies.length;

  useEffect(() => {
    if (count === 0) return;
    const t = setTimeout(() => {
      if (index + 1 < count) {
        setIndex(index + 1);
      } else {
        setIndex(0);
        useGameStore.getState().clearTrophies();
      }
    }, SHOW_MS);
    return () => clearTimeout(t);
  }, [index, count]);

  const id = count > 0 ? trophies[Math.min(index, count - 1)] : null;
  useEffect(() => {
    if (id) playCue("trophy");
  }, [id]);
  const spec = TROPHIES.find((t) => t.id === id);
  if (!spec) return null;
  return (
    <div
      role="status"
      key={spec.id}
      className={`pointer-events-none absolute inset-0 flex justify-center ${
        ended ? "items-start pt-28" : "items-center"
      }`}
    >
      <div className="relative flex flex-col items-center rounded-3xl border-4 border-yellow-300 bg-gradient-to-b from-yellow-500/90 to-amber-700/90 px-10 py-6 text-center shadow-2xl">
        {SPARKLES.map((a) => (
          <span
            key={a}
            aria-hidden="true"
            className={`absolute left-1/2 top-1/2 -ml-3 -mt-3 animate-[ps-sparkle_1.2s_ease-out_forwards] text-2xl ${a}`}
          >
            ✨
          </span>
        ))}
        <span className="text-3xl font-black tracking-wide text-white drop-shadow sm:text-5xl">
          TROPHY!
        </span>
        <span
          aria-hidden="true"
          className="my-2 animate-[ps-grow_0.6s_ease-out_both] text-7xl sm:text-8xl"
        >
          {spec.icon}
        </span>
        <span className="text-xl font-bold text-white sm:text-3xl">
          {spec.name}
        </span>
        <span className="mt-1 text-lg font-black text-yellow-100 sm:text-2xl">
          {`+${TROPHY_REWARD} ⭐`}
        </span>
      </div>
    </div>
  );
}
