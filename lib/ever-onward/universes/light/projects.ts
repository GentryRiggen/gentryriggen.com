import type { ProjectDef, RunState } from "../../engine/types";
import { PHASE_NIGHT, PHASE_SKY } from "./resources";
import { projectPreviewOf, short, type Stat } from "./preview";
import {
  appetite,
  collectorEnergyPerSecond,
  demandMW,
  driftPerSecond,
  flareBonus,
  knowhowPerSecond,
  incomePerSecond,
  powerPerSecond,
  probeEnergyPerSecond,
} from "./tick";
import { TUNING } from "./tuning";
import { litBonus, litNights, rushCarry, rushExcessAt } from "./grid";
import {
  BAROMETERS_ID,
  SPARE_PARTS_ID,
  fixSeconds,
  frontsSoFar,
  readySeconds,
} from "./weather";

/**
 * No More Night's projects, paid mostly in know-how (which every power
 * plant's crew earns, and grid work adds to). A few are on offer at a time,
 * each with a catch, so which one first is the choice. They reveal on
 * milestones only, and nothing on offer ever goes away.
 */

const P = TUNING.projects;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const KNOWHOW = "knowhow";

const POWER_PER_SECOND: Stat = { label: "Power/sec", read: powerPerSecond };
const pct = (n: number): string => `${Math.round(n * 100)}%`;

const cost = (knowhow: number, extra = 0, resource = "power") => [
  { resource: KNOWHOW, amount: knowhow },
  ...(extra > 0 ? [{ resource, amount: extra }] : []),
];

export const NIGHT_PROJECTS: readonly ProjectDef[] = [
  {
    id: "night-school",
    phase: PHASE_NIGHT,
    name: "Night school",
    description:
      "Teach the plant crews the grid's secrets. Everyone learns faster.",
    tradeOff: "Costs power you could put into a generator.",
    costs: cost(15, 150),
    revealWhen: (run) => owned(run, "gen1") >= 1,
    effectPreview: projectPreviewOf("night-school", [
      { label: "Know-how/sec", read: knowhowPerSecond },
    ]),
    botValue: 0.3,
  },
  {
    id: "smart-meters",
    phase: PHASE_NIGHT,
    name: "Smart meters",
    description: "Every home gets a meter, and every city pays 20% more.",
    tradeOff: "Towns want 5% more power, so the night lasts a little longer.",
    costs: cost(50),
    revealWhen: (run) => owned(run, "gen2") >= 1,
    effectPreview: projectPreviewOf("smart-meters", [
      POWER_PER_SECOND,
      { label: "Power demand", read: demandMW, suffix: " MW" },
    ]),
  },
  {
    id: "line-patrols",
    phase: PHASE_NIGHT,
    name: "Line patrols",
    description:
      "Crews walk the lines at dusk. The lines carry the batteries' power 35% faster.",
    tradeOff: `Patrols keep the crews busy: the school teaches ${pct(1 - P.patrolSchool)} less.`,
    costs: cost(70, 1500),
    revealWhen: (run) => owned(run, "gen2") >= 2,
    effectPreview: projectPreviewOf("line-patrols", [
      {
        label: "Batteries can give at once",
        read: rushCarry,
        suffix: " MW",
      },
    ]),
    botValue: 0.15,
  },
  {
    id: BAROMETERS_ID,
    phase: PHASE_NIGHT,
    name: "Better barometers",
    description:
      "Brass barometers in every town. Each forecast is surer, sooner, so your crews know where to go.",
    tradeOff: "Know-how that could go into a power idea instead.",
    costs: cost(100),
    revealWhen: (run) => frontsSoFar(run) >= 1,
    effectPreview: () =>
      `First storm forecast ${pct(TUNING.weather.firm[0])} → ${pct(
        TUNING.weather.firmBarometers[0]
      )} sure · last forecast ${pct(TUNING.weather.firm[2])} → ${pct(
        TUNING.weather.firmBarometers[2]
      )}`,
    botValue: 0.12,
  },
  {
    id: "rush-pricing",
    phase: PHASE_NIGHT,
    name: "Rush-hour pricing",
    description:
      "Power costs a bit more at rush hour. Every night you keep lit pays 50% more.",
    tradeOff: "The evening rush asks 10% more of the batteries.",
    costs: cost(90),
    revealWhen: (run) => litNights(run) >= 3,
    effectPreview: projectPreviewOf("rush-pricing", [
      {
        label: "A lit night pays",
        read: (run) => litBonus(run, incomePerSecond(run)),
      },
    ]),
    botValue: 0.1,
  },
  {
    id: "lamplighters",
    phase: PHASE_NIGHT,
    name: "Town lamplighters",
    description:
      "Neighbours switch off what nobody needs. Towns want 6% less power, so more of them light up.",
    tradeOff: `Less to switch on at night: a lit night pays ${pct(1 - P.lampLitPay)} less.`,
    costs: cost(120),
    revealWhen: (run) => owned(run, "gen2") >= 5,
    effectPreview: projectPreviewOf("lamplighters", [
      { label: "Power demand", read: demandMW, suffix: " MW" },
      {
        label: "A lit night pays",
        read: (run) => litBonus(run, incomePerSecond(run)),
      },
    ]),
    botValue: 0.15,
  },
  {
    id: "co-op",
    phase: PHASE_NIGHT,
    name: "Power co-op",
    description: "The steam plants share their coal. Each one makes 25% more.",
    tradeOff: "The evening rush asks 12% more of the batteries.",
    costs: cost(190),
    // Every steam plant built, the dam still a way off: something to do.
    revealWhen: (run) => owned(run, "gen2") >= 7,
    effectPreview: projectPreviewOf("co-op", [
      POWER_PER_SECOND,
      {
        label: "A usual evening rush",
        read: (run) => rushExcessAt(run, 1, 1) * 100,
        suffix: "% extra",
      },
    ]),
  },
  {
    id: SPARE_PARTS_ID,
    phase: PHASE_NIGHT,
    name: "Spare parts depot",
    description:
      "A shed of ladders, fuses and sandbags. Crews get ready and fix dark towns twice as fast.",
    tradeOff: "Costs power you could put into a plant.",
    costs: cost(140, 4000),
    revealWhen: (run) =>
      (run.resources.wxFlickered ?? 0) >= 1 || frontsSoFar(run) >= 3,
    effectPreview: projectPreviewOf(SPARE_PARTS_ID, [
      { label: "Repair crew ready in", read: readySeconds, suffix: " s" },
      { label: "Repairs take", read: fixSeconds, suffix: " s" },
    ]),
    botValue: 0.12,
  },
  {
    id: "fish-ladders",
    phase: PHASE_NIGHT,
    name: "Fish ladders",
    description:
      "Little steps let the fish swim past the dams. The river runs easy, and every dam makes 40% more.",
    tradeOff: "Costs power you could put into the next dam.",
    costs: cost(150, 8000),
    revealWhen: (run) => owned(run, "gen3") >= 1,
    effectPreview: projectPreviewOf("fish-ladders", [POWER_PER_SECOND]),
  },
  {
    id: "wind-maps",
    phase: PHASE_NIGHT,
    name: "Wind maps",
    description:
      "Chart where the wind blows hardest. Every wind and sun farm makes 25% more.",
    tradeOff: "Costs power now, and only helps once a farm is built.",
    costs: cost(250, 30000),
    revealWhen: (run) => owned(run, "gen3") >= 4,
    effectPreview: (run) =>
      owned(run, "gen4") > 0
        ? projectPreviewOf("wind-maps", [POWER_PER_SECOND])(run)
        : `Each farm makes ${short(3000 * P.windBoost)} MW, not 3,000`,
    botValue: 0.2,
  },
];

/**
 * The Sky's projects: the same know-how, earned by collectors and the fleet,
 * wanted by overdrive too (see overdrive.ts). Each has a catch.
 */
export const SKY_PROJECTS: readonly ProjectDef[] = [
  {
    id: "star-atlas",
    phase: PHASE_SKY,
    name: "Star atlas",
    description:
      "Chart where every star will be next week. Probes take stars 60% faster.",
    tradeOff: "Costs energy you could put into a collector.",
    costs: cost(40, 900, "energy"),
    revealWhen: (run) => owned(run, "probe") >= 1,
    effectPreview: projectPreviewOf("star-atlas", [
      { label: "Star taking", read: appetite, suffix: "×" },
    ]),
    botValue: 0.25,
  },
  {
    id: "mirror-polish",
    phase: PHASE_SKY,
    name: "Mirror polish",
    description:
      "A rag, a ladder and a very long Saturday. Every collector catches 60% more.",
    tradeOff: "The glare confuses the fleet: its heading drifts 25% faster.",
    costs: cost(70),
    revealWhen: (run) => owned(run, "collector") >= 5,
    effectPreview: projectPreviewOf("mirror-polish", [
      { label: "Energy/sec", read: collectorEnergyPerSecond },
      {
        label: "Fleet drift",
        read: (run) => driftPerSecond(run) * 60,
        suffix: "% a minute",
      },
    ]),
  },
  {
    id: "relay-codes",
    phase: PHASE_SKY,
    name: "Relay codes",
    description:
      "Teach the relays to say thank you. Every star taken pays 50% more.",
    tradeOff: "Costs energy you could put into a mirror.",
    costs: cost(100, 6000, "energy"),
    revealWhen: (run) => (run.resources.starsTaken ?? 0) >= 40,
    effectPreview: projectPreviewOf("relay-codes", [
      { label: "Probe energy/sec", read: probeEnergyPerSecond },
    ]),
    botValue: 0.15,
  },
  {
    id: "probe-school",
    phase: PHASE_SKY,
    name: "Probe school",
    description:
      "Young probes learn to copy themselves from older ones. Copying is 50% faster.",
    tradeOff: "The older ones hog the dish: flares come 30% less often.",
    costs: cost(140),
    revealWhen: (run) => owned(run, "copy-1") >= 1,
    effectPreview: () => "Probes copy 1.5× as fast · flares 1.3× as far apart",
    botValue: 0.3,
  },
  {
    id: "flare-watch",
    phase: PHASE_SKY,
    name: "Flare watchers",
    description:
      "A night shift that does nothing but watch the sun. Flares come 20% sooner and pay 60% more.",
    tradeOff: "Costs energy you could put into a collector.",
    costs: cost(90, 2500, "energy"),
    revealWhen: (run) => (run.resources.flaresCaught ?? 0) >= 1,
    effectPreview: projectPreviewOf("flare-watch", [
      { label: "A flare pays", read: flareBonus },
    ]),
    botValue: 0.1,
  },
];

export const ALL_PROJECTS: readonly ProjectDef[] = [
  ...NIGHT_PROJECTS,
  ...SKY_PROJECTS,
];
