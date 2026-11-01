import type { RunState, UpgradeDef } from "../../engine/types";
import { PHASE_COAST, PHASE_LAST, PHASE_NIGHT, PHASE_SKY } from "./resources";
import { COSTS } from "./costs";
import { previewOf, short, type Stat } from "./preview";
import {
  appetite,
  autoCoinsPerSecond,
  calmTapCoins,
  collectorEnergyPerSecond,
  copySpeed,
  crankPower,
  decayPerSecond,
  demandMW,
  fare,
  idleBurn,
  lastTapEnergy,
  lighthouseCount,
  shipsPerFlash,
  stormPassive,
  supplyMW,
  syncDisplay,
  tankCapacity,
  travelSeconds,
  powerPerSecond,
  aimEnergy,
} from "./tick";

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
}

interface ChainOptions {
  base: string;
  phases: readonly string[];
  currency: string;
  stats: readonly Stat[];
  steps: readonly Step[];
}

/** `base-1`, `base-2`, ...: each a one-off, revealed in order. */
function chain({
  base,
  phases,
  currency,
  stats,
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
      onBuy: sync,
      effectPreview: previewOf(id, stats),
    };
  });
}

// ---------------------------------------------------------------- The Coast

const coastUpgrades: UpgradeDef[] = [
  {
    id: "lens",
    name: "Better lens",
    description: "Each flash guides one more ship.",
    phases: coast,
    currency: "coins",
    baseCost: COSTS.lens,
    costGrowth: 2.1,
    maxLevel: 5,
    priority: 1,
    onBuy: sync,
    effectPreview: previewOf("lens", [
      { label: "Ships per flash", read: shipsPerFlash },
      { label: "Coins per flash", read: calmTapCoins },
    ]),
  },
  {
    id: "keeper",
    name: "Hire a keeper",
    description: "Flashes the light for you at every lighthouse.",
    phases: coast,
    currency: "coins",
    baseCost: COSTS.keeper,
    costGrowth: 1.4,
    maxLevel: 10,
    visibleWhen: (run) => run.resources.ships >= 12,
    priority: 1,
    onBuy: sync,
    effectPreview: previewOf("keeper", [COINS_PER_SECOND]),
  },
  {
    id: "lighthouse",
    name: "Build another lighthouse",
    description: "One more light down the coast. Keepers work at every one.",
    phases: coast,
    currency: "coins",
    baseCost: COSTS.lighthouse,
    costGrowth: 1.9,
    maxLevel: 7,
    visibleWhen: (run) => owned(run, "keeper") >= 3,
    priority: 2,
    onBuy: sync,
    effectPreview: previewOf("lighthouse", [
      { label: "Lighthouses", read: lighthouseCount },
      COINS_PER_SECOND,
    ]),
  },
  ...chain({
    base: "wick",
    phases: coast,
    currency: "coins",
    stats: [{ label: "Oil use", read: idleBurn, suffix: "/s" }],
    steps: [
      {
        name: "Trimmed wick",
        description: "The lamp burns 25% less oil.",
        showWhen: (run) => run.resources.ships >= 50,
      },
      {
        name: "Brass burner",
        description: "Another 25% less oil, for good.",
        showWhen: (run) => lighthouseCount(run) >= 3,
      },
    ],
  }),
  ...chain({
    base: "fees",
    phases: coast,
    currency: "coins",
    stats: [{ label: "Coins per ship", read: fare }],
    steps: [
      {
        name: "Harbor fees",
        description: "Every ship pays 30% more.",
        showWhen: (run) => run.resources.ships >= 80,
      },
      {
        name: "Pilot's tax",
        description: "Ships that want a pilot pay 30% more again.",
        showWhen: (run) => run.resources.ships >= 600,
      },
      {
        name: "Toll booth",
        description: "A booth at the harbor mouth, and a bell. 30% more.",
        showWhen: (run) => lighthouseCount(run) >= 4,
      },
    ],
  }),
  ...chain({
    base: "tank",
    phases: coast,
    currency: "coins",
    stats: [{ label: "Oil tank", read: tankCapacity }],
    steps: [
      {
        name: "Bigger oil tank",
        description: "Hold more oil, so a cheap day goes further.",
        showWhen: (run) => run.resources.ships >= 120,
      },
      {
        name: "Oil cistern",
        description: "A whole cellar of oil.",
        showWhen: (run) => lighthouseCount(run) >= 3,
      },
    ],
  }),
  ...chain({
    base: "train",
    phases: coast,
    currency: "coins",
    stats: [COINS_PER_SECOND],
    steps: [
      {
        name: "Lamp crew drills",
        description: "Keepers work in pairs. Twice as many flashes.",
        showWhen: (run) => owned(run, "keeper") >= 5,
      },
      {
        name: "Coast guard station",
        description: "A station with a roster. Twice as many again.",
        showWhen: (run) => lighthouseCount(run) >= 3,
      },
      {
        name: "Rescue fleet",
        description: "Ships flashing at ships. 2.5 times as many.",
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
    steps: [
      {
        name: "Storm shutters",
        description: "Storms slow the ships less.",
        showWhen: (run) => run.resources.ships >= 250,
      },
      {
        name: "Storm-proof glass",
        description: "Storms hardly matter now.",
        showWhen: (run) => lighthouseCount(run) >= 4,
      },
    ],
  }),
  {
    id: "contract",
    name: "Oil merchant contract",
    description:
      "A merchant tops up your tank whenever oil is cheap, and sends a little if it runs nearly dry.",
    phases: coast,
    currency: "coins",
    baseCost: COSTS.contract,
    costGrowth: 1,
    visibleWhen: (run) => lighthouseCount(run) >= 3,
    priority: 2,
    onBuy: sync,
    effectPreview: () => "Oil bought for you at 1.60 or less",
  },
];

// ------------------------------------------------------------ No More Night

const POWER_PER_SECOND: Stat = { label: "Power/sec", read: powerPerSecond };

const nightUpgrades: UpgradeDef[] = [
  {
    id: "crank",
    name: "Stronger crank",
    description: "Each turn of the crank makes more power.",
    phases: night,
    currency: "power",
    baseCost: COSTS.crank,
    costGrowth: 1.5,
    maxLevel: 5,
    onBuy: sync,
    effectPreview: previewOf("crank", [
      { label: "Power per turn", read: crankPower },
    ]),
  },
  {
    id: "gen1",
    name: "Little generator",
    description: "Makes 3 MW all day, if you feed it.",
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
        description: "Every line carries 15% more power to the cities.",
        showWhen: (run) => owned(run, "gen1") >= 3,
      },
      {
        name: "Second power line",
        description: "A thicker cable, a longer pole. 15% more.",
        showWhen: (run) => owned(run, "gen2") >= 1,
      },
      {
        name: "A ring around the cities",
        description: "Power can go either way round. 15% more.",
        showWhen: (run) => owned(run, "gen3") >= 1,
      },
      {
        name: "A national grid",
        description: "Every town shares. 15% more.",
        showWhen: (run) => owned(run, "gen4") >= 1,
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
    costGrowth: 1.4,
    maxLevel: 5,
    visibleWhen: (run) => owned(run, "gen1") >= 5,
    onBuy: sync,
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
        description: "Cities need 12% less power to stay bright.",
        showWhen: (run) => owned(run, "gen2") >= 3,
      },
      {
        name: "Dimmer switches",
        description: "Nobody needs full glare at 3 a.m. 12% less.",
        showWhen: (run) => owned(run, "gen3") >= 2,
      },
      {
        name: "Smart streetlights",
        description: "They only shine when someone walks by. 12% less.",
        showWhen: (run) => owned(run, "gen4") >= 2,
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
    description: "Each aim catches more sunlight.",
    phases: sky,
    currency: "energy",
    baseCost: COSTS.aim,
    costGrowth: 1.5,
    maxLevel: 5,
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
    costGrowth: 1.25,
    maxLevel: 10,
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
        description: "Every collector catches 40% more.",
        showWhen: (run) => owned(run, "collector") >= 4,
      },
      {
        name: "Mirror of mirrors",
        description: "A ring of them. Every collector catches 40% more.",
        showWhen: (run) => owned(run, "appetite-1") >= 1,
      },
      {
        name: "A mirror the size of a lake",
        description: "Every collector catches 40% more.",
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
    visibleWhen: (run) => owned(run, "collector") >= 8,
    priority: 3,
    onBuy: (run) => {
      run.resources.probes = Math.max(1, run.resources.probes);
      sync(run);
    },
    effectPreview: () => "Probes: 0 → 1, and they copy themselves",
  },
  ...chain({
    base: "copy",
    phases: sky,
    currency: "energy",
    stats: [{ label: "Copy speed", read: copySpeed, suffix: "×" }],
    steps: [
      {
        name: "Faster copying",
        description: "Probes make copies of themselves 50% faster.",
        showWhen: (run) => owned(run, "probe") >= 1,
      },
      {
        name: "Self-repairing copies",
        description: "Fewer dead probes. 50% faster again.",
        showWhen: (run) => owned(run, "mirror-2") >= 1,
      },
      {
        name: "Copies that copy copies",
        description: "Probes build probes while still flying. 50% faster.",
        showWhen: (run) => owned(run, "appetite-2") >= 1,
      },
    ],
  }),
  ...chain({
    base: "engines",
    phases: sky,
    currency: "energy",
    stats: [{ label: "Trip", read: travelSeconds, suffix: "s" }],
    steps: [
      {
        name: "Quicker engines",
        description: "Probes cross the dark 28% faster.",
        showWhen: (run) => owned(run, "copy-1") >= 1,
      },
      {
        name: "A sail of sunlight",
        description: "Probes ride the light. 28% faster again.",
        showWhen: (run) => owned(run, "copy-2") >= 1,
      },
      {
        name: "Shortcuts through the dark",
        description: "Someone found one. 28% faster again.",
        showWhen: (run) => owned(run, "mirror-3") >= 1,
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
        description: "Each probe takes stars 70% faster.",
        showWhen: (run) => owned(run, "engines-1") >= 1,
      },
      {
        name: "Wider arms",
        description: "Probes grab more at a time. 70% faster again.",
        showWhen: (run) => owned(run, "engines-2") >= 1,
      },
      {
        name: "Gather whole clusters",
        description: "Probes take stars in handfuls. 70% faster.",
        showWhen: (run) => owned(run, "copy-3") >= 1,
      },
    ],
  }),
];

const letGoUpgrades: UpgradeDef[] = LET_GO.map((light, i) => ({
  id: light.id,
  name: light.name,
  description: `${light.text} Gives back some energy and lowers the cost of keeping the rest.`,
  phases: last,
  currency: "resolve",
  baseCost: COSTS[light.id],
  costGrowth: 1,
  priority: 0,
  visibleWhen: (run: RunState) => i < 1 || lightsOnOffer(run, i),
  onBuy: (run: RunState) => {
    run.resources.energy += 200;
    sync(run);
  },
  effectPreview: previewOf(light.id, [
    { label: "Lights lit", read: (r) => r.resources.lights, format: short },
    { label: "Fade/sec", read: decayPerSecond },
  ]),
}));

/** Each light waits until the one before it has been let go. */
function lightsOnOffer(run: RunState, index: number): boolean {
  return owned(run, LET_GO[index - 1].id) > 0;
}

const lastUpgrades: UpgradeDef[] = [
  {
    id: "shield",
    name: "Cup your hands around the flame",
    description: "The remaining lights fade 12% slower.",
    phases: last,
    currency: "energy",
    baseCost: COSTS.shield,
    costGrowth: 1.6,
    maxLevel: 2,
    visibleWhen: (run) => owned(run, "letgo-bridges") > 0,
    priority: 1,
    onBuy: sync,
    effectPreview: previewOf("shield", [
      { label: "Fade/sec", read: decayPerSecond },
    ]),
  },
  {
    id: "glass",
    name: "Polish the old glass",
    description: "Each tap of the flame gives 25% more.",
    phases: last,
    currency: "energy",
    baseCost: COSTS.glass,
    costGrowth: 1.6,
    maxLevel: 2,
    visibleWhen: (run) => owned(run, "letgo-towers") > 0,
    onBuy: sync,
    effectPreview: previewOf("glass", [
      { label: "Energy per tap", read: lastTapEnergy },
    ]),
  },
  {
    id: "remember",
    name: "Remember the very first ship",
    description:
      "One small boat, one lantern, one child waving from the bow. Hold on to that.",
    phases: last,
    currency: "energy",
    baseCost: COSTS.remember,
    costGrowth: 1,
    visibleWhen: (run) => run.resources.lights <= 1,
    priority: 5,
    onBuy: sync,
    effectPreview: () => "The last light holds",
  },
];

/** Scorecard tags: the upgrades that bring a new system or action. */
const MECHANICS: ReadonlySet<string> = new Set([
  "keeper",
  "lighthouse",
  "contract",
  "gen1",
  "collector",
  "probe",
  "letgo-porch",
  "remember",
]);

export const UPGRADES: readonly UpgradeDef[] = [
  ...coastUpgrades,
  ...nightUpgrades,
  ...skyUpgrades,
  ...letGoUpgrades,
  ...lastUpgrades,
].map((upgrade) => ({
  ...upgrade,
  kind: MECHANICS.has(upgrade.id) ? "mechanic" : "scale",
}));
