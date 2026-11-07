import { ownsAtLeast } from "../../engine/goal";
import { handHarvestPays } from "./actions";
import { rateEffect } from "../../engine/purchaseFeedback";
import { formatNumber } from "../../engine/format";
import type { RunState, UpgradeDef } from "../../engine/types";
import { PUMPKIN_HAND_ID, handPaysOn, handShown, openPumpkin } from "./pumpkin";
import {
  BEE_KEEPER_ID,
  BEES_OPEN_FLAG,
  beesKept,
  openBees,
  wiltsSoFar,
} from "./bees";
import { worldCover } from "./biomes";
import { TUNING } from "./tuning";
import { beesWelcome, forkSide } from "./forks";
import { MARKET_AGENT_ID, harvestDays } from "./market";
import {
  PHASE_FARM,
  PHASE_IDS,
  PHASE_SEED,
  PHASE_WORLD,
  PHASE_YARD,
  type GrowPhaseId,
  MANUAL_RESOURCES,
  RESOURCES,
} from "./resources";
import {
  farmPayPerSecond,
  incomePerSecond,
  manualPerTap,
  pickPerSecond,
  tendingValue,
} from "./tick";
import { DRY_FLOOR, waterCapacity } from "./water";
import {
  LANTERN_ID,
  MUSIC_BOX_ID,
  WATERING_CAN_ID,
  boxPays,
  canMult,
  musicBoxShown,
  potGrowth,
  tendsSoFar,
} from "./windowbox";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** What this chapter's taps and helpers make, lowercase ("blocks"). */
const noun = (run: RunState): string =>
  (
    RESOURCES.find((r) => r.id === MANUAL_RESOURCES[run.phase])?.label ?? ""
  ).toLowerCase();
const num = (n: number): string => formatNumber(n);

/** "Per tap 2 → 3" for a scale step, read from the run as it stands. */
function scalePreview(run: RunState, id: string): string {
  const after: RunState = {
    ...run,
    owned: { ...run.owned, [id]: owned(run, id) + 1 },
  };
  return [
    rateEffect(manualPerTap(run), manualPerTap(after), `${noun(run)} per tap`),
    rateEffect(
      incomePerSecond(run),
      incomePerSecond(after),
      // In the yard the helpers ripen produce; a tap plants seeds.
      `${run.phase === 0 ? "produce" : noun(run)}/sec`
    ),
  ].join("\n");
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
  return rateEffect(rate(run), rate(after), label.toLowerCase());
}

/**
 * A water upgrade's card: the tank it grows, anything else it does, and what
 * running dry costs (the About text is folded away, so this stands alone).
 */
function tankPreview(run: RunState, id: string, extra?: string): string {
  const after: RunState = {
    ...run,
    owned: { ...run.owned, [id]: owned(run, id) + 1 },
  };
  const unit = run.phase === 0 ? "produce" : noun(run);
  return [
    `Water tank ${num(waterCapacity(run))} → ${num(waterCapacity(after))}`,
    extra,
    `Dry tank: ${Math.round((1 - DRY_FLOOR) * 100)}% less ${unit}/sec`,
  ]
    .filter(Boolean)
    .join("\n");
}

const helperPreview = (run: RunState, id: string): string =>
  ratePreview(run, id, `${noun(run)}/sec`, incomePerSecond);

const PICKERS_AT_LIMIT =
  "Your pickers are at their limit. A wheelbarrow lets them carry more.";

const RAW_UPGRADES: readonly UpgradeDef[] = [
  // The Backyard
  {
    id: "sprinkler",
    name: "A little sprinkler",
    description:
      "It waters the seed all by itself, and the garden ripens a little faster.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 15,
    costGrowth: 2.4,
    maxLevel: 6,
    effectPreview: (run) =>
      ratePreview(run, "sprinkler", "Produce/sec", incomePerSecond),
  },
  {
    id: "basket",
    badge: "NEW ABILITY",
    name: "A picking basket",
    description:
      "It gathers ripe produce into seeds while you do other things. Picking by hand in autumn still pays more.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 60,
    costGrowth: 1.6,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("sprinkler", 2),
    effectPreview: (run) =>
      ratePreview(run, "basket", "Seeds picked/sec", pickPerSecond),
    noEffectReason: () => PICKERS_AT_LIMIT,
  },
  {
    id: "mulch",
    name: "A blanket of mulch",
    description: "The soil stays damp, so every drop goes further.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 120,
    costGrowth: 2.6,
    maxLevel: 4,
    visibleWhen: ownsAtLeast("sprinkler", 3),
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
    visibleWhen: ownsAtLeast("sprinkler", 3),
    effectPreview: (run) => tankPreview(run, "rain-barrel"),
  },
  {
    id: "bee-hive",
    badge: "NEW ABILITY",
    name: "A bee hive",
    description:
      "Three bees to send to the flower beds you plant. Each bed gives something different, and each tires if the bees work it too hard.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 700,
    costGrowth: 2.4,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: (run) =>
      owned(run, "sprinkler") >= 5 && forkSide(run, "yard") === 0,
    onBuy: openBees,
    effectPreview: (run) =>
      `Bees in the garden ${beesKept(run)} → ${beesKept(run) + TUNING.pollen.beesPerHive}. ${ratePreview(run, "bee-hive", "Produce/sec", incomePerSecond)}`,
  },
  {
    id: BEE_KEEPER_ID,
    badge: "NEW ABILITY",
    name: "A bee keeper",
    description:
      "A friendly person in a veil with a smoker. Calm bees are gentle, so every flower bed tires more slowly.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 1800,
    costGrowth: 1,
    // A bonus helper, not income: bots buy the garden first.
    priority: -1,
    kind: "mechanic",
    // Once tired beds are a worry: the first wilt, or three beds planted.
    visibleWhen: (run) =>
      run.flags[BEES_OPEN_FLAG] === true &&
      (wiltsSoFar(run) >= 1 || (run.resources.pbPlants ?? 0) >= 3),
    effectPreview: () =>
      `Flower bed wear 100% → ${Math.round(TUNING.pollen.keeperWear * 100)}%`,
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
    visibleWhen: ownsAtLeast("rain-barrel", 1),
    effectPreview: (run) => tankPreview(run, "garden-hose"),
  },
  {
    id: "gardener",
    name: "A gardener bot",
    description:
      "A tidy little robot that picks some of the ripe produce, row after row.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 4500,
    costGrowth: 1.6,
    maxLevel: 6,
    visibleWhen: ownsAtLeast("basket", 4),
    effectPreview: (run) =>
      ratePreview(run, "gardener", "Seeds picked/sec", pickPerSecond),
    noEffectReason: () => PICKERS_AT_LIMIT,
  },
  {
    id: "compost-tea",
    name: "Compost tea",
    description: "A bucket of something brown and bubbly. The plants adore it.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 3000,
    costGrowth: 2.5,
    maxLevel: 3,
    visibleWhen: (run) =>
      owned(run, "bee-hive") >= 3 ||
      (forkSide(run, "yard") === 1 && owned(run, "sprinkler") >= 5),
    effectPreview: (run) =>
      ratePreview(run, "compost-tea", "Produce/sec", incomePerSecond),
  },
  {
    id: "wheelbarrow",
    name: "A squeaky wheelbarrow",
    description: "Every picker can carry a bigger load to the shed.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 6000,
    costGrowth: 2.5,
    maxLevel: 3,
    visibleWhen: ownsAtLeast("gardener", 2),
    effectPreview: (run) =>
      ratePreview(run, "wheelbarrow", "Seeds picked/sec", pickPerSecond),
  },
  {
    id: "greenhouse",
    name: "A glass greenhouse",
    description:
      "Warm glass, damp air and tomatoes in the middle of winter. Everything ripens twice as fast.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 25000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("gardener", 4),
    effectPreview: (run) =>
      ratePreview(run, "greenhouse", "Produce/sec", incomePerSecond),
  },
  {
    id: "orchard",
    name: "A little orchard",
    description:
      "Apple, pear and one very optimistic fig. Slow to start, and then everything ripens over half again as fast.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 60000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("greenhouse", 1),
    effectPreview: (run) =>
      ratePreview(run, "orchard", "Produce/sec", incomePerSecond),
  },
  {
    id: "honey-stand",
    effectPreview: (run) => {
      if ((run.resources.produce ?? 0) <= 0)
        return `Hand-picked produce pays ${TUNING.yard.honey}×`;
      return ratePreview(
        run,
        "honey-stand",
        "seeds per hand harvest",
        handHarvestPays
      );
    },
    name: "A honey stand",
    description:
      "A wobbly table by the gate. Whatever you pick by hand sells for half again as much, with a jar of honey on top.",
    phases: [PHASE_YARD],
    currency: "seeds",
    baseCost: 120000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: (run) => owned(run, "orchard") >= 1 && beesWelcome(run),
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
    visibleWhen: ownsAtLeast("orchard", 1),
  },
  // The Farm
  {
    id: "scarecrow",
    name: "A friendly scarecrow",
    description: "He minds the rows while you rest, and he never gets bored.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 400,
    costGrowth: 2.4,
    maxLevel: 6,
    effectPreview: (run) => helperPreview(run, "scarecrow"),
  },
  {
    id: "compost",
    name: "A warm compost heap",
    description: "Yesterday's peelings feed tomorrow's crops.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 1800,
    costGrowth: 2.6,
    maxLevel: 4,
    visibleWhen: ownsAtLeast("scarecrow", 2),
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
    visibleWhen: ownsAtLeast("scarecrow", 2),
    effectPreview: (run) =>
      tankPreview(run, "well", "Seeps in water, rain or not"),
  },
  {
    id: "tractor",
    badge: "NEW ABILITY",
    name: "A green tractor",
    description:
      "Putt, putt, putt. It does a whole row in the time a person does a plant.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 3000,
    costGrowth: 2.4,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("scarecrow", 3),
    onBuy: openPumpkin,
    effectPreview: (run) => helperPreview(run, "tractor"),
  },
  {
    id: PUMPKIN_HAND_ID,
    badge: "NEW ABILITY",
    name: "A fair helper",
    description:
      "A cheerful neighbour in a straw hat who carries your prize pumpkin to the county fair if you forget to. Your own entry still pays more.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 45000,
    costGrowth: 1,
    // A bonus helper, not income: bots buy the farm first.
    priority: -1,
    kind: "mechanic",
    // Halfway along: once a few harvest days have gone by.
    visibleWhen: handShown,
    effectPreview: (run) =>
      `Enters a grown pumpkin for you on a day you did not: about ${num(Math.floor(handPaysOn(run, farmPayPerSecond(run))))} harvest (harvest days so far: ${harvestDays(run)})`,
  },
  {
    id: MARKET_AGENT_ID,
    badge: "NEW ABILITY",
    name: "A market agent",
    description:
      "A friendly person with a clipboard who reads the forecast and plants what looks likeliest, a little way into every harvest day. He never rests the soil. You will always choose better, because you are looking.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 90000,
    costGrowth: 1,
    // A bonus helper, not income: bots buy the farm first.
    priority: -1,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("tractor", 3),
    effectPreview: () =>
      `Plants the likeliest crop ${TUNING.market.agentAt} seconds into every harvest day`,
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
    visibleWhen: ownsAtLeast("well", 2),
    effectPreview: (run) =>
      tankPreview(run, "irrigation", "Catches more of the rain"),
  },
  {
    id: "silo",
    name: "A tall grain silo",
    description:
      "Somewhere dry to keep everything, so nothing is wasted and every load goes further.",
    phases: [PHASE_FARM],
    currency: "harvest",
    baseCost: 120000,
    costGrowth: 2.6,
    maxLevel: 3,
    visibleWhen: ownsAtLeast("tractor", 6),
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
    costGrowth: 2.4,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("tractor", 4),
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
    costGrowth: 2.4,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("glasshouse", 3),
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
    visibleWhen: ownsAtLeast("seed-drone", 2),
  },
  // The Whole World
  {
    id: "windbreak",
    name: "A row of windbreak trees",
    description: "They hold the soil and shelter the fields behind them.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 3000,
    costGrowth: 2.4,
    maxLevel: 8,
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
    costGrowth: 2.6,
    maxLevel: 4,
    visibleWhen: ownsAtLeast("windbreak", 2),
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
    visibleWhen: ownsAtLeast("windbreak", 2),
    effectPreview: (run) =>
      tankPreview(run, "river-bend", "Seeps in water, rain or not"),
  },
  {
    id: "planting-rover",
    name: "A planting rover",
    description:
      "A six-wheeled rover that plants a tree, shuffles forward and plants another, all day and all night.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 30000,
    costGrowth: 2.4,
    maxLevel: 8,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("windbreak", 3),
    effectPreview: (run) => helperPreview(run, "planting-rover"),
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
    visibleWhen: ownsAtLeast("river-bend", 2),
    effectPreview: (run) =>
      `Rain into the tank ${num(Math.round((1 + TUNING.world.water.cloudRain * owned(run, "cloud-seeder")) * 100))}% → ${num(Math.round((1 + TUNING.world.water.cloudRain * (owned(run, "cloud-seeder") + 1)) * 100))}%`,
  },
  {
    id: "sky-seeder",
    name: "A sky seeder",
    description:
      "It drifts over the oceans and the deserts, scattering seed like slow snow. The biomes spread faster, too.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 1200000,
    costGrowth: 2.4,
    maxLevel: 8,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("planting-rover", 3),
    effectPreview: (run) => helperPreview(run, "sky-seeder"),
  },
  {
    id: "seed-vault",
    name: "A seed vault",
    description: "One seed, saved from everything, kept safe for later.",
    phases: [PHASE_WORLD],
    currency: "green",
    baseCost: 80000000,
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
    baseCost: 12,
    costGrowth: 2.4,
    maxLevel: 6,
    kind: "mechanic",
    effectPreview: (run) => helperPreview(run, "trellis"),
  },
  {
    id: "sunny-sill",
    name: "A sunny windowsill",
    description: "Warm light on the leaves makes every bit of care count.",
    phases: [PHASE_SEED],
    currency: "care",
    baseCost: 70,
    costGrowth: 2.8,
    maxLevel: 4,
    visibleWhen: ownsAtLeast("trellis", 2),
    effectPreview: (run) => scalePreview(run, "sunny-sill"),
  },
  {
    id: "wind-chime",
    name: "A little wind chime",
    description:
      "It tinkles in the draft from the window, and the pot sways along.",
    phases: [PHASE_SEED],
    currency: "care",
    baseCost: 120,
    costGrowth: 2.4,
    maxLevel: 6,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("trellis", 2),
    effectPreview: (run) => helperPreview(run, "wind-chime"),
  },
  {
    id: "dew-collector",
    name: "A dew collector",
    description:
      "A tiny dish that catches the morning dew and drips it on the soil, one drop at a time.",
    phases: [PHASE_SEED],
    currency: "care",
    baseCost: 2000,
    costGrowth: 2.4,
    maxLevel: 8,
    kind: "mechanic",
    visibleWhen: ownsAtLeast("wind-chime", 1),
    effectPreview: (run) => helperPreview(run, "dew-collector"),
  },
  {
    id: WATERING_CAN_ID,
    name: "A bigger watering can",
    description:
      "A little tin can with a long spout. Every answer you give the pot is worth half as much again.",
    phases: [PHASE_SEED],
    currency: "care",
    baseCost: 24,
    costGrowth: 2.2,
    maxLevel: 5,
    kind: "mechanic",
    visibleWhen: (run) => tendsSoFar(run) >= 1,
    effectPreview: (run) =>
      `Care per answer ${num(Math.round(canMult(run) * 100))}% → ${num(
        Math.round(
          canMult({
            ...run,
            owned: {
              ...run.owned,
              [WATERING_CAN_ID]: owned(run, WATERING_CAN_ID) + 1,
            },
          }) * 100
        )
      )}%`,
  },
  {
    id: MUSIC_BOX_ID,
    badge: "NEW ABILITY",
    name: "A little music box",
    description:
      "It plays the pot a soft tune when you are busy. Your own answer still grows it more.",
    phases: [PHASE_SEED],
    currency: "care",
    baseCost: 120,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: musicBoxShown,
    effectPreview: (run) =>
      `Answers a waiting pot for you after a pause: about ${num(Math.floor(boxPays(run, tendingValue(run))))} care (answers so far: ${tendsSoFar(run)})`,
  },
  {
    id: LANTERN_ID,
    name: "A lantern in the window",
    description:
      "A small warm light for the evenings, in case anybody is passing. The pot grows twice as much from every bit of care.",
    phases: [PHASE_SEED],
    currency: "care",
    baseCost: 30000,
    costGrowth: 1,
    kind: "mechanic",
    visibleWhen: (run) =>
      potGrowth(run) >= 0.1 || owned(run, "wind-chime") >= 2,
    effectPreview: () => "Every bit of care grows the pot twice as much",
  },
];

/**
 * Every price in a phase, scaled together: the pacing knob (see TUNING).
 * Repeatable upgrades also climb a little steeper in a phase that needs it,
 * so the first steps stay cheap and the last ones are earned.
 */
const CHAPTER_EFFECTS: Readonly<Record<string, string>> = {
  "cold-frame": "Finish the garden and open The Farm",
  "grain-barn": "Finish the harvest and open The Whole World",
  "seed-vault": "Save a seed and open The Old Window Box",
};

export const UPGRADES: readonly UpgradeDef[] = RAW_UPGRADES.map((u) => {
  const phase = Math.max(
    0,
    PHASE_IDS.indexOf((u.phases?.[0] ?? PHASE_YARD) as GrowPhaseId)
  );
  return {
    ...u,
    badge: CHAPTER_EFFECTS[u.id]
      ? u.id === "set-down"
        ? "LAST STEP"
        : "NEXT CHAPTER"
      : u.badge,
    effectPreview:
      u.effectPreview ??
      (CHAPTER_EFFECTS[u.id] ? () => CHAPTER_EFFECTS[u.id] : undefined),
    baseCost: u.baseCost * TUNING.costScale[phase],
    costGrowth:
      u.costGrowth > 1 ? u.costGrowth * TUNING.costSteepness[phase] : 1,
  };
});
