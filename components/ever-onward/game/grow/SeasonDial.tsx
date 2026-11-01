"use client";

import {
  SEASONS,
  seasonBoost,
  seasonOf,
  seasonSecondsLeft,
  type Season,
} from "@/lib/ever-onward/universes/grow/seasons";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";

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
  if (best === harvest) return "Picking by hand pays extra.";
  if (best === grow) return "Sprinklers and bees work extra hard.";
  return "Every tap plants extra seeds.";
}

/** The year as a dial: where the garden is in it, and what that helps. */
export default function SeasonDial({ run }: PanelProps) {
  if (run.phase !== 0 || run.complete) return null;
  const season = seasonOf(run);
  const next = SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length];
  return (
    <PanelFrame
      label="The season"
      title={NAMES[season]}
      tone="lime"
      status={`${NAMES[next]} in ${clock(seasonSecondsLeft(run))}`}
      statusActive={false}
      testId="lm-season"
      data={{ "data-season": season }}
    >
      <ul className="flex gap-1" aria-hidden="true">
        {SEASONS.map((s) => (
          <li
            key={s}
            className={`h-2 flex-1 ${PIPS[s]} ${s === season ? "opacity-100" : "opacity-30"}`}
          />
        ))}
      </ul>
      <p className="font-mono text-sm text-slate-200">
        {boostLine(season, run)}
      </p>
    </PanelFrame>
  );
}
