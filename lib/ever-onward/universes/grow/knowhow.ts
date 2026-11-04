import { projectDoneFlag } from "../../engine/engine";
import type { ActionDef, ProjectDef, RunState } from "../../engine/types";
import { PHASE_FARM, PHASE_WORLD } from "./resources";
import { TUNING } from "./tuning";

/**
 * Know-how: the farm's and the world's one second resource, and the place
 * where you have to choose. Every helper you own learns a little while it
 * works, so know-how trickles in. There are two hungry things to spend it on:
 *  - projects: a few permanent ideas (drip lines, a roadside stand, a hybrid
 *    seed), each one a big, lasting step;
 *  - a festival: a burst of double pay for a short while, as often as you can
 *    afford it. Best when the towns want what you grow, or just before a big
 *    purchase.
 * Money spent on one is not there for the other, and nothing here is luck:
 * every project and every festival does exactly what its card says.
 *
 * All state is hidden resources, `knowhow` and `fsLeft` (seconds of festival
 * left), plus the engine's project flags, so a save from before reads as no
 * know-how, no festival and no projects done.
 */

const K = TUNING.knowhow;

export const KNOWHOW = "knowhow";
export const FESTIVAL_ACTION_ID = "festival-start";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const res = (run: RunState, id: string): number => run.resources[id] ?? 0;

/** The two parts that have know-how and festivals. */
export const hasKnowhow = (run: RunState): boolean =>
  run.phase === 1 || run.phase === 2;

const FARM_LINES = ["scarecrow", "tractor", "glasshouse", "seed-drone"];
const WORLD_LINES = ["windbreak", "planting-rover", "sky-seeder"];

/** Know-how each second: every level of every helper learns a little. */
export function knowhowPerSecond(run: RunState): number {
  if (!hasKnowhow(run)) return 0;
  const lines = run.phase === 1 ? FARM_LINES : WORLD_LINES;
  return (
    lines.reduce((sum, id) => sum + owned(run, id), 0) *
    K.perLevel *
    (run.phase === 2 ? K.worldRate : 1)
  );
}

export const knowhowOf = (run: RunState): number => res(run, KNOWHOW);

export const isProjectDone = (run: RunState, id: string): boolean =>
  run.flags[projectDoneFlag(id)] === true;

// ------------------------------------------------------------------ festival

/** Seconds of festival left (0 when none is on). */
export const festivalLeft = (run: RunState): number => res(run, "fsLeft");

export const isFestivalOn = (run: RunState): boolean => festivalLeft(run) > 0;

/** Festivals held so far. */
export const festivalsSoFar = (run: RunState): number => res(run, "fsCount");

/** What a festival costs, in know-how. */
export const festivalCost = (): number => K.festivalCost;

/** The festival shows once the part has a few helpers learning. */
export const isFestivalOpen = (run: RunState): boolean =>
  hasKnowhow(run) &&
  (run.phase === 1
    ? owned(run, "scarecrow") >= 2
    : owned(run, "windbreak") >= 2);

export const FESTIVAL_NAMES = ["", "Harvest festival", "Green day"] as const;

/** Pay while a festival is on (1 otherwise). */
export const festivalMult = (run: RunState): number =>
  hasKnowhow(run) && isFestivalOn(run) ? K.festivalMult : 1;

function startFestival(run: RunState): void {
  run.resources.fsLeft = K.festivalSeconds;
  run.resources.fsCount = festivalsSoFar(run) + 1;
}

/** Runs the know-how for `dt` seconds and the festival down. */
export function tickKnowhow(run: RunState, dt: number): void {
  if (res(run, "fsLeft") > 0)
    run.resources.fsLeft = Math.max(0, res(run, "fsLeft") - dt);
  if (!hasKnowhow(run)) return;
  run.resources[KNOWHOW] = knowhowOf(run) + knowhowPerSecond(run) * dt;
}

export const FESTIVAL_ACTIONS: readonly ActionDef[] = [
  {
    id: FESTIVAL_ACTION_ID,
    phases: [PHASE_FARM, PHASE_WORLD],
    isInline: true,
    visibleWhen: isFestivalOpen,
    describe: (run) => {
      const on = isFestivalOn(run);
      return {
        label: on
          ? `${FESTIVAL_NAMES[run.phase]} is on`
          : `Hold a ${FESTIVAL_NAMES[run.phase].toLowerCase()}`,
        detail: `Everything pays ${K.festivalMult}x for ${K.festivalSeconds} seconds. Best while the towns want what you grow, or just before something big.`,
        cost: { resource: KNOWHOW, amount: K.festivalCost },
        isBlocked: on,
      };
    },
    perform: (run) => startFestival(run),
  },
];

// ------------------------------------------------------------------- projects

/** "×2", "×1.5": a project's multiplier, no more digits than it needs. */
const times = (n: number): string => `×${Number(n.toFixed(2))}`;

/** "half as much" for 0.5, "×0.7 as much" otherwise. */
const asMuch = (n: number): string =>
  n === 0.5 ? "half as much" : `${times(n)} as much`;

/** Farm: drip lines hold twice the water and cut the thirst. */
export const dripLines = (run: RunState): boolean =>
  isProjectDone(run, "drip-lines");
/** World: rain gauges do the same for the planet. */
export const rainGauges = (run: RunState): boolean =>
  isProjectDone(run, "rain-gauges");

/** Water: how much more the tank holds (1 without the project). */
export const waterProjectCapacity = (run: RunState): number =>
  (run.phase === 1 && dripLines(run)) || (run.phase === 2 && rainGauges(run))
    ? K.tankMult
    : 1;

/** Water: how much less the land drinks (1 without the project). */
export const waterProjectThirst = (run: RunState): number =>
  (run.phase === 1 && dripLines(run)) || (run.phase === 2 && rainGauges(run))
    ? K.thirstMult
    : 1;

/** Farm: a cold store makes the seed bank's seed spoil half as fast. */
export const bankSpoilMult = (run: RunState): number =>
  isProjectDone(run, "cold-store") ? K.coldStoreSpoil : 1;

/** Farm hybrid seed and world wildlife corridors: all pay more, always. */
export const projectIncomeMult = (run: RunState): number =>
  run.phase === 1 && isProjectDone(run, "hybrid-seed")
    ? K.hybridMult
    : run.phase === 2 && isProjectDone(run, "wildlife-corridors")
      ? K.corridorMult
      : 1;

/** World: a tree nursery makes the green spread faster. */
export const nurserySpread = (run: RunState): number =>
  isProjectDone(run, "tree-nursery") ? K.nurserySpread : 1;

/** Everything that multiplies the pay of the farm or the world right now. */
export const phaseBoost = (run: RunState): number =>
  festivalMult(run) * projectIncomeMult(run);

const cost = (amount: number) => [{ resource: KNOWHOW, amount }];

export const GROW_PROJECTS: readonly ProjectDef[] = [
  {
    id: "drip-lines",
    phase: PHASE_FARM,
    name: "Drip lines",
    description:
      "Little pipes carry water straight to the roots. The tank holds twice as much, and the crops drink half as much.",
    tradeOff: "Know-how spent here is not there for a festival.",
    costs: cost(K.costs[0]),
    revealWhen: (run) => owned(run, "well") >= 1,
    effectPreview: () =>
      `The tank holds ${times(K.tankMult)} the water · crops drink ${asMuch(K.thirstMult)}`,
    botValue: 0.3,
  },
  {
    id: "cold-store",
    phase: PHASE_FARM,
    name: "A cold store",
    description:
      "A cool, dark shed under the hill. Seed in the bank keeps twice as long, so a smaller share does the work of a bigger one.",
    tradeOff: "It only helps if you keep some seed back.",
    costs: cost(K.costs[1]),
    revealWhen: (run) => owned(run, "scarecrow") >= 3,
    effectPreview: () =>
      `Banked seed lasts ${times(1 / K.coldStoreSpoil)} as long`,
    botValue: 0.35,
  },
  {
    id: "hybrid-seed",
    phase: PHASE_FARM,
    name: "Hybrid seed",
    description:
      "Two good crops, introduced at a party. Their children pay twice as much, in every field, all the time.",
    tradeOff: "It costs a lot of know-how, which a festival would have used.",
    costs: cost(K.costs[2]),
    revealWhen: (run) => owned(run, "tractor") >= 2,
    effectPreview: () => `Every field pays ${times(K.hybridMult)} the harvest`,
  },
  {
    id: "rain-gauges",
    phase: PHASE_WORLD,
    name: "Rain gauges",
    description:
      "A little tin gauge in every region tells the clouds where it is dry. The world holds twice the water and drinks half as much.",
    tradeOff: "Know-how spent here is not there for a green day.",
    costs: cost(K.costs[0]),
    revealWhen: (run) => owned(run, "river-bend") >= 1,
    effectPreview: () =>
      `The world holds ${times(K.tankMult)} the water · and drinks ${asMuch(K.thirstMult)}`,
    botValue: 0.3,
  },
  {
    id: "tree-nursery",
    phase: PHASE_WORLD,
    name: "A tree nursery",
    description:
      "Rows of seedlings waiting for a home. Whatever is spreading spreads twice as fast.",
    tradeOff: "It only helps what is spreading, so choose that first.",
    costs: cost(K.costs[1]),
    revealWhen: (run) => owned(run, "windbreak") >= 3,
    effectPreview: () => `Spreading goes ${times(K.nurserySpread)} as fast`,
    botValue: 0.4,
  },
  {
    id: "wildlife-corridors",
    phase: PHASE_WORLD,
    name: "Wildlife corridors",
    description:
      "Green paths for deer and foxes to cross the map. The whole world pays twice as much green, all the time.",
    tradeOff: "It costs a lot of know-how, which a green day would have used.",
    costs: cost(K.costs[2]),
    revealWhen: (run) => owned(run, "planting-rover") >= 2,
    effectPreview: () => `Every place pays ${times(K.corridorMult)} the green`,
  },
];
