import type { RunState, UpgradeDef } from "../../engine/types";
import { PHASE_COAST, PHASE_LAST, PHASE_NIGHT, PHASE_SKY } from "./resources";
import { BOON_UPGRADES } from "./boons";
import { syncDisplay } from "./tick";

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

interface KeeperTier {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  /** Shows up once coins or ships reach this. */
  showAt: number;
}

const KEEPER_TIER_DEFS: readonly KeeperTier[] = [
  {
    id: "keeper",
    name: "Hire a keeper",
    description: "Flashes the light for you at every lighthouse.",
    baseCost: 50,
    showAt: 15,
  },
  {
    id: "crew",
    name: "Train a lamp crew",
    description: "A team of six flashes the light for you.",
    baseCost: 700,
    showAt: 120,
  },
  {
    id: "station",
    name: "Open a coast guard station",
    description: "Seventy flashes a second, give or take.",
    baseCost: 9000,
    showAt: 1000,
  },
  {
    id: "fleet",
    name: "Launch a rescue fleet",
    description: "Ships flashing at ships. It is a lot.",
    baseCost: 120000,
    showAt: 12000,
  },
];

const KEEPER_UPGRADES: UpgradeDef[] = KEEPER_TIER_DEFS.map((tier) => ({
  id: tier.id,
  name: tier.name,
  description: tier.description,
  phases: coast,
  currency: "coins",
  baseCost: tier.baseCost,
  costGrowth: 1.15,
  maxLevel: Infinity,
  visibleWhen: (run: RunState) =>
    run.resources.coins >= tier.showAt * 0.5 ||
    run.resources.ships >= tier.showAt,
  priority: 1,
  onBuy: sync,
}));

const coastUpgrades: UpgradeDef[] = [
  {
    id: "lens",
    name: "Better lens",
    description: "Each flash guides one more ship.",
    phases: coast,
    currency: "coins",
    baseCost: 12,
    costGrowth: 1.3,
    maxLevel: Infinity,
    priority: 1,
    onBuy: sync,
  },
  ...KEEPER_UPGRADES,
  {
    id: "wick",
    name: "Trimmed wick",
    description: "The lamp burns 10% less oil.",
    phases: coast,
    currency: "coins",
    baseCost: 80,
    costGrowth: 1.5,
    maxLevel: 12,
    visibleWhen: (run) => run.resources.oil > 0 || run.resources.ships >= 30,
    onBuy: sync,
  },
  {
    id: "fees",
    name: "Harbor fees",
    description: "Every ship pays 30% more.",
    phases: coast,
    currency: "coins",
    baseCost: 150,
    costGrowth: 1.65,
    maxLevel: 12,
    visibleWhen: (run) => run.resources.ships >= 60,
    onBuy: sync,
  },
  {
    id: "tank",
    name: "Bigger oil tank",
    description: "Hold more oil and buy it when the price is low.",
    phases: coast,
    currency: "coins",
    baseCost: 220,
    costGrowth: 1.9,
    maxLevel: 6,
    visibleWhen: (run) => run.resources.ships >= 80,
    onBuy: sync,
  },
  {
    id: "shutters",
    name: "Storm shutters",
    description: "Storms slow the ships less.",
    phases: coast,
    currency: "coins",
    baseCost: 300,
    costGrowth: 1.7,
    maxLevel: 5,
    visibleWhen: (run) => run.resources.stormCooldown < 100,
    onBuy: sync,
  },
  {
    id: "lighthouse",
    name: "Build another lighthouse",
    description: "One more light down the coast. Keepers work at every one.",
    phases: coast,
    currency: "coins",
    baseCost: 4000,
    costGrowth: 10.6,
    maxLevel: 7,
    visibleWhen: (run) => owned(run, "keeper") >= 2,
    priority: 2,
    onBuy: sync,
  },
];

const nightUpgrades: UpgradeDef[] = [
  {
    id: "crank",
    name: "Stronger crank",
    description: "Each turn of the crank makes more power.",
    phases: night,
    currency: "power",
    baseCost: 15,
    costGrowth: 1.25,
    maxLevel: Infinity,
    onBuy: sync,
  },
  {
    id: "gen1",
    name: "Little generator",
    description: "Makes 1 MW all day, if you feed it.",
    phases: night,
    currency: "power",
    baseCost: 25,
    costGrowth: 1.14,
    maxLevel: Infinity,
    visibleWhen: (run) => run.resources.power >= 10,
    priority: 1,
    onBuy: sync,
  },
  {
    id: "lines",
    name: "Run a power line",
    description: "Every line carries 12% more power to the cities.",
    phases: night,
    currency: "power",
    baseCost: 60,
    costGrowth: 1.6,
    maxLevel: 14,
    visibleWhen: (run) => owned(run, "gen1") >= 2,
    onBuy: sync,
  },
  {
    id: "gen2",
    name: "Steam plant",
    description: "Makes 12 MW.",
    phases: night,
    currency: "power",
    baseCost: 500,
    costGrowth: 1.16,
    maxLevel: Infinity,
    visibleWhen: (run) => owned(run, "gen1") >= 6,
    onBuy: sync,
  },
  {
    id: "bulbs",
    name: "Efficient bulbs",
    description: "Cities need 10% less power to stay bright.",
    phases: night,
    currency: "power",
    baseCost: 900,
    costGrowth: 2.1,
    maxLevel: 8,
    visibleWhen: (run) => owned(run, "gen2") >= 2,
    onBuy: sync,
  },
  {
    id: "gen3",
    name: "River dam",
    description: "Makes 150 MW and never needs oil.",
    phases: night,
    currency: "power",
    baseCost: 9000,
    costGrowth: 1.17,
    maxLevel: Infinity,
    visibleWhen: (run) => owned(run, "gen2") >= 6,
    onBuy: sync,
  },
  {
    id: "gen4",
    name: "Wind and sun farm",
    description: "Makes 2,000 MW.",
    phases: night,
    currency: "power",
    baseCost: 120000,
    costGrowth: 1.18,
    maxLevel: Infinity,
    visibleWhen: (run) => owned(run, "gen3") >= 5,
    onBuy: sync,
  },
];

const skyUpgrades: UpgradeDef[] = [
  {
    id: "aim",
    name: "Steadier aim",
    description: "Each aim catches more sunlight.",
    phases: sky,
    currency: "energy",
    baseCost: 12,
    costGrowth: 1.3,
    maxLevel: Infinity,
    onBuy: sync,
  },
  {
    id: "collector",
    name: "Sun collector",
    description: "Catches sunlight all day long.",
    phases: sky,
    currency: "energy",
    baseCost: 25,
    costGrowth: 1.14,
    maxLevel: Infinity,
    priority: 1,
    onBuy: (run) => {
      run.resources.collectors = owned(run, "collector");
      sync(run);
    },
  },
  {
    id: "mirror",
    name: "Bigger mirror",
    description: "Every collector catches 25% more.",
    phases: sky,
    currency: "energy",
    baseCost: 300,
    costGrowth: 1.9,
    maxLevel: 12,
    visibleWhen: (run) => owned(run, "collector") >= 4,
    onBuy: sync,
  },
  {
    id: "probe",
    name: "Launch the first probe",
    description:
      "A small machine that goes to a star, makes a copy of itself, and sends it on.",
    phases: sky,
    currency: "energy",
    baseCost: 1500,
    costGrowth: 1,
    visibleWhen: (run) => owned(run, "collector") >= 8,
    priority: 3,
    onBuy: (run) => {
      run.resources.probes = Math.max(1, run.resources.probes);
      sync(run);
    },
  },
  {
    id: "copy",
    name: "Faster copying",
    description: "Probes make copies of themselves 20% faster.",
    phases: sky,
    currency: "energy",
    baseCost: 2500,
    costGrowth: 1.6,
    maxLevel: 14,
    visibleWhen: (run) => owned(run, "probe") >= 1,
    onBuy: sync,
  },
  {
    id: "engines",
    name: "Quicker engines",
    description: "Probes cross the dark 15% faster.",
    phases: sky,
    currency: "energy",
    baseCost: 3500,
    costGrowth: 1.7,
    maxLevel: 12,
    visibleWhen: (run) => owned(run, "probe") >= 1,
    onBuy: sync,
  },
  {
    id: "appetite",
    name: "Hungrier probes",
    description: "Each probe takes stars 30% faster.",
    phases: sky,
    currency: "energy",
    baseCost: 6000,
    costGrowth: 1.7,
    maxLevel: 12,
    visibleWhen: (run) => owned(run, "probe") >= 1,
    onBuy: sync,
  },
];

const letGoUpgrades: UpgradeDef[] = LET_GO.map((light, i) => ({
  id: light.id,
  name: light.name,
  description: `${light.text} Gives back some energy and lowers the cost of keeping the rest.`,
  phases: last,
  currency: "resolve",
  baseCost: 44 + 21 * i,
  costGrowth: 1,
  priority: 0,
  onBuy: (run: RunState) => {
    run.resources.energy += 200;
    sync(run);
  },
}));

const lastUpgrades: UpgradeDef[] = [
  {
    id: "shield",
    name: "Cup your hands around the flame",
    description: "The remaining lights fade 12% slower.",
    phases: last,
    currency: "energy",
    baseCost: 150,
    costGrowth: 1.5,
    maxLevel: 6,
    priority: 1,
    onBuy: sync,
  },
  {
    id: "glass",
    name: "Polish the old glass",
    description: "Each tap of the flame gives 25% more.",
    phases: last,
    currency: "energy",
    baseCost: 100,
    costGrowth: 1.5,
    maxLevel: 6,
    onBuy: sync,
  },
  {
    id: "remember",
    name: "Remember the very first ship",
    description:
      "One small boat, one lantern, one child waving from the bow. Hold on to that.",
    phases: last,
    currency: "energy",
    baseCost: 300,
    costGrowth: 1,
    visibleWhen: (run) => run.resources.lights <= 1,
    priority: 5,
    onBuy: sync,
  },
];

export const UPGRADES: readonly UpgradeDef[] = [
  ...coastUpgrades,
  ...nightUpgrades,
  ...skyUpgrades,
  ...letGoUpgrades,
  ...lastUpgrades,
  ...BOON_UPGRADES,
];
