import { formatNumber } from "../../engine/format";
import type { RunState, UpgradeDef } from "../../engine/types";
import {
  FAIR_HAND_ID,
  fairsSoFar,
  handPaysOn,
  handShown,
  openFair,
} from "./fair";
import {
  BEE_KEEPER_ID,
  BEES_OPEN_FLAG,
  dancesSoFar,
  keeperPays,
  keeperShown,
  openBees,
} from "./bees";
import { worldCover } from "./biomes";
import {
  FLOCK_LEADER_ID,
  flightsSoFar,
  leaderPaysOn,
  leaderShown,
  openMigration,
} from "./migration";
import { TUNING } from "./tuning";
import { MARKET_AGENT_ID } from "./market";
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
      "It catches the rain and keeps it for a dry spell, so the garden gets thirsty less often.",
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
    onBuy: openBees,
    effectPreview: (run) =>
      ratePreview(run, "bee-hive", "Ripens/sec", incomePerSecond),
  },
  {
    id: BEE_KEEPER_ID,
    name: "A bee keeper",
    description:
      "A friendly person in a veil who reads the dance when you are busy. Your own follow still pays more.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 1800,
    costGrowth: 1,
    // A bonus helper, not income: bots buy the garden first.
    priority: -1,
    kind: "mechanic",
    // Halfway through the dances' life: after the bees have danced twice.
    visibleWhen: (run) =>
      run.flags[BEES_OPEN_FLAG] === true && keeperShown(run),
    effectPreview: (run) =>
      `Follows after a wait: about ${num(Math.floor(keeperPays(run, incomePerSecond(run))))} seeds (${dancesSoFar(run)} dances so far)`,
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
      "A tidy little robot that picks some of the ripe produce, row after row.",
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
    baseCost: 400,
    costGrowth: 1.32,
    maxLevel: 8,
    effectPreview: (run) => helperPreview(run, "scarecrow"),
  },
  {
    id: "compost",
    name: "A warm compost heap",
    description: "Yesterday's peelings feed tomorrow's crops.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 1800,
    costGrowth: 2.4,
    maxLevel: 6,
    visibleWhen: (run) => owned(run, "scarecrow") >= 2,
    effectPreview: (run) => scalePreview(run, "compost"),
  },
  {
    id: "well",
    name: "A deep well",
    description:
      "Cool water from far below the field, rain or no rain. The crops never have to go thirsty.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 1200,
    costGrowth: 1.9,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "scarecrow") >= 2,
    effectPreview: (run) =>
      `Holds ${num(waterCapacity(run))} -> ${num(
        waterCapacity({
          ...run,
          owned: { ...run.owned, well: owned(run, "well") + 1 },
        })
      )}, and it seeps`,
  },
  {
    id: "tractor",
    name: "A green tractor",
    description:
      "Putt, putt, putt. It does a whole row in the time a person does a plant.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 3000,
    costGrowth: 1.3,
    maxLevel: 8,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "scarecrow") >= 3,
    onBuy: openFair,
    effectPreview: (run) => helperPreview(run, "tractor"),
  },
  {
    id: FAIR_HAND_ID,
    name: "A fair helper",
    description:
      "A cheerful neighbour in a straw hat who carries a pumpkin to the county fair when you are busy. Your own pick still pays more.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 45000,
    costGrowth: 1,
    // A bonus helper, not income: bots buy the farm first.
    priority: -1,
    kind: "mechanic",
    // Halfway along: once the first fair has been judged.
    visibleWhen: handShown,
    effectPreview: (run) =>
      `Enters the likeliest pumpkin after a wait: about ${num(Math.floor(handPaysOn(run, incomePerSecond(run))))} harvest (${fairsSoFar(run)} fairs so far)`,
  },
  {
    id: MARKET_AGENT_ID,
    name: "A market agent",
    description:
      "A friendly person with a clipboard who asks the towns what they want, and plants it now and then. You will always choose better, because you are looking.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 90000,
    costGrowth: 1,
    // A bonus helper, not income: bots buy the farm first.
    priority: -1,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "tractor") >= 3,
    effectPreview: () => "Re-plants for demand every minute and a half",
  },
  {
    id: "irrigation",
    name: "Irrigation channels",
    description:
      "Little ditches carry every drop of rain to the rows, and hold a lot in reserve.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 30000,
    costGrowth: 2.2,
    maxLevel: 4,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "well") >= 2,
    effectPreview: (run) =>
      `Holds ${num(waterCapacity(run))} -> ${num(
        waterCapacity({
          ...run,
          owned: { ...run.owned, irrigation: owned(run, "irrigation") + 1 },
        })
      )}, and catches more rain`,
  },
  {
    id: "silo",
    name: "A tall grain silo",
    description:
      "Somewhere dry to keep everything, so nothing is wasted and every load goes further.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 120000,
    costGrowth: 2.4,
    maxLevel: 4,
    visibleWhen: (run) => owned(run, "tractor") >= 6,
    effectPreview: (run) => scalePreview(run, "silo"),
  },
  {
    id: "glasshouse",
    name: "A big glasshouse",
    description:
      "Rows and rows of glass, warm all year. Tomatoes in winter, and everyone on the road stops to look.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 70000,
    costGrowth: 1.3,
    maxLevel: 8,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "tractor") >= 4,
    effectPreview: (run) => helperPreview(run, "glasshouse"),
  },
  {
    id: "seed-drone",
    name: "A seed drone",
    description:
      "It hums over the county and drops seeds exactly where the soil wants them.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 600000,
    costGrowth: 1.3,
    maxLevel: 8,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "glasshouse") >= 3,
    effectPreview: (run) => helperPreview(run, "seed-drone"),
  },
  {
    id: "grain-barn",
    name: "A big red barn",
    description:
      "Room for the whole harvest, and for starting something larger.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 6000000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "seed-drone") >= 2,
  },
  // The Whole World
  {
    id: "windbreak",
    name: "A row of windbreak trees",
    description: "They hold the soil and shelter the fields behind them.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 1500,
    costGrowth: 1.35,
    maxLevel: 10,
    kind: "mechanic",
    effectPreview: (run) => helperPreview(run, "windbreak"),
  },
  {
    id: "rain-makers",
    name: "Gentle rain makers",
    description:
      "Clouds learn to rain where a planting needs it most, so every green thing takes better.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 25000,
    costGrowth: 2.3,
    maxLevel: 6,
    visibleWhen: (run) => owned(run, "windbreak") >= 2,
    effectPreview: (run) => scalePreview(run, "rain-makers"),
  },
  {
    id: "river-bend",
    name: "A river bend",
    description:
      "A river curls through the dry middle of the map and keeps the land drinking, rain or no rain.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 15000,
    costGrowth: 1.9,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "windbreak") >= 2,
    effectPreview: (run) =>
      `Holds ${num(waterCapacity(run))} -> ${num(
        waterCapacity({
          ...run,
          owned: { ...run.owned, "river-bend": owned(run, "river-bend") + 1 },
        })
      )}, and it seeps`,
  },
  {
    id: "planting-rover",
    name: "A planting rover",
    description:
      "A six-wheeled rover that plants a tree, shuffles forward and plants another, all day and all night.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 60000,
    costGrowth: 1.4,
    maxLevel: 10,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "windbreak") >= 3,
    onBuy: openMigration,
    effectPreview: (run) => helperPreview(run, "planting-rover"),
  },
  {
    id: FLOCK_LEADER_ID,
    name: "A flock leader",
    description:
      "A wise old goose who leads a waiting flock to the greenest place she knows when you are busy. Your own choice still grows more.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 900000,
    costGrowth: 1,
    // A bonus helper, not income: bots buy the world first.
    priority: -1,
    kind: "mechanic",
    // Halfway along: once a couple of flights have landed.
    visibleWhen: leaderShown,
    effectPreview: (run) =>
      `Sends a waiting flock to the most welcoming place: about ${num(Math.floor(leaderPaysOn(run, incomePerSecond(run))))} green (${flightsSoFar(run)} flights so far)`,
  },
  {
    id: "cloud-seeder",
    name: "A cloud seeder",
    description:
      "A friendly little plane that coaxes clouds into raining over the thirsty places.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 300000,
    costGrowth: 2.2,
    maxLevel: 4,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "river-bend") >= 2,
    effectPreview: (run) =>
      `Rain ${num(Math.round((1 + TUNING.world.water.cloudRain * owned(run, "cloud-seeder")) * 100))}% -> ${num(Math.round((1 + TUNING.world.water.cloudRain * (owned(run, "cloud-seeder") + 1)) * 100))}%`,
  },
  {
    id: "sky-seeder",
    name: "A sky seeder",
    description:
      "It drifts over the oceans and the deserts, scattering seed like slow snow. The biomes spread faster, too.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 1200000,
    costGrowth: 1.4,
    maxLevel: 10,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "planting-rover") >= 3,
    effectPreview: (run) => helperPreview(run, "sky-seeder"),
  },
  {
    id: "seed-vault",
    name: "A seed vault",
    description: "One seed, saved from everything, kept safe for later.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 120000000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: (run) =>
      owned(run, "sky-seeder") >= 2 &&
      worldCover(run) >= TUNING.world.vaultCover,
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
