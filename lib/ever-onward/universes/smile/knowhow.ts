import { projectDoneFlag } from "../../engine/engine";
import { formatNumber } from "../../engine/format";
import type { ActionDef, ProjectDef, RunState } from "../../engine/types";
import { forkParadeMult } from "./forks";
import { COINS, townMult } from "./town";
import { PHASE_TOWN, PHASE_WORLD } from "./resources";
import { TUNING } from "./tuning";
import { launchDrones, paintOver, restoreSmiles } from "./world";

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
const W = TUNING.world;

/** A share of the crowd a second, as a share a minute ("7%"). */
const perMin = (n: number): string => `${Number((n * 6000).toFixed(1))}%`;

export const KNOWHOW = "knowhow";
export const PARADE_ACTION_ID = "parade-start";
/** The world's parade: the cheer broadcast (the town's route has no parade). */
export const BROADCAST_NAME = "Cheer broadcast";

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
      return {
        label: on
          ? `${BROADCAST_NAME} is on`
          : resting
            ? "Everyone is catching their breath"
            : `Start a ${BROADCAST_NAME.toLowerCase()}`,
        detail: `Everything pays ${Number((forkParadeMult() * bigTopMult(run)).toFixed(2))}x for ${paradeSeconds()} seconds. Real smiles get painted over ${Math.round((TUNING.world.broadcastPaint - 1) * 100)}% faster while it plays.`,
        cost: { resource: KNOWHOW, amount: K.paradeCost },
        isBlocked: on || resting,
      };
    },
    perform: (run) => startParade(run),
  },
];

// ------------------------------------------------------------------- projects

/** "×2 → ×3": a project's before-to-after multiplier. */
/** "×2": a project's multiplier, no more digits than it needs. */
const mult = (n: number): string => `×${Number(n.toFixed(2))}`;

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
      "One hour a day when the loudspeakers go soft and everyone smiles very quietly.",
    tradeOff: `Grins pay ${mult(W.quietHoursPay)}, slower all day long.`,
    costs: cost(K.costs[0]),
    revealWhen: (run) => owned(run, "loudspeaker") >= 1,
    effectPreview: () =>
      `+ Real smiles get painted over ${mult(1 / W.quietHoursPaint)} slower\n− Every place pays ${mult(W.quietHoursPay)} the grins`,
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
      `+ A broadcast pays ${mult(forkParadeMult() * K.bigTopMult)} instead of ${mult(forkParadeMult())}\n− It still paints real smiles over faster`,
    botValue: 0.4,
  },
  {
    id: "smile-filters",
    phase: PHASE_WORLD,
    name: "Smile filters",
    description:
      "A little app that paints a grin on every photo, and then on every face that looks at one.",
    tradeOff: "Painted grins keep spreading, whatever the loudspeakers do.",
    costs: cost(K.costs[0]),
    revealWhen: (run) => owned(run, "poster") >= 2,
    effectPreview: () =>
      `+ Every place pays ${mult(W.filtersPay)} the grins\n− Real smiles lose ${perMin(W.filtersDrift)} a minute`,
    botValue: 0.2,
  },
  {
    id: "grin-guide",
    phase: PHASE_WORLD,
    name: "The Official Grin Guide",
    description:
      "A handbook for correct smiling. Page one says to do it all the time.",
    tradeOff:
      "A lot of know-how, and the first faces learn it by heart at once.",
    costs: cost(K.costs[2]),
    revealWhen: (run) => owned(run, "cheer-tower") >= 1,
    effectPreview: () =>
      `+ Every place pays ${mult(K.allMult)} the grins\n− ${Math.round(W.guideLoss * 100)}% of real smiles painted over at once`,
    onDone: (run) => paintOver(run, W.guideLoss),
  },
  {
    id: "hypno-drones",
    phase: PHASE_WORLD,
    name: "HypnoDrones",
    description:
      "A swarm of little drones that hum a swirly tune. Whoever looks up grins and cannot stop. It is the biggest crowd-pleaser ever made.",
    tradeOff:
      "Whoever looks up stops smiling for real, and it does not wear off.",
    costs: cost(K.costs[2]),
    revealWhen: (run) => owned(run, "cheer-tower") >= 1,
    effectPreview: () =>
      `+ Every place pays ${mult(W.dronesPay)} the grins\n− ${Math.round(W.dronesLoss * 100)}% of real smiles painted over at once, and ${perMin(W.dronesDrift)} more a minute\n− Real smiles come back a quarter as fast, for good`,
    onDone: (run) => launchDrones(run),
  },
  {
    id: "listening-benches",
    phase: PHASE_WORLD,
    name: "Listening benches",
    description:
      "A bench in every square with a sign: sit here and tell someone how you really are. Someone sits and listens.",
    tradeOff: `Slow work. Grins pay ${mult(W.benchesPay)} while helpers keep it up.`,
    costs: cost(K.costs[1]),
    revealWhen: (run) => owned(run, "poster") >= 4,
    effectPreview: () =>
      `+ ${Math.round(W.benchesGain * 100)}% of the smiles are real again at once, and ${perMin(W.benchesHeal)} more a minute\n− Every place pays ${mult(W.benchesPay)} the grins`,
    onDone: (run) => restoreSmiles(run),
  },
];
