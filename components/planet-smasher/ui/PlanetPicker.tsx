"use client";

import { useState } from "react";
import {
  PLANETS,
  PLANET_ORDER,
  type PlanetId,
} from "@/lib/planet-smasher/planets";
import { useGameStore } from "@/lib/planet-smasher/store";
import { UNLOCK_PATH, isUnlocked } from "@/lib/planet-smasher/unlocks";
import { loadPlanetTextures } from "../scene/planetTextures";
import { formatInt } from "./format";

const costOf = (id: PlanetId): number | null =>
  UNLOCK_PATH.find((e) => e.item.kind === "planet" && e.item.id === id)?.at ??
  null;

/** Top-left button that opens a row of planets to wreck. */
export default function PlanetPicker() {
  const planetId = useGameStore((s) => s.progress.planetId);
  const points = useGameStore((s) => s.progress.points);
  const [open, setOpen] = useState(false);
  const [shaking, setShaking] = useState<PlanetId | null>(null);

  const choose = (id: PlanetId) => {
    if (!isUnlocked({ kind: "planet", id }, points)) {
      setShaking(id);
      setTimeout(() => setShaking(null), 450);
      return;
    }
    setOpen(false);
    if (id === planetId) return;
    loadPlanetTextures(id)
      .then((t) => useGameStore.getState().selectPlanet(id, t.population))
      .catch(() => {});
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Choose a planet"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/40 bg-black/55 text-3xl active:scale-95"
      >
        <span aria-hidden="true">{PLANETS[planetId].icon}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 flex gap-2 rounded-3xl bg-black/70 p-2">
          {PLANET_ORDER.map((id) => {
            const planet = PLANETS[id];
            const locked = !isUnlocked({ kind: "planet", id }, points);
            const cost = costOf(id);
            return (
              <button
                key={id}
                type="button"
                aria-label={planet.name}
                aria-disabled={locked || undefined}
                onClick={() => choose(id)}
                className={`relative flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-2 text-3xl ${
                  id === planetId
                    ? "border-yellow-300 bg-slate-700"
                    : "border-white/25 bg-slate-800/90"
                } ${locked ? "opacity-60" : ""} ${
                  shaking === id ? "animate-[ps-shake_0.4s_ease-in-out]" : ""
                }`}
              >
                <span aria-hidden="true" className={locked ? "grayscale" : ""}>
                  {planet.icon}
                </span>
                {locked && cost !== null && (
                  <span className="absolute -bottom-1 rounded-full bg-black/80 px-1 text-[11px] font-bold leading-4 text-yellow-200">
                    ⭐ {formatInt(cost)}
                  </span>
                )}
                {locked && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1 -top-1 text-base leading-none"
                  >
                    🔒
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
