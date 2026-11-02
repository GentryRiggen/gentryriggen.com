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
  driftPerSecond,
  isCourseAuto,
  starBounty,
  isGridAuto,
  strainPerSecond,
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
import {
  MISSION_CONTROL_ID,
  PROBES_OPEN_FLAG,
  RACING_FINS_ID,
  openProbes,
  routeSeconds,
  runsHome,
} from "./probes";
import {
  STORM_CREWS_ID,
  WEATHER_OPEN_FLAG,
  WEATHER_VANE_ID,
  frontsSoFar,
  hasWeatherVane,
  openWeather,
  shieldSlots,
} from "./weather";

const coast = [PHASE_COAST] as const;
const night = [PHASE_NIGHT] as const;
const sky = [PHASE_SKY] as const;
const last = [PHASE_LAST] as const;

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

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
      effectPreview: plain ? plainOf(id, plain) : previewOf(id, stats),
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
    costGrowth: 1.18,
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
        showWhen: (run) => owned(run, "keeper") >= 4,
      },
      {
        name: "Brass burner",
        description: "Another 40% less oil, for good.",
        showWhen: (run) => lighthouseCount(run) >= 3,
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
        showWhen: (run) => owned(run, "keeper") >= 6,
      },
      {
        name: "Pilot's tax",
        description: "Ships that want a pilot pay 50% more again.",
        showWhen: (run) => owned(run, "keeper") >= 14,
      },
      {
        name: "Toll booth",
        description: "A booth at the harbor mouth, and a bell. 50% more.",
        showWhen: (run) => lighthouseCount(run) >= 4,
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
        showWhen: (run) => owned(run, "keeper") >= 8,
      },
      {
        name: "Ferry landing",
        description: "A ferry that never stops. Ships pay 50% more again.",
        showWhen: (run) => lighthouseCount(run) >= 3,
      },
      {
        name: "Cruise terminal",
        description: "Big white ships, big white fares. 50% more.",
        showWhen: (run) => lighthouseCount(run) >= 5,
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
        description: "Hold three times the oil, so a cheap day goes further.",
        showWhen: (run) => owned(run, "keeper") >= 10,
      },
      {
        name: "Oil cistern",
        description: "A whole cellar of oil: two thirds more again.",
        showWhen: (run) => lighthouseCount(run) >= 3,
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
        description: "Keepers work in pairs. Half as many flashes again.",
        showWhen: (run) => owned(run, "keeper") >= 4,
      },
      {
        name: "Coast guard station",
        description: "A station with a roster. Twice as many again.",
        showWhen: (run) => lighthouseCount(run) >= 3,
      },
      {
        name: "Rescue fleet",
        description: "Ships flashing at ships. Twice as many again.",
        showWhen: (run) => lighthouseCount(run) >= 5,
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
        showWhen: (run) => owned(run, "keeper") >= 12,
      },
      {
        name: "Storm-proof glass",
        description:
          "Ships run for your harbor in a storm, and more of them come.",
        showWhen: (run) => lighthouseCount(run) >= 4,
      },
    ],
  }),
  {
    id: "contract",
    name: "Keepers buy oil when it's cheap",
    description:
      "A merchant contract: whenever oil is cheap your keepers top up the tank for you, and they send for a little at any price when it runs nearly dry.",
    phases: coast,
    currency: "coins",
    baseCost: COSTS.contract,
    costGrowth: 1,
    badge: "NEW ABILITY",
    visibleWhen: (run) => owned(run, "keeper") >= 15,
    priority: 2,
    onBuy: sync,
    effectPreview: () => "Buys oil for you at 1.60 or less",
  },
];

// ------------------------------------------------------------ No More Night

const POWER_PER_SECOND: Stat = { label: "Power/sec", read: powerPerSecond };

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
    description: "Makes 8 MW all day, if you feed it.",
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
    stats: [{ label: "Supply", read: supplyMW, suffix: " MW" }],
    steps: [
      {
        name: "Run a power line",
        description: "Every line carries 50% more power to the cities.",
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
    stats: [{ label: "Supply", read: supplyMW, suffix: " MW" }],
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
    description: "Makes 30 MW.",
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
    stats: [{ label: "Demand", read: demandMW, suffix: " MW" }],
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
  ...chain({
    base: "grid",
    phases: night,
    currency: "power",
    stats: [
      {
        label: "Strain",
        read: (run) => strainPerSecond(run) * 60,
        suffix: "% a minute",
      },
      {
        label: "Balancing",
        read: (run) => (isGridAuto(run) ? 1 : 0),
        format: (v) => (v > 0 ? "automatic" : "by hand"),
      },
    ],
    steps: [
      {
        name: "Load balancer",
        description: "The grid strains half as fast.",
        showWhen: (run) => owned(run, "gen2") >= 2,
      },
      {
        name: "Smart grid",
        description: "The grid balances itself. No more hand-fixing.",
        showWhen: (run) => owned(run, "gen2") >= 4,
      },
    ],
  }),
  {
    id: "gen3",
    name: "River dam",
    description: "Makes 300 MW and never needs oil.",
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
    description: "Makes 3,000 MW.",
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
    name: "Storm crews",
    description: "More hands for the sandbags: shield two towns at once.",
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
      { label: "Towns to shield", read: shieldSlots },
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
        label: "Shielding",
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
    effectPreview: previewOf("collector", [ENERGY_PER_SECOND]),
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
      sync(run);
    },
    effectPreview: () =>
      `Probes: 0 → ${TUNING.sky.firstProbes}, and they copy themselves`,
  },
  ...chain({
    base: "copy",
    phases: sky,
    currency: "energy",
    stats: [{ label: "Copy speed", read: copySpeed, suffix: "×" }],
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
        label: "Drift",
        read: (run) => driftPerSecond(run) * 60,
        suffix: "% a minute",
      },
      {
        label: "Course",
        read: (run) => (isCourseAuto(run) ? 1 : 0),
        format: (v) => (v > 0 ? "automatic" : "by hand"),
      },
    ],
    steps: [
      {
        name: "Star charts",
        description:
          "The fleet drifts off course half as fast. The charts show a map: send a racing probe on a route and it brings back energy.",
        // After the second mirror, so the cards do not all arrive at once.
        showWhen: (run) => owned(run, "mirror-2") >= 1,
        onBuy: openProbes,
      },
      {
        name: "A navigator mind",
        description:
          "The fleet corrects its own course. No more hand-steering.",
        showWhen: (run) => owned(run, "engines-1") >= 1,
      },
    ],
  }),
  {
    id: RACING_FINS_ID,
    name: "Racing fins",
    description:
      "Fins on the racing probe. Every route takes half the time, and the haul stays the same.",
    phases: sky,
    currency: "energy",
    baseCost: COSTS[RACING_FINS_ID],
    costGrowth: 1,
    // A bonus helper, not income: bots buy collectors and mirrors first.
    priority: -1,
    visibleWhen: (run) =>
      run.flags[PROBES_OPEN_FLAG] === true && runsHome(run) >= 1,
    onBuy: sync,
    effectPreview: previewOf(RACING_FINS_ID, [
      {
        label: "Short hop",
        read: (run) => routeSeconds(run, 0),
        suffix: " s",
      },
      {
        label: "Long loop",
        read: (run) => routeSeconds(run, 1),
        suffix: " s",
      },
    ]),
  },
  {
    id: MISSION_CONTROL_ID,
    name: "Mission control",
    description:
      "A second, scout probe flies your last route again and again by itself, for a smaller haul. Yours still pay in full on top.",
    phases: sky,
    currency: "energy",
    baseCost: COSTS[MISSION_CONTROL_ID],
    costGrowth: 1,
    priority: -1,
    // Later, once the racing probe has its fins.
    visibleWhen: (run) =>
      run.flags[PROBES_OPEN_FLAG] === true && owned(run, RACING_FINS_ID) > 0,
    onBuy: sync,
    effectPreview: () => "Scout probe: none → flies your last route",
  },
  ...chain({
    base: "engines",
    phases: sky,
    currency: "energy",
    stats: [{ label: "Trip", read: travelSeconds, suffix: "s" }],
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
    stats: [{ label: "Star taking", read: appetite, suffix: "×" }],
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
  burst: [
    {
      label: "Flame",
      read: (run) => flameFraction(run) * 100,
      suffix: "%",
    },
  ],
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
    effectPreview: previewOf(light.id, [
      { label: "Lights lit", read: (r) => r.resources.lights, format: short },
      ...GIFT_STATS[gift],
    ]),
  };
});

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
      label: "Growth with no watering",
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
  "grid-1",
  "grid-2",
  WEATHER_VANE_ID,
  MISSION_CONTROL_ID,
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
  kind: MECHANICS.has(upgrade.id) ? "mechanic" : "scale",
}));
