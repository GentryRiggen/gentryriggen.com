import type { ProjectDef, RunState } from "../../engine/types";
import { PHASE_NIGHT } from "./resources";
import { projectPreviewOf, short, type Stat } from "./preview";
import {
  demandMW,
  glowBonus,
  knowhowPerSecond,
  powerPerSecond,
  rushBonus,
  strainPerSecond,
} from "./tick";
import { TUNING } from "./tuning";

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

const cost = (knowhow: number, power = 0) => [
  { resource: KNOWHOW, amount: knowhow },
  ...(power > 0 ? [{ resource: "power", amount: power }] : []),
];

export const NIGHT_PROJECTS: readonly ProjectDef[] = [
  {
    id: "night-school",
    phase: PHASE_NIGHT,
    name: "Night school",
    description:
      "Teach the plant crews the grid's secrets. Everyone learns faster.",
    tradeOff: "Costs power you could put into a generator.",
    costs: cost(10, 150),
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
    costs: cost(30),
    revealWhen: (run) => owned(run, "gen2") >= 1,
    effectPreview: projectPreviewOf("smart-meters", [
      POWER_PER_SECOND,
      { label: "Demand", read: demandMW, suffix: " MW" },
    ]),
  },
  {
    id: "line-patrols",
    phase: PHASE_NIGHT,
    name: "Line patrols",
    description: "Crews walk the lines at dusk. The grid strains 30% slower.",
    tradeOff: `Balancing by hand teaches less: +${P.patrolBalance} know-how, not +${P.perBalance}.`,
    costs: cost(40, 1500),
    revealWhen: (run) => owned(run, "gen2") >= 2,
    effectPreview: projectPreviewOf("line-patrols", [
      {
        label: "Strain",
        read: (run) => strainPerSecond(run) * 60,
        suffix: "% a minute",
      },
    ]),
    botValue: 0.15,
  },
  {
    id: "rush-pricing",
    phase: PHASE_NIGHT,
    name: "Rush-hour pricing",
    description:
      "Power costs a bit more at rush hour. Every rush pays 50% more.",
    tradeOff: "The rush comes a quarter less often.",
    costs: cost(55),
    revealWhen: (run) => (run.resources.rushRides ?? 0) >= 3,
    effectPreview: projectPreviewOf("rush-pricing", [
      { label: "A rush pays", read: rushBonus },
    ]),
    botValue: 0.1,
  },
  {
    id: "lamplighters",
    phase: PHASE_NIGHT,
    name: "Town lamplighters",
    description:
      "Neighbours switch off what nobody needs. Towns want 6% less power, so more of them light up.",
    tradeOff: `The steady glow pays +${pct(P.lampGlowBonus)}, not +${pct(TUNING.night.glowBonus)}.`,
    costs: cost(70),
    revealWhen: (run) => owned(run, "gen2") >= 5,
    effectPreview: projectPreviewOf("lamplighters", [
      { label: "Demand", read: demandMW, suffix: " MW" },
      {
        label: "Steady glow",
        read: glowBonus,
        format: (v) => `+${pct(v)}`,
      },
    ]),
    botValue: 0.15,
  },
  {
    id: "fish-ladders",
    phase: PHASE_NIGHT,
    name: "Fish ladders",
    description:
      "Little steps let the fish swim past the dams. The river runs easy, and every dam makes 40% more.",
    tradeOff: "Costs power you could put into the next dam.",
    costs: cost(90, 8000),
    revealWhen: (run) => owned(run, "gen3") >= 1,
    effectPreview: projectPreviewOf("fish-ladders", [POWER_PER_SECOND]),
  },
  {
    id: "co-op",
    phase: PHASE_NIGHT,
    name: "Power co-op",
    description: "The steam plants share their coal. Each one makes 25% more.",
    tradeOff: "The grid strains 15% faster.",
    costs: cost(110),
    revealWhen: (run) => owned(run, "gen3") >= 2,
    effectPreview: projectPreviewOf("co-op", [
      POWER_PER_SECOND,
      {
        label: "Strain",
        read: (run) => strainPerSecond(run) * 60,
        suffix: "% a minute",
      },
    ]),
  },
  {
    id: "wind-maps",
    phase: PHASE_NIGHT,
    name: "Wind maps",
    description:
      "Chart where the wind blows hardest. Every wind and sun farm makes 25% more.",
    tradeOff: "Costs power now, and only helps once a farm is built.",
    costs: cost(150, 30000),
    revealWhen: (run) => owned(run, "gen3") >= 4,
    effectPreview: (run) =>
      owned(run, "gen4") > 0
        ? projectPreviewOf("wind-maps", [POWER_PER_SECOND])(run)
        : `Each farm makes ${short(3000 * P.windBoost)} MW, not 3,000`,
    botValue: 0.2,
  },
];
