"use client";

import { useEffect, useState } from "react";
import { PLANETS } from "@/lib/planet-smasher/planets";
import { useGameStore } from "@/lib/planet-smasher/store";
import { TOOLS } from "@/lib/planet-smasher/tools";
import type { Unlockable } from "@/lib/planet-smasher/unlocks";
import { markFresh } from "./freshItems";

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

function describe(u: Unlockable): { icon: string; name: string } {
  return u.kind === "tool"
    ? { icon: TOOLS[u.id].icon, name: TOOLS[u.id].name }
    : { icon: PLANETS[u.id].icon, name: PLANETS[u.id].name };
}

/** A big "NEW!" card for each unlock, one after another. */
export default function UnlockToast() {
  const unlocks = useGameStore((s) => s.lastUnlocks);
  const [index, setIndex] = useState(0);
  const count = unlocks.length;

  // New tiles pulse in the tray until they are tapped once.
  useEffect(() => {
    markFresh(unlocks);
  }, [unlocks]);

  useEffect(() => {
    if (count === 0) return;
    const t = setTimeout(() => {
      if (index + 1 < count) {
        setIndex(index + 1);
      } else {
        setIndex(0);
        useGameStore.getState().clearUnlocks();
      }
    }, SHOW_MS);
    return () => clearTimeout(t);
  }, [index, count]);

  const item = unlocks[Math.min(index, count - 1)];
  if (!item) return null;
  const { icon, name } = describe(item);
  return (
    <div
      role="status"
      key={`${item.kind}:${item.id}`}
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div className="relative flex flex-col items-center rounded-3xl border-4 border-yellow-300 bg-black/75 px-10 py-6 text-center shadow-2xl">
        {SPARKLES.map((a) => (
          <span
            key={a}
            aria-hidden="true"
            className={`absolute left-1/2 top-1/2 -ml-3 -mt-3 animate-[ps-sparkle_1.2s_ease-out_forwards] text-2xl ${a}`}
          >
            ✨
          </span>
        ))}
        <span className="text-3xl font-black tracking-wide text-yellow-300 sm:text-5xl">
          NEW!
        </span>
        <span
          aria-hidden="true"
          className="my-2 animate-[ps-grow_0.6s_ease-out_both] text-7xl sm:text-8xl"
        >
          {icon}
        </span>
        <span className="text-xl font-bold text-white sm:text-3xl">{name}</span>
      </div>
    </div>
  );
}
