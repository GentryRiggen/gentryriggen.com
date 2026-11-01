import type { RunState, UpgradeDef } from "../../engine/types";
import { PHASE_COAST, PHASE_NIGHT, PHASE_SKY } from "./resources";
import { syncDisplay } from "./tick";
import { TUNING } from "./tuning";

const { boons: B } = TUNING;

/** Seconds spent in the current phase. */
export const phaseElapsed = (run: RunState): number =>
  run.time - (run.transitions.at(-1)?.at ?? 0);

interface BoonPhase {
  phase: string;
  currency: string;
  baseCost: number;
  costGrowth: number;
  names: readonly string[];
}

const BOON_PHASES: readonly BoonPhase[] = [
  {
    phase: PHASE_COAST,
    currency: "coins",
    baseCost: B.coast.baseCost,
    costGrowth: B.coast.costGrowth,
    names: [
      "A fresh coat of white paint",
      "A brass handrail for the stairs",
      "Mend the keeper's boots",
      "A weather vane on the roof",
      "Oil the lamp's gears",
      "A bell for foggy nights",
      "Sweep the salt off the glass",
      "A spare lantern in the cupboard",
      "A telescope for the gallery",
      "New rope for the dinghy",
      "A kettle for the night shift",
      "Chart the new rocks",
      "A logbook with more pages",
      "Tighten every shutter",
      "A cat to keep watch",
      "Polish the brass lamp ring",
      "Teach the gulls to point",
      "A very good umbrella",
      "A second pair of binoculars",
      "Whitewash for the fence",
      "A proper sea chest",
      "A cheerful flag",
    ],
  },
  {
    phase: PHASE_NIGHT,
    currency: "power",
    baseCost: B.night.baseCost,
    costGrowth: B.night.costGrowth,
    names: [
      "Label every switch",
      "Grease the turbine bearings",
      "A tidier fuse box",
      "Insulated gloves for the crew",
      "Sort out the tangled cables",
      "A cooling fan for the shed",
      "Map the whole grid",
      "A night shift roster",
      "Thicker copper wire",
      "A weather station on the roof",
      "Spare parts, in labelled drawers",
      "A hot flask for the engineers",
      "Better lightning rods",
      "A meter for every street",
      "Quieter transformers",
      "Walkie-talkies for the line crews",
      "A proper workshop bench",
      "A big red emergency button",
      "A bigger map pinboard",
      "A canteen for the crews",
      "Spare bulbs by the dozen",
      "A neat row of hard hats",
    ],
  },
  {
    phase: PHASE_SKY,
    currency: "energy",
    baseCost: B.sky.baseCost,
    costGrowth: B.sky.costGrowth,
    names: [
      "Clean the collector glass",
      "A sharper star chart",
      "A steadier gyroscope",
      "Recalibrate the sunshades",
      "A cleverer navigation chip",
      "Cooler radiators",
      "A longer radio dish",
      "Tuck in the loose cables",
      "A backup clock",
      "Lighter folding panels",
      "A map of the quiet places",
      "Fresher fuel mix",
      "A tiny, tidy tool arm",
      "Dust filters for the lenses",
      "A faster message relay",
      "Name every probe",
      "A gentle course correction",
      "One more check of everything",
      "A calmer ship computer",
      "Snug seals on every hatch",
      "A spare set of eyes",
      "Extra patience for long trips",
    ],
  },
];

/**
 * Small one-off upgrades that pop in on a timetable through each phase, so
 * there is always something new to look at, however the player is playing.
 * Each adds a little to everything that phase does (`mods.boon`).
 */
export const BOON_UPGRADES: UpgradeDef[] = BOON_PHASES.flatMap((p) =>
  p.names.map((name, i): UpgradeDef => ({
    id: `boon-${p.phase}-${i + 1}`,
    name,
    description: `A small touch. Everything here works ${Math.round(
      B.bonus * 100
    )}% better.`,
    phases: [p.phase],
    currency: p.currency,
    baseCost: p.baseCost * p.costGrowth ** i,
    costGrowth: 1,
    visibleWhen: (run) => phaseElapsed(run) >= B.firstAt + i * B.every,
    priority: 5,
    onBuy: (run) => {
      run.mods.boon = (run.mods.boon ?? 1) * (1 + B.bonus);
      syncDisplay(run);
    },
  }))
);
