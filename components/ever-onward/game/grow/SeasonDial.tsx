"use client";

import {
  SEASONS,
  seasonBoost,
  seasonOf,
  seasonSecondsLeft,
  type Season,
} from "@/lib/ever-onward/universes/grow/seasons";
import type { PanelProps } from "../../universes/types";
import { pixelClass } from "../retro/retroStyles";

const NAMES: Record<Season, string> = {
  spring: "Spring",
  summer: "Summer",
  autumn: "Autumn",
  winter: "Winter",
};

const PIPS: Record<Season, string> = {
  spring: "bg-pink-300",
  summer: "bg-yellow-300",
  autumn: "bg-orange-400",
  winter: "bg-sky-200",
};

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** What the season helps, in plain words. */
function boostLine(season: Season, run: PanelProps["run"]): string {
  const plant = seasonBoost(run, "plant");
  const grow = seasonBoost(run, "grow");
  const harvest = seasonBoost(run, "harvest");
  if (season === "winter")
    return "A resting season. Nothing is lost, and spring is next.";
  const best = Math.max(plant, grow, harvest);
  if (best === harvest) return "Picking by hand pays double.";
  if (best === grow) return "Sprinklers and bees work half again as hard.";
  return "Every tap plants half as many seeds again.";
}

/** The year as a dial: where the garden is in it, and what that helps. */
export default function SeasonDial({ run }: PanelProps) {
  if (run.phase !== 0 || run.complete) return null;
  const season = seasonOf(run);
  const next = SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length];
  return (
    <section
      aria-label="The season"
      data-testid="lm-season"
      data-season={season}
      className="space-y-2 border-4 border-lime-300/70 bg-slate-950/85 p-3 shadow-[4px_4px_0_#365314]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${pixelClass} text-[10px] text-lime-200`}>
          {NAMES[season]}
        </h2>
        <p className={`${pixelClass} text-[8px] text-lime-100/80`}>
          {NAMES[next]} in {clock(seasonSecondsLeft(run))}
        </p>
      </header>
      <ul className="flex gap-1" aria-hidden="true">
        {SEASONS.map((s) => (
          <li
            key={s}
            className={`h-2 flex-1 ${PIPS[s]} ${s === season ? "opacity-100" : "opacity-30"}`}
          />
        ))}
      </ul>
      <p className="text-xs text-lime-50 sm:text-sm">
        {boostLine(season, run)}
      </p>
    </section>
  );
}
