import { projectDoneFlag } from "../../engine/engine";
import { formatNumber } from "../../engine/format";
import type { ActionDef, ProjectDef, RunState } from "../../engine/types";
import { forkParadeMult } from "./forks";
import { heatOf, isTired } from "./meter";
import { COINS, townMult } from "./town";
import { PHASE_TOWN, PHASE_WORLD } from "./resources";
import { TUNING } from "./tuning";

/**
 * Know-how: the town's and the world's one second resource, and the place
 * where you have to choose. Every helper learns a little while it works, so
 * know-how trickles in. There are two hungry things to spend it on:
 *  - projects: a few permanent ideas (a big top, shady corners, a handbook),
 *    each one a big, lasting step;
 *  - a parade (a cheer broadcast in the world): a burst of extra pay for a
 *    short while, as often as you can afford it and the crowd has the energy.
 * Know-how spent on one is not there for the other, and nothing is luck.
 *
 * All state is hidden resources, `knowhow` and `pdLeft` (seconds of parade
 * left), plus the engine's project flags, so a save from before reads as no
 * know-how, no parade and no projects done.
 */

const K = TUNING.knowhow;
const T = TUNING.town;

export const KNOWHOW = "knowhow";
export const PARADE_ACTION_ID = "parade-start";
export const PARADE_NAMES = ["", "Parade", "Cheer broadcast"] as const;
export const BROADCAST_NAME = PARADE_NAMES[2];

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const res = (run: RunState, id: string): number => run.resources[id] ?? 0;

/** Know-how and the broadcast are the world's; the town has coins. */
export const hasKnowhow = (run: RunState): boolean => run.phase === 2;

const WORLD_LINES = ["poster", "loudspeaker", "cheer-tower", "cheer-blimp"];

/** Know-how each second: every level of every helper learns a little. */
export function knowhowPerSecond(run: RunState): number {
  if (!hasKnowhow(run)) return 0;
  return (
    WORLD_LINES.reduce((sum, id) => sum + owned(run, id), 0) *
    K.perLevel *
    K.worldRate
  );
}

export const knowhowOf = (run: RunState): number => res(run, KNOWHOW);

export const isProjectDone = (run: RunState, id: string): boolean =>
  run.flags[projectDoneFlag(id)] === true;

// -------------------------------------------------------------------- parade

/** Seconds of the whole parade cycle left: the show, then a short rest. */
export const paradeLeft = (run: RunState): number => res(run, "pdLeft");
export const isParadeOn = (run: RunState): boolean =>
  paradeLeft(run) > K.paradeRest;
/** The show is over and the crowd is catching its breath. */
export const isParadeResting = (run: RunState): boolean =>
  paradeLeft(run) > 0 && !isParadeOn(run);
export const paradesSoFar = (run: RunState): number => res(run, "pdCount");
export const paradeCost = (): number => K.paradeCost;

/** Seconds a parade lasts. */
export const paradeSeconds = (): number => K.paradeSeconds;

/** A dictionary of cheers makes every broadcast pay half as much again. */
const bigTopMult = (run: RunState): number =>
  isProjectDone(run, "every-language") ? K.bigTopMult : 1;

/** The parade shows once the part has a few helpers learning. */
export const isParadeOpen = (run: RunState): boolean =>
  hasKnowhow(run) && owned(run, "poster") >= 2;

/** Pay while a parade is on (1 otherwise). */
export const paradeMult = (run: RunState): number =>
  hasKnowhow(run) && isParadeOn(run) ? forkParadeMult() * bigTopMult(run) : 1;

/** The crowd can take a parade when the meter is cool enough. */
export const canParade = (run: RunState): boolean =>
  !isTired(run) && heatOf(run) <= TUNING.meter.paradeMaxHeat;

function startParade(run: RunState): void {
  run.resources.pdLeft = paradeSeconds() + K.paradeRest;
  run.resources.pdCount = paradesSoFar(run) + 1;
}

/** Runs the know-how for `dt` seconds and the parade down. */
export function tickKnowhow(run: RunState, dt: number): void {
  if (res(run, "pdLeft") > 0)
    run.resources.pdLeft = Math.max(0, res(run, "pdLeft") - dt);
  if (!hasKnowhow(run)) return;
  run.resources[KNOWHOW] = knowhowOf(run) + knowhowPerSecond(run) * dt;
}

export const PARADE_ACTIONS: readonly ActionDef[] = [
  {
    id: PARADE_ACTION_ID,
    phases: [PHASE_WORLD],
    isInline: true,
    visibleWhen: isParadeOpen,
    describe: (run) => {
      const on = isParadeOn(run);
      const resting = isParadeResting(run);
      const rested = canParade(run);
      return {
        label: on
          ? `${PARADE_NAMES[run.phase]} is on`
          : resting
            ? "Everyone is catching their breath"
            : `Start a ${PARADE_NAMES[run.phase].toLowerCase()}`,
        detail: rested
          ? `Everything pays ${Number((forkParadeMult() * bigTopMult(run)).toFixed(2))}x for ${paradeSeconds()} seconds, and it warms the cheer meter. Best when the meter is cool.`
          : "The crowd is too warm for a parade right now. Wait for the cheer meter to cool.",
        cost: { resource: KNOWHOW, amount: K.paradeCost },
        isBlocked: on || resting || !rested,
      };
    },
    perform: (run) => startParade(run),
  },
];

// ------------------------------------------------------------------- projects

/** "×2 → ×3": a project's before-to-after multiplier. */
const times = (before: number, after: number): string =>
  `×${formatNumber(Math.round(before * 100) / 100)} → ×${formatNumber(Math.round(after * 100) / 100)}`;

/** "×2": a project's multiplier, no more digits than it needs. */
const mult = (n: number): string => `×${Number(n.toFixed(2))}`;

/** The meter cools twice as fast with quiet hours. */
export const coolProjectMult = (run: RunState): number =>
  run.phase === 2 && isProjectDone(run, "quiet-hours") ? K.coolMult : 1;

/** Confetti cannons and the grin guide: everything pays twice, always. */
export const projectIncomeMult = (run: RunState): number =>
  (run.phase === 1 && isProjectDone(run, "confetti-cannons")) ||
  (run.phase === 2 && isProjectDone(run, "grin-guide"))
    ? K.allMult
    : 1;

/** Everything that multiplies the pay of the town or the world right now. */
export const phaseBoost = (run: RunState): number =>
  (run.phase === 1 ? townMult(run) : paradeMult(run)) * projectIncomeMult(run);

const cost = (amount: number) => [{ resource: KNOWHOW, amount }];
const coinCost = (amount: number) => [{ resource: COINS, amount }];

export const SMILE_PROJECTS: readonly ProjectDef[] = [
  {
    id: "big-top",
    phase: PHASE_TOWN,
    name: "A big top tent",
    description:
      "Stripes, a trapeze and room for the whole town. Every float cheers its street half as much again.",
    tradeOff: "Coins spent here are not there for another float.",
    costs: coinCost(K.townCosts[0]),
    revealWhen: (run) => owned(run, "clown") >= 2,
    effectPreview: () => `A float cheers ${mult(T.bigTopCare)} as much`,
    botValue: 0.3,
  },
  {
    id: "shady-corners",
    phase: PHASE_TOWN,
    name: "Shady rest corners",
    description:
      "Little shaded corners with a lemonade jug in every street. A street with no float takes twice as long to turn grumpy.",
    tradeOff: "It only helps the streets you leave without a float.",
    costs: coinCost(K.townCosts[1]),
    revealWhen: (run) => owned(run, "band") >= 2,
    effectPreview: () =>
      `A skipped street turns grumpy ${mult(1 / T.shadeFall)} slower`,
    botValue: 0.3,
  },
  {
    id: "confetti-cannons",
    phase: PHASE_TOWN,
    name: "Confetti cannons",
    description:
      "One on every roof, set off by a cheerful string. The whole town pays twice as many cheers, all the time.",
    tradeOff: "It costs a lot of coins, which floats would have used.",
    costs: coinCost(K.townCosts[2]),
    revealWhen: (run) => owned(run, "smile-factory") >= 1,
    effectPreview: () => `Every street pays ${mult(K.allMult)} the cheers`,
  },
  {
    id: "quiet-hours",
    phase: PHASE_WORLD,
    name: "Quiet hours",
    description:
      "One hour a day when the loudspeakers go soft and everyone smiles very quietly. The cheer meter cools twice as fast.",
    tradeOff: "Know-how spent here is not there for a cheer broadcast.",
    costs: cost(K.costs[0]),
    revealWhen: (run) => owned(run, "loudspeaker") >= 1,
    effectPreview: () =>
      `The cheer meter cools ${mult(K.coolMult)} as fast · a worn-out crowd pays less`,
    botValue: 0.3,
  },
  {
    id: "every-language",
    phase: PHASE_WORLD,
    name: "Cheer in every language",
    description:
      "A dictionary of ways to say have a nice day. Every cheer broadcast pays half as much again.",
    tradeOff: "Know-how spent here is not there for a broadcast today.",
    costs: cost(K.costs[1]),
    revealWhen: (run) => owned(run, "poster") >= 3,
    effectPreview: () =>
      `A broadcast pays ${times(forkParadeMult(), forkParadeMult() * K.bigTopMult)}`,
    botValue: 0.4,
  },
  {
    id: "grin-guide",
    phase: PHASE_WORLD,
    name: "The Official Grin Guide",
    description:
      "A handbook for correct smiling. Page one says to do it all the time. Every place pays twice as many grins.",
    tradeOff: "It costs a lot of know-how, which a broadcast would have used.",
    costs: cost(K.costs[2]),
    revealWhen: (run) => owned(run, "cheer-tower") >= 1,
    effectPreview: () => `Every place pays ${mult(K.allMult)} the grins`,
  },
];
