import { formatNumber } from "../../engine/format";
import type { RunState, UpgradeDef } from "../../engine/types";
import { PHASE_FARM, PHASE_SEED, PHASE_WORLD, PHASE_YARD } from "./resources";
import { incomePerSecond, manualPerTap, pickPerSecond } from "./tick";
import { waterCapacity } from "./water";

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

function ratePreview(
  run: RunState,
  id: string,
  label: string,
  rate: (run: RunState) => number
): string {
  const after: RunState = {
    ...run,
    owned: { ...run.owned, [id]: owned(run, id) + 1 },
  };
  return `${label} ${num(rate(run))} -> ${num(rate(after))}`;
}

const helperPreview = (run: RunState, id: string): string =>
  ratePreview(run, id, "Per second", incomePerSecond);

export const UPGRADES: readonly UpgradeDef[] = [
  // The Backyard
  {
    id: "sprinkler",
    name: "A little sprinkler",
    description:
      "It waters the seed all by itself, and the garden ripens a little faster.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 15,
    costGrowth: 1.4,
    maxLevel: 8,
    effectPreview: (run) =>
      ratePreview(run, "sprinkler", "Ripens/sec", incomePerSecond),
  },
  {
    id: "basket",
    name: "A picking basket",
    description:
      "It gathers ripe produce into seeds while you do other things. Picking by hand in autumn still pays more.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 60,
    costGrowth: 1.4,
    maxLevel: 8,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "sprinkler") >= 2,
    effectPreview: (run) =>
      ratePreview(run, "basket", "Picks/sec", pickPerSecond),
  },
  {
    id: "mulch",
    name: "A blanket of mulch",
    description: "The soil stays damp, so every drop goes further.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 120,
    costGrowth: 2.2,
    maxLevel: 6,
    visibleWhen: (run) => owned(run, "sprinkler") >= 3,
    effectPreview: (run) => scalePreview(run, "mulch"),
  },
  {
    id: "rain-barrel",
    name: "A rain barrel",
    description:
      "It catches the rain and keeps it for a dry spell, so the garden never gets thirsty.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 90,
    costGrowth: 1.9,
    maxLevel: 4,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "sprinkler") >= 3,
    effectPreview: (run) =>
      `Holds ${num(waterCapacity(run))} -> ${num(
        waterCapacity({
          ...run,
          owned: { ...run.owned, "rain-barrel": owned(run, "rain-barrel") + 1 },
        })
      )}`,
  },
  {
    id: "bee-hive",
    name: "A bee hive",
    description:
      "The bees visit every flower, so things ripen three times as fast as a sprinkler manages.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 700,
    costGrowth: 1.45,
    maxLevel: 8,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "sprinkler") >= 5,
    effectPreview: (run) =>
      ratePreview(run, "bee-hive", "Ripens/sec", incomePerSecond),
  },
  {
    id: "garden-hose",
    name: "A long garden hose",
    description:
      "It reaches the big water butt by the shed, so there is a lot more to drink from.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 600,
    costGrowth: 2.3,
    maxLevel: 3,
    visibleWhen: (run) => owned(run, "rain-barrel") >= 1,
    effectPreview: (run) =>
      `Holds ${num(waterCapacity(run))} -> ${num(
        waterCapacity({
          ...run,
          owned: { ...run.owned, "garden-hose": owned(run, "garden-hose") + 1 },
        })
      )}`,
  },
  {
    id: "gardener",
    name: "A gardener bot",
    description:
      "A tidy little robot that picks the ripe produce, row after row.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 4500,
    costGrowth: 1.45,
    maxLevel: 8,
    visibleWhen: (run) => owned(run, "basket") >= 4,
    effectPreview: (run) =>
      ratePreview(run, "gardener", "Picks/sec", pickPerSecond),
  },
  {
    id: "compost-tea",
    name: "Compost tea",
    description: "A bucket of something brown and bubbly. The plants adore it.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 3000,
    costGrowth: 2.5,
    maxLevel: 4,
    visibleWhen: (run) => owned(run, "bee-hive") >= 3,
    effectPreview: (run) =>
      ratePreview(run, "compost-tea", "Ripens/sec", incomePerSecond),
  },
  {
    id: "wheelbarrow",
    name: "A squeaky wheelbarrow",
    description: "Every picker can carry a bigger load to the shed.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 6000,
    costGrowth: 2.5,
    maxLevel: 4,
    visibleWhen: (run) => owned(run, "gardener") >= 2,
    effectPreview: (run) =>
      ratePreview(run, "wheelbarrow", "Picks/sec", pickPerSecond),
  },
  {
    id: "greenhouse",
    name: "A glass greenhouse",
    description:
      "Warm glass, damp air and tomatoes in the middle of winter. Everything ripens half again as fast.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 25000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "gardener") >= 4,
    effectPreview: (run) =>
      ratePreview(run, "greenhouse", "Ripens/sec", incomePerSecond),
  },
  {
    id: "orchard",
    name: "A little orchard",
    description:
      "Apple, pear and one very optimistic fig. Slow to start, and then everything ripens a quarter faster.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 60000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "greenhouse") >= 1,
    effectPreview: (run) =>
      ratePreview(run, "orchard", "Ripens/sec", incomePerSecond),
  },
  {
    id: "honey-stand",
    name: "A honey stand",
    description:
      "A wobbly table by the gate. Whatever you pick by hand sells for a quarter more, with a jar of honey on top.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 120000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "orchard") >= 1,
  },
  {
    id: "cold-frame",
    name: "A cold frame",
    description:
      "A little glass house. The seed becomes a row, and the row becomes a farm.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 250000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "orchard") >= 1,
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
