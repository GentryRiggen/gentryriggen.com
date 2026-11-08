import type { RunState, UpgradeDef } from "../../engine/types";
import {
  COAST_LIGHTHOUSES,
  PHASE_COAST,
  PHASE_LAST,
  PHASE_NIGHT,
  PHASE_SKY,
} from "./resources";
import { COSTS } from "./costs";
import { TUNING } from "./tuning";
import { plainOf, previewOf, short, times, type Stat } from "./preview";
import {
  appetite,
  autoCoinsPerSecond,
  collectorEnergyPerSecond,
  copySpeed,
  crankPower,
  flameFraction,
  flameOf,
  lastTapResolve,
  steadyFlame,
  LET_GO_GIFTS,
  type LetGoGift,
  demandMW,
  starBounty,
  fare,
  idleBurn,
  lensShips,
  lighthouseCount,
  nextKeeperMilestone,
  trainingMult,
  stormPassive,
  supplyMW,
  syncDisplay,
  tankCapacity,
  travelSeconds,
  powerPerSecond,
  aimEnergy,
} from "./tick";
import { RAIN_BARREL_ID, picksSoFar, restingPace, startRain } from "./garden";
import { openSkyDials } from "./sunEdge";
import { burnShare, forecastSure } from "./sunEdge";
import {
  STORM_CREWS_ID,
  WEATHER_OPEN_FLAG,
  WEATHER_VANE_ID,
  frontsSoFar,
  hasWeatherVane,
  openWeather,
  crewCount,
} from "./weather";
import { batterySecondsOfGrid, isGridOpen, rushCarry, rushCover } from "./grid";

const coast = [PHASE_COAST] as const;
const night = [PHASE_NIGHT] as const;
const sky = [PHASE_SKY] as const;
const last = [PHASE_LAST] as const;

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/**
 * The coast's later buys appear while you are saving for them (a quarter of
 * the price in the purse), so something new turns up all through the part
 * instead of every step at once when a lighthouse goes up.
 */
const SAVING_SHARE = 0.25;
const savingFor =
  (id: string) =>
  (run: RunState): boolean =>
    (run.resources.coins ?? 0) >= COSTS[id] * SAVING_SHARE;

/** The lights you can let go in The Last Light, nearest to farthest. */
export const LET_GO: readonly { id: string; name: string; text: string }[] = [
  {
    id: "letgo-porch",
    name: "Let the porch lights go dark",
    text: "Every porch light that ever waited for someone to come home.",
  },
  {
    id: "letgo-signs",
    name: "Let the shop signs go dark",
    text: "OPEN, OPEN, OPEN. You can rest now.",
  },
  {
    id: "letgo-stadium",
    name: "Let the stadium lights go dark",
    text: "They were loud and bright. They were good at it.",
  },
  {
    id: "letgo-bridges",
    name: "Let the bridge lights go dark",
    text: "The bridges hold on without them.",
  },
  {
    id: "letgo-harbor",
    name: "Let the harbor lamps go dark",
    text: "A row of small lamps, each one a ship's welcome.",
  },
  {
    id: "letgo-towers",
    name: "Let the tower windows go dark",
    text: "Ten thousand windows, one after another.",
  },
  {
    id: "letgo-festival",
    name: "Let the festival lanterns go dark",
    text: "They floated up once a year. That was enough.",
  },
  {
    id: "letgo-fire",
    name: "Let the campfires go dark",
    text: "Warm, crackly, and good for stories.",
  },
  {
    id: "letgo-moon",
    name: "Let the moon's mirror go dark",
    text: "It only ever borrowed the light anyway.",
  },
  {
    id: "letgo-sun",
    name: "Let the sun collectors go dark",
    text: "You built them. You can thank them.",
  },
  {
    id: "letgo-night",
    name: "Let the last few stars go dark",
    text: "They were never yours. Let them be dim.",
  },
];

const sync = (run: RunState): void => syncDisplay(run);

/** A wave of probes lands: the fleet grows at once, so the gain is felt. */
const fleetBump =
  (factor: number) =>
  (run: RunState): void => {
    run.resources.probes *= factor;
  };

const burnOf = idleBurn;

const percent = (n: number): string => `${Math.round(n * 100)}%`;

const COINS_PER_SECOND: Stat = {
  label: "Coins/sec",
  read: autoCoinsPerSecond,
};

/** One step of a one-off chain: the next shows once this one is bought. */
interface Step {
  name: string;
  description: string;
  /** A milestone that must also be reached (besides the step before). */
  showWhen?: (run: RunState) => boolean;
  /** Runs after the engine's own buy handling (a wave of probes lands). */
  onBuy?: (run: RunState) => void;
  /** A badge on the card ("NEW ABILITY"). */
  badge?: string;
}

interface ChainOptions {
  base: string;
  phases: readonly string[];
  currency: string;
  stats: readonly Stat[];
  /** One plain, big line for the card instead of the before-to-after stats. */
  plain?: (before: RunState, after: RunState) => string;
  steps: readonly Step[];
}

/** `base-1`, `base-2`, ...: each a one-off, revealed in order. */
function chain({
  base,
  phases,
  currency,
  stats,
  plain,
  steps,
}: ChainOptions): UpgradeDef[] {
  return steps.map((step, i) => {
    const id = `${base}-${i + 1}`;
    return {
      id,
      name: step.name,
      description: step.description,
      phases,
      currency,
      baseCost: COSTS[id],
      costGrowth: 1,
      visibleWhen: (run: RunState) =>
        (i === 0 || owned(run, `${base}-${i}`) > 0) &&
        (step.showWhen?.(run) ?? true),
      onBuy: (run: RunState) => {
        step.onBuy?.(run);
        sync(run);
      },
      badge: step.badge,
      // The steps share one stat list, so each card shows only the lines it
      // changes: no "Grid balancing by hand → by hand" on the first step.
      effectPreview: plain
        ? plainOf(id, plain)
        : previewOf(
            id,
            stats.map((stat) => ({ ...stat, isHiddenWhenSame: true }))
          ),
    };
  });
}

// ---------------------------------------------------------------- The Coast

/** "x1.6" for how much bigger `after` is than `before`. */
const gain = (before: number, after: number): string =>
  times(before > 0 ? after / before : 1);

/** "+12/s" / "+1.4K/s": what one more keeper (or anything) adds a second. */
const perSecond = (before: number, after: number): string =>
  `+${short(after - before)}/s`;

const coastUpgrades: UpgradeDef[] = [
  {
    id: "lens",
    name: "Better lens",
    description: "Each flash guides twice the ships, the keepers' too.",
    phases: coast,
    currency: "coins",
    baseCost: COSTS.lens,
    costGrowth: 205,
    maxLevel: 3,
    priority: 1,
    onBuy: sync,
    effectPreview: plainOf("lens", (before, after) =>
      [
        `${gain(lensShips(before), lensShips(after))} ships per flash`,
        autoCoinsPerSecond(before) > 0
          ? `Keepers too: ${perSecond(autoCoinsPerSecond(before), autoCoinsPerSecond(after))}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    ),
  },
  {
    id: "keeper",
    name: "Hire a keeper",
    description:
      "Flashes the light for you at every lighthouse. Every few keepers, they all work twice as hard.",
    phases: coast,
    currency: "coins",
    baseCost: COSTS.keeper,
    costGrowth: 1.36,
    // Saves from before the cap (40 keepers at 1.18) are refunded at what they paid.
    refundGrowth: 1.18,
    maxLevel: TUNING.coast.keeperMax,
    visibleWhen: (run) => run.resources.ships >= 4,
    priority: 1,
    onBuy: sync,
    effectPreview: plainOf("keeper", (before, after) => {
      const next = nextKeeperMilestone(after);
      return [
        `+1 keeper (${perSecond(autoCoinsPerSecond(before), autoCoinsPerSecond(after))})`,
        next === null
          ? ""
          : `${next} keepers: ${times(TUNING.coast.keeperMilestoneMult)}!`,
      ]
        .filter(Boolean)
        .join("\n");
    }),
  },
  {
    id: "lighthouse",
    name: "Build another lighthouse",
    description:
      "One more light down the coast. Every ship it brings doubles with each lighthouse, and keepers work at all of them.",
    phases: coast,
    currency: "coins",
    baseCost: COSTS.lighthouse,
    costGrowth: TUNING.coast.lighthouseGrowth,
    maxLevel: COAST_LIGHTHOUSES - 1,
    visibleWhen: (run) => owned(run, "keeper") >= 3,
    priority: 2,
    onBuy: sync,
    effectPreview: plainOf("lighthouse", (before, after) =>
      [
        `${times(TUNING.coast.lighthouseMult)} ships, everywhere`,
        `Lighthouse ${lighthouseCount(after)} of ${COAST_LIGHTHOUSES}`,
      ].join("\n")
    ),
  },
  ...chain({
    base: "wick",
    phases: coast,
    currency: "coins",
    stats: [{ label: "Oil use", read: idleBurn, suffix: "/s" }],
    plain: (before, after) =>
      `Oil lasts ${gain(burnOf(after), burnOf(before))} longer`,
    steps: [
      {
        name: "Trimmed wick",
        description: "The lamp burns 40% less oil.",
        showWhen: (run) => owned(run, "keeper") >= 2,
      },
      {
        name: "Brass burner",
        description: "Another 40% less oil, for good.",
        showWhen: savingFor("wick-2"),
      },
    ],
  }),
  ...chain({
    base: "fees",
    phases: coast,
    currency: "coins",
    stats: [{ label: "Coins per ship", read: fare }],
    plain: (before, after) =>
      `${gain(fare(before), fare(after))} coins per ship`,
    steps: [
      {
        name: "Harbor fees",
        description: "Every ship pays 50% more.",
        showWhen: (run) => owned(run, "keeper") >= 4,
      },
      {
        name: "Pilot's tax",
        description: "Ships that want a pilot pay 50% more again.",
        showWhen: savingFor("fees-2"),
      },
      {
        name: "Toll booth",
        description: "A booth at the harbor mouth, and a bell. 50% more.",
        showWhen: savingFor("fees-3"),
      },
    ],
  }),
  ...chain({
    base: "dock",
    phases: coast,
    currency: "coins",
    stats: [{ label: "Coins per ship", read: fare }],
    plain: (before, after) =>
      `${gain(fare(before), fare(after))} coins per ship`,
    steps: [
      {
        name: "Fish market on the quay",
        description: "Ships stay for the market, and pay 50% more.",
        showWhen: (run) => owned(run, "keeper") >= 5,
      },
      {
        name: "Ferry landing",
        description: "A ferry that never stops. Ships pay 50% more again.",
        showWhen: savingFor("dock-2"),
      },
      {
        name: "Cruise terminal",
        description: "Big white ships, big white fares. 50% more.",
        showWhen: savingFor("dock-3"),
      },
    ],
  }),
  ...chain({
    base: "tank",
    phases: coast,
    currency: "coins",
    stats: [{ label: "Oil tank", read: tankCapacity }],
    plain: (before, after) =>
      `Tank holds ${gain(tankCapacity(before), tankCapacity(after))} the oil`,
    steps: [
      {
        name: "Bigger oil tank",
        description:
          "Hold three times the oil, so a tanker's cheap oil goes further.",
        showWhen: (run) => owned(run, "keeper") >= 6,
      },
      {
        name: "Oil cistern",
        description: "A whole cellar of oil: two thirds more again.",
        showWhen: savingFor("tank-2"),
      },
    ],
  }),
  ...chain({
    base: "train",
    phases: coast,
    currency: "coins",
    stats: [COINS_PER_SECOND],
    plain: (before, after) =>
      `${gain(trainingMult(before), trainingMult(after))} keepers' work`,
    steps: [
      {
        name: "Lamp crew drills",
        description: "Keepers practise in pairs, and flash twice as much.",
        showWhen: (run) => owned(run, "keeper") >= 3,
      },
      {
        name: "Coast guard station",
        description:
          "A station with a roster. Keepers flash twice as much again.",
        showWhen: savingFor("train-2"),
      },
      {
        name: "Rescue fleet",
        description:
          "Rescue boats help guide the ships in. Keepers do twice as much again.",
        showWhen: savingFor("train-3"),
      },
    ],
  }),
  ...chain({
    base: "shutters",
    phases: coast,
    currency: "coins",
    stats: [
      {
        label: "Storm income",
        read: stormPassive,
        format: percent,
      },
    ],
    plain: (before, after) =>
      owned(before, "shutters-1") === 0
        ? "Keepers keep working in storms"
        : `Storm ships ${gain(stormPassive(before), stormPassive(after))}`,
    steps: [
      {
        name: "Storm shutters",
        description:
          "Shutters on every window: in a storm the keepers carry on at full speed instead of hiding indoors.",
        badge: "NEW ABILITY",
        showWhen: savingFor("shutters-1"),
      },
      {
        name: "Storm-proof glass",
        description:
          "Ships run for your harbor in a storm, and more of them come.",
        showWhen: savingFor("shutters-2"),
      },
    ],
  }),
  {
    id: "contract",
    name: "A standing oil order",
    description:
      "A merchant contract: whenever the tank falls under a quarter, a full tank is sent for, at whatever the price is. The lamp stays lit, and the market is not your problem.",
    phases: coast,
    currency: "coins",
    baseCost: COSTS.contract,
    costGrowth: 1,
    badge: "NEW ABILITY",
    visibleWhen: savingFor("contract"),
    priority: 2,
    onBuy: sync,
    effectPreview: () => "Orders a full tank when it falls under a quarter",
  },
];

// ------------------------------------------------------------ No More Night

const POWER_PER_SECOND: Stat = { label: "Power/sec", read: powerPerSecond };

/** The collector's production and its next milestone share their tuning. */
function collectorPreview(stats: readonly Stat[]): (run: RunState) => string {
  const { collectorMilestones, collectorMilestoneMult } = TUNING.sky;
  const preview = previewOf("collector", stats);
  return (run) => {
    const next = collectorMilestones.find(
      (count) => owned(run, "collector") < count
    );
    return next === undefined
      ? preview(run)
      : `${preview(run)}\nAt ${next}: all collectors produce ${Math.round((collectorMilestoneMult - 1) * 100)}% more`;
  };
}

const BATTERY_STATS = [
  {
    label: "Batteries hold",
    read: batterySecondsOfGrid,
    suffix: " s of the grid",
  },
  {
    label: "A hot rush met",
    read: (run: RunState) => rushCover(run, 2, 1) * 100,
    suffix: "%",
  },
];

/**
 * The batteries are a chain: each step holds about 2.7 times the one before
 * (see `TUNING.grid.batteryHolds`), and shows once the plants are big enough
 * to want it. They soak up the day's spare power and carry the evening rush,
 * so a bigger bank keeps pace with bigger plants, and costs about half what
 * those plants did.
 */
const BATTERY_NAMES: readonly [string, string][] = [
  [
    "A battery cabinet",
    "Soaks up spare power by day and gives it back at the evening rush.",
  ],
  ["A rack of batteries", "Almost three times what the cabinet holds."],
  ["A battery shed", "Almost three times as much again."],
  ["A battery barn", "Room for the steam plants' whole evening."],
  ["A battery hall", "Cells from wall to wall, humming quietly to themselves."],
  ["A battery yard", "Rows and rows of cells, all charging in the sun."],
  ["A battery farm", "It takes a whole field to hold this much."],
  [
    "A mountain of batteries",
    "The biggest bank there is. It keeps a whole country lit.",
  ],
];

const BATTERY_STEPS = chain({
  base: "batt",
  phases: night,
  currency: "power",
  stats: BATTERY_STATS,
  steps: BATTERY_NAMES.map(([name, description], i) => ({
    name,
    description,
    // Shows once the plants are within reach of it (a bank far too big for
    // the plants never fills, and leaves them charging all day).
    showWhen: (run: RunState) =>
      i === 0
        ? isGridOpen(run)
        : supplyMW(run) * TUNING.grid.showBankSeconds >=
          TUNING.grid.batteryHolds[i],
    badge: i === 0 ? "NEW ABILITY" : undefined,
  })),
}).map((battery) => ({
  ...battery,
  // The bank has to keep up with the plants all night, so the shop never
  // crowds its next step out behind other cards.
  hasOwnSlot: true,
}));

const nightUpgrades: UpgradeDef[] = [
  {
    id: "crank",
    name: "Stronger crank",
    description: "Each turn of the crank makes much more power.",
    phases: night,
    currency: "power",
    baseCost: COSTS.crank,
    costGrowth: 1.5,
    maxLevel: 2,
    onBuy: sync,
    effectPreview: previewOf("crank", [
      { label: "Power per turn", read: crankPower },
    ]),
  },
  {
    id: "gen1",
    name: "Little generator",
    description: "Starts at 8 MW all day, if you feed it.",
    phases: night,
    currency: "power",
    baseCost: COSTS.gen1,
    costGrowth: 1.4,
    maxLevel: 5,
    visibleWhen: (run) => run.resources.power >= 10,
    priority: 1,
    onBuy: sync,
    effectPreview: previewOf("gen1", [POWER_PER_SECOND]),
  },
  ...chain({
    base: "lines",
    phases: night,
    currency: "power",
    stats: [
      { label: "Power supply", read: supplyMW, suffix: " MW" },
      { label: "Batteries can give at once", read: rushCarry, suffix: " MW" },
    ],
    steps: [
      {
        name: "Run a power line",
        description:
          "Every line carries 50% more power to the cities, and lets the batteries give more at once.",
        showWhen: (run) => owned(run, "gen1") >= 3,
      },
      {
        name: "Second power line",
        description: "A thicker cable, a longer pole. 50% more.",
        showWhen: (run) => owned(run, "gen2") >= 1,
      },
      {
        name: "A ring around the cities",
        description: "Power can go either way round. 50% more.",
        showWhen: (run) => owned(run, "gen3") >= 1,
      },
      {
        name: "A national grid",
        description: "Every town shares. 50% more.",
        showWhen: (run) => owned(run, "gen4") >= 1,
      },
    ],
  }),
  ...chain({
    base: "subs",
    phases: night,
    currency: "power",
    stats: [{ label: "Power supply", read: supplyMW, suffix: " MW" }],
    steps: [
      {
        name: "Substations",
        description: "Every plant's power reaches 50% further.",
        showWhen: (run) => owned(run, "gen3") >= 2,
      },
      {
        name: "A substation in every town",
        description: "Power loses nothing on the way. 50% more again.",
        showWhen: (run) => owned(run, "gen4") >= 2,
      },
    ],
  }),
  {
    id: "gen2",
    name: "Steam plant",
    description: "Starts at 30 MW.",
    phases: night,
    currency: "power",
    baseCost: COSTS.gen2,
    costGrowth: 1.32,
    maxLevel: 7,
    visibleWhen: (run) => owned(run, "gen1") >= 3,
    onBuy: (run, level) => {
      sync(run);
      if (level >= TUNING.weather.openAtSteamPlants) openWeather(run);
    },
    effectPreview: previewOf("gen2", [POWER_PER_SECOND]),
  },
  ...chain({
    base: "bulbs",
    phases: night,
    currency: "power",
    stats: [{ label: "Power demand", read: demandMW, suffix: " MW" }],
    steps: [
      {
        name: "Efficient bulbs",
        description: "Cities need a third less power to stay bright.",
        showWhen: (run) => owned(run, "gen2") >= 3,
      },
      {
        name: "Dimmer switches",
        description: "Nobody needs full glare at 3 a.m. A third less again.",
        showWhen: (run) => owned(run, "gen3") >= 2,
      },
      {
        name: "Smart streetlights",
        description:
          "They only shine when someone walks by. A third less again.",
        showWhen: (run) => owned(run, "gen4") >= 2,
      },
    ],
  }),
  ...BATTERY_STEPS,
  {
    id: "gen3",
    name: "River dam",
    description: "Starts at 300 MW and never needs oil.",
    phases: night,
    currency: "power",
    baseCost: COSTS.gen3,
    costGrowth: 1.4,
    maxLevel: 5,
    visibleWhen: (run) => owned(run, "gen2") >= 4,
    onBuy: sync,
    effectPreview: previewOf("gen3", [POWER_PER_SECOND]),
  },
  {
    id: "gen4",
    name: "Wind and sun farm",
    description: "Starts at 3,000 MW.",
    phases: night,
    currency: "power",
    baseCost: COSTS.gen4,
    costGrowth: 1.4,
    maxLevel: 8,
    visibleWhen: (run) => owned(run, "gen3") >= 3,
    onBuy: sync,
    effectPreview: previewOf("gen4", [POWER_PER_SECOND]),
  },
  {
    id: STORM_CREWS_ID,
    name: "A third crew",
    description:
      "One more crew to put to work: building, learning at the school, or watching for the storm.",
    phases: night,
    currency: "power",
    baseCost: COSTS[STORM_CREWS_ID],
    costGrowth: 1,
    // A bonus helper, not income: bots (and sensible players) buy plants first.
    priority: -1,
    visibleWhen: (run) =>
      run.flags[WEATHER_OPEN_FLAG] === true && owned(run, "gen3") >= 3,
    onBuy: sync,
    effectPreview: previewOf(STORM_CREWS_ID, [
      { label: "Crews to post", read: crewCount, isPlain: true },
    ]),
  },
  {
    id: WEATHER_VANE_ID,
    name: "Weather vane",
    description:
      "Points at the likeliest town and shields it for you, at 60% of the usual bonus. Shield by hand and you still get the full bonus.",
    phases: night,
    currency: "power",
    baseCost: COSTS[WEATHER_VANE_ID],
    costGrowth: 1,
    priority: -1,
    // Halfway through the desk's life (after two fronts), so most players
    // see the helper while the desk still matters.
    visibleWhen: (run) =>
      run.flags[WEATHER_OPEN_FLAG] === true && frontsSoFar(run) >= 2,
    onBuy: sync,
    effectPreview: previewOf(WEATHER_VANE_ID, [
      {
        label: "Storm shielding",
        read: (run) => (hasWeatherVane(run) ? 1 : 0),
        format: (v) => (v > 0 ? "automatic" : "by hand"),
      },
    ]),
  },
];

// ------------------------------------------------------------------ The Sky

const ENERGY_PER_SECOND: Stat = {
  label: "Energy/sec",
  read: collectorEnergyPerSecond,
};

const skyUpgrades: UpgradeDef[] = [
  {
    id: "aim",
    name: "Steadier aim",
    description: "Each aim catches much more sunlight.",
    phases: sky,
    currency: "energy",
    baseCost: COSTS.aim,
    costGrowth: 1.5,
    maxLevel: 3,
    onBuy: sync,
    effectPreview: previewOf("aim", [
      { label: "Energy per aim", read: aimEnergy },
    ]),
  },
  {
    id: "collector",
    name: "Sun collector",
    description: "Catches sunlight all day long.",
    phases: sky,
    currency: "energy",
    baseCost: COSTS.collector,
    costGrowth: 1.45,
    // The picture draws six; more were only a number going up.
    maxLevel: 6,
    priority: 1,
    onBuy: (run) => {
      run.resources.collectors = owned(run, "collector");
      sync(run);
    },
    effectPreview: collectorPreview([ENERGY_PER_SECOND]),
  },
  ...chain({
    base: "mirror",
    phases: sky,
    currency: "energy",
    stats: [ENERGY_PER_SECOND],
    steps: [
      {
        name: "Bigger mirror",
        description: "Every collector catches 60% more.",
        showWhen: (run) => owned(run, "collector") >= 3,
      },
      {
        name: "Mirror of mirrors",
        description: "A ring of them. Every collector catches 60% more.",
        showWhen: (run) => owned(run, "copy-1") >= 1,
      },
      {
        name: "A mirror the size of a lake",
        description: "Every collector catches 60% more.",
        showWhen: (run) => owned(run, "copy-2") >= 1,
      },
    ],
  }),
  {
    id: "probe",
    name: "Launch the first probe",
    description:
      "A small machine that goes to a star, makes a copy of itself, and sends it on.",
    phases: sky,
    currency: "energy",
    baseCost: COSTS.probe,
    costGrowth: 1,
    visibleWhen: (run) => owned(run, "collector") >= 4,
    priority: 3,
    onBuy: (run) => {
      run.resources.probes = Math.max(
        TUNING.sky.firstProbes,
        run.resources.probes
      );
      openSkyDials(run);
      sync(run);
    },
    effectPreview: () =>
      `Probes flying 0 → ${TUNING.sky.firstProbes}, and they copy themselves`,
  },
  ...chain({
    base: "copy",
    phases: sky,
    currency: "energy",
    stats: [{ label: "Probe copy speed", read: copySpeed, suffix: "×" }],
    steps: [
      {
        name: "Faster copying",
        description:
          "Probes make copies of themselves almost twice as fast, and a wave of new ones lands.",
        showWhen: (run) => owned(run, "probe") >= 1,
        onBuy: fleetBump(TUNING.sky.copyFleetBump),
      },
      {
        name: "Self-repairing copies",
        description:
          "Fewer dead probes. Almost twice as fast again, and another wave lands.",
        showWhen: (run) => owned(run, "mirror-2") >= 1,
        onBuy: fleetBump(TUNING.sky.copyFleetBump),
      },
    ],
  }),
  ...chain({
    base: "relay",
    phases: sky,
    currency: "energy",
    stats: [{ label: "Energy per star", read: starBounty }],
    steps: [
      {
        name: "Relay stations",
        description:
          "Light from every star taken is gathered. Each pays 60% more.",
        showWhen: (run) => owned(run, "mirror-3") >= 1,
      },
      {
        name: "A ring of relays",
        description: "Nothing is wasted on the way home. 60% more again.",
        showWhen: (run) =>
          run.resources.stars < 880 && owned(run, "appetite-1") >= 1,
      },
      {
        name: "The whole sky listening",
        description: "Every star taken sings back. 60% more again.",
        showWhen: (run) =>
          run.resources.stars < 700 && owned(run, "appetite-2") >= 1,
      },
    ],
  }),
  ...chain({
    base: "nav",
    phases: sky,
    currency: "energy",
    stats: [
      {
        label: "Forecast is right",
        why: "The sun's edge asks you to read it",
        read: (run) => forecastSure(run) * 100,
        suffix: "%",
      },
      {
        label: "A usual flare burns",
        read: (run) => burnShare(run, 1) * 100,
        suffix: "% of the fleet",
      },
    ],
    steps: [
      {
        name: "Sun charts",
        description:
          "Charts of every flare the sun has thrown. The forecast gets a flare's size right nine times in ten, not six.",
        // After the second mirror, so the cards do not all arrive at once.
        showWhen: (run) => owned(run, "mirror-2") >= 1,
      },
      {
        name: "Shield foundry",
        description:
          "A forge that makes better shields. Every shield point is 50% stronger.",
        showWhen: (run) => owned(run, "engines-1") >= 1,
      },
    ],
  }),
  ...chain({
    base: "engines",
    phases: sky,
    currency: "energy",
    stats: [
      {
        label: "Probe trip",
        read: travelSeconds,
        suffix: " s",
        less: "shorter",
      },
    ],
    steps: [
      {
        name: "Quicker engines",
        description:
          "Probes cross the dark 40% faster, and the ones in flight arrive early.",
        // After the second mirror, so the new cards do not all arrive at once.
        showWhen: (run) => owned(run, "mirror-2") >= 1,
        onBuy: fleetBump(TUNING.sky.engineFleetBump),
      },
      {
        name: "A sail of sunlight",
        description:
          "Probes ride the light. 40% faster again, and more arrive early.",
        showWhen: (run) => owned(run, "copy-2") >= 1,
        onBuy: fleetBump(TUNING.sky.engineFleetBump),
      },
    ],
  }),
  ...chain({
    base: "appetite",
    phases: sky,
    currency: "energy",
    stats: [{ label: "Star-taking speed", read: appetite, suffix: "×" }],
    steps: [
      {
        name: "Hungrier probes",
        description: "Each probe takes stars more than twice as fast.",
        showWhen: (run) => owned(run, "engines-1") >= 1,
      },
      {
        name: "Wider arms",
        description:
          "Probes grab more at a time. More than twice as fast again.",
        showWhen: (run) => owned(run, "engines-2") >= 1,
      },
    ],
  }),
];

/** What each gift reads like on its card. */
const GIFT_TEXT = {
  fade: "The flame holds on much longer.",
  burst: "The flame leaps up, bright for a good while.",
  taps: "Every tap of the flame is worth a lot more.",
} as const;

const GIFT_STATS: Record<LetGoGift, readonly Stat[]> = {
  fade: [
    {
      label: "Flame holds at",
      read: (run) => (steadyFlame(run) / TUNING.last.flameFull) * 100,
      suffix: "%",
    },
  ],
  // The leap happens in `onBuy`, which a preview does not run: see
  // `burstLine` below.
  burst: [],
  taps: [
    {
      label: "Resolve per tap",
      read: lastTapResolve,
    },
  ],
};

const letGoUpgrades: UpgradeDef[] = LET_GO.map((light) => {
  const gift = LET_GO_GIFTS[light.id];
  return {
    id: light.id,
    name: light.name,
    description: `${light.text} ${GIFT_TEXT[gift]} Every light let go makes the next easier.`,
    phases: last,
    currency: "resolve",
    baseCost: COSTS[light.id],
    costGrowth: 1,
    priority: 0,
    onBuy: (run: RunState) => {
      if (gift === "burst")
        run.resources.flame = Math.min(
          TUNING.last.flameFull,
          flameOf(run) + TUNING.last.burstFlame
        );
      sync(run);
    },
    effectPreview: (run: RunState) =>
      [
        previewOf(light.id, [
          {
            label: "Lights lit",
            read: (r) => r.resources.lights,
            format: short,
            isPlain: true,
          },
          ...GIFT_STATS[gift],
        ])(run),
        gift === "burst" ? burstLine(run) : "",
      ]
        .filter(Boolean)
        .join("\n"),
  };
});

/** "Flame now 60% → 85%": the leap a burst gift gives the moment it is bought. */
function burstLine(run: RunState): string {
  const now = flameFraction(run) * 100;
  const leapt =
    (Math.min(TUNING.last.flameFull, flameOf(run) + TUNING.last.burstFlame) /
      TUNING.last.flameFull) *
    100;
  return `Flame now ${short(now)}% → ${short(leapt)}%`;
}

/** The garden's helper: it opens once the first flower has been picked. */
const rainBarrel: UpgradeDef = {
  id: RAIN_BARREL_ID,
  name: "Rain barrel",
  description:
    "A barrel by the flower beds that waters the thirsty ones now and then. Watering by hand still helps, on top.",
  phases: last,
  currency: "resolve",
  baseCost: COSTS[RAIN_BARREL_ID],
  costGrowth: 1,
  // Halfway through the garden's life (after a few picks), and ranked with
  // the lights, so a player who wants it can have it while it still helps.
  priority: 0,
  visibleWhen: (run) => picksSoFar(run) >= 3,
  onBuy: (run: RunState) => {
    startRain(run);
    sync(run);
  },
  effectPreview: previewOf(RAIN_BARREL_ID, [
    {
      label: "Unwatered flowers grow",
      read: (run) => restingPace(run) * 100,
      suffix: "%",
    },
  ]),
};

/** Scorecard tags: the upgrades that bring a new system or action. */
const MECHANICS: ReadonlySet<string> = new Set([
  "keeper",
  "lighthouse",
  "contract",
  "gen1",
  "collector",
  "probe",
  "letgo-porch",
  "batt-1",
  WEATHER_VANE_ID,
  RAIN_BARREL_ID,
  "nav-1",
  "nav-2",
]);

/**
 * The first steps of a phase keep their old price, so it opens as quickly as
 * ever (a player who barely taps must still get going); everything after
 * them is scaled by the phase's `costScale`.
 */
const OPENING_UPGRADES: Readonly<Record<string, number>> = {
  aim: 1,
  collector: 1,
  ...TUNING.openingScale,
};

const costScaleOf = (upgrade: UpgradeDef): number =>
  OPENING_UPGRADES[upgrade.id] ??
  TUNING.costScale[upgrade.phases?.[0] ?? ""] ??
  1;

export const UPGRADES: readonly UpgradeDef[] = [
  ...coastUpgrades,
  ...nightUpgrades,
  ...skyUpgrades,
  // Before the lights: the shop always has three on offer, so the barrel
  // takes the next free slot once it has been earned, not the last one.
  rainBarrel,
  ...letGoUpgrades,
].map((upgrade) => ({
  ...upgrade,
  baseCost: upgrade.baseCost * costScaleOf(upgrade),
  // A bot that is not sure what to buy prefers what pays now: the mirrors.
  priority: upgrade.id.startsWith("mirror-") ? 2 : upgrade.priority,
  badge:
    upgrade.badge ??
    (["nav-2", WEATHER_VANE_ID, RAIN_BARREL_ID].includes(upgrade.id)
      ? "NEW ABILITY"
      : undefined),
  kind: MECHANICS.has(upgrade.id) ? "mechanic" : "scale",
}));
