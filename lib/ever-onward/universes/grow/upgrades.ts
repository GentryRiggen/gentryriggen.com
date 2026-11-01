import { formatNumber } from "../../engine/format";
import type { RunState, UpgradeDef } from "../../engine/types";
import { PHASE_FARM, PHASE_SEED, PHASE_WORLD, PHASE_YARD } from "./resources";
import { incomePerSecond, manualPerTap } from "./tick";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const num = (n: number): string => formatNumber(n);

/** "Per tap 2 -> 3" for a scale step, read from the run as it stands. */
function scalePreview(run: RunState, id: string): string {
  const after: RunState = {
    ...run,
    owned: { ...run.owned, [id]: owned(run, id) + 1 },
  };
  return `Per tap ${num(manualPerTap(run))} -> ${num(manualPerTap(after))}`;
}

function helperPreview(run: RunState, id: string): string {
  const after: RunState = {
    ...run,
    owned: { ...run.owned, [id]: owned(run, id) + 1 },
  };
  return `Per second ${num(incomePerSecond(run))} -> ${num(incomePerSecond(after))}`;
}

export const UPGRADES: readonly UpgradeDef[] = [
  // The Backyard
  {
    id: "sprinkler",
    name: "A little sprinkler",
    description: "It waters the seed all by itself, a drop at a time.",
    phases: [PHASE_YARD],
    currency: "water",
    baseCost: 12,
    costGrowth: 1.18,
    maxLevel: 40,
    kind: "mechanic",
    effectPreview: (run) => helperPreview(run, "sprinkler"),
  },
  {
    id: "mulch",
    name: "A blanket of mulch",
    description: "The soil stays damp, so every drop goes further.",
    phases: [PHASE_YARD],
    currency: "water",
    baseCost: 80,
    costGrowth: 2.2,
    maxLevel: 6,
    effectPreview: (run) => scalePreview(run, "mulch"),
  },
  {
    id: "cold-frame",
    name: "A cold frame",
    description:
      "A little glass house. The seed becomes a row, and the row becomes a farm.",
    phases: [PHASE_YARD],
    currency: "water",
    baseCost: 900,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "sprinkler") >= 3,
  },
  // The Farm
  {
    id: "scarecrow",
    name: "A friendly scarecrow",
    description: "He minds the rows while you rest, and he never gets bored.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 100,
    costGrowth: 1.18,
    maxLevel: 40,
    kind: "mechanic",
    effectPreview: (run) => helperPreview(run, "scarecrow"),
  },
  {
    id: "compost",
    name: "A warm compost heap",
    description: "Yesterday's peelings feed tomorrow's crops.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 700,
    costGrowth: 2.2,
    maxLevel: 6,
    effectPreview: (run) => scalePreview(run, "compost"),
  },
  {
    id: "grain-barn",
    name: "A big red barn",
    description:
      "Room for the whole harvest, and for starting something larger.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 9000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "scarecrow") >= 3,
  },
  // The Whole World
  {
    id: "windbreak",
    name: "A row of windbreak trees",
    description: "They hold the soil and shelter the fields behind them.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 800,
    costGrowth: 1.18,
    maxLevel: 40,
    kind: "mechanic",
    effectPreview: (run) => helperPreview(run, "windbreak"),
  },
  {
    id: "rain-makers",
    name: "Gentle rain makers",
    description: "Clouds learn to rain where it is needed most.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 6000,
    costGrowth: 2.2,
    maxLevel: 6,
    effectPreview: (run) => scalePreview(run, "rain-makers"),
  },
  {
    id: "seed-vault",
    name: "A seed vault",
    description: "One seed, saved from everything, kept safe for later.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 70000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "windbreak") >= 3,
  },
  // One Small Seed
  {
    id: "trellis",
    name: "A small trellis",
    description: "Something to climb. The pot grows a little every second.",
    phases: [PHASE_SEED],
    currency: "care",
    baseCost: 6,
    costGrowth: 1.2,
    maxLevel: 30,
    kind: "mechanic",
    effectPreview: (run) => helperPreview(run, "trellis"),
  },
  {
    id: "sunny-sill",
    name: "A sunny windowsill",
    description: "Warm light on the leaves makes every bit of care count.",
    phases: [PHASE_SEED],
    currency: "care",
    baseCost: 30,
    costGrowth: 2,
    maxLevel: 6,
    effectPreview: (run) => scalePreview(run, "sunny-sill"),
  },
];
