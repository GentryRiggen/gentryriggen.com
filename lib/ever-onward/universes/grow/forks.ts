import { formatNumber } from "../../engine/format";
import type { ActionDef, RunState } from "../../engine/types";
import {
  PHASE_FARM,
  PHASE_IDS,
  PHASE_SEED,
  PHASE_WORLD,
  PHASE_YARD,
  type GrowPhaseId,
} from "./resources";
import { TUNING } from "./tuning";

/**
 * Forks: one either-or choice in every part of the game. Buying one side
 * locks the other for the rest of this run, so each side is a different way
 * to play, with a different picture, different numbers and a catch that is
 * told plainly on the card before anything is spent:
 *  - the backyard: ask the bees, or reach for the bug spray;
 *  - the farm: a crew of scarecrows, or a hired hawk;
 *  - the world: grow old forest, or bring back wetland;
 *  - the old window box: morning sun for the pot, or a night-light.
 * Nothing is ever lost by waiting, and nothing is a trap: both sides finish
 * their part in about the same time, one by hand and one while you rest.
 *
 * The choice lives in one hidden resource per fork (0 not chosen, 1 the
 * first side, 2 the second), so a save from before forks existed simply
 * reads as "not chosen" and plays exactly as it did.
 */

const T = TUNING.forks;

export type ForkId = "yard" | "farm" | "world" | "seed";
export type ForkSide = 0 | 1;

export interface ForkSideDef {
  name: string;
  /** What it does, in plain words. */
  blurb: string;
  /** The catch, told plainly. */
  catchLine: string;
}

export interface ForkDef {
  id: ForkId;
  phase: GrowPhaseId;
  resource: string;
  title: string;
  prompt: string;
  /** What buying a side costs: the phase's own currency, before costScale. */
  currency: string;
  baseCost: number;
  /** The fork shows from this point. */
  opensWhen(run: RunState): boolean;
  sides: readonly [ForkSideDef, ForkSideDef];
}

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const times = (n: number): string => `${Number(n.toFixed(2))}x`;

export const FORKS: readonly ForkDef[] = [
  {
    id: "yard",
    phase: PHASE_YARD,
    resource: "fkYard",
    title: "Aphids on the roses",
    prompt:
      "A cloud of aphids has found the garden. You can ask the bees and ladybirds to sort it out, or you can reach for the spray. Only one of these works out, and the garden remembers.",
    currency: "seeds",
    baseCost: T.yard.cost,
    opensWhen: (run) => owned(run, "sprinkler") >= 3,
    sides: [
      {
        name: "Ask the bees",
        blurb:
          "Ladybirds, hoverflies and a hive of bees. They take a little while to turn up, and then bee hives, the bee dance, the keeper and the orchard's full harvest all open up.",
        catchLine: "It takes time, and the sprinklers stay as they are.",
      },
      {
        name: "Bug spray",
        blurb: `The bugs go at once and every sprinkler ripens ${times(T.yard.sprayRipen)} as much. The bees go too, so there are no hives and no dances, and the orchard sets only ${times(T.yard.sprayOrchard)}.`,
        catchLine: "No bees, ever. Not one.",
      },
    ],
  },
  {
    id: "farm",
    phase: PHASE_FARM,
    resource: "fkFarm",
    title: "Crows in the corn",
    prompt:
      "The crows have noticed the rows. A friendly line of scarecrows will see them off in time. A hired hawk is quicker, and has views about the county fair.",
    currency: "harvest",
    baseCost: T.farm.cost,
    opensWhen: (run) => owned(run, "tractor") >= 2,
    sides: [
      {
        name: "Scarecrow crew",
        blurb: `Fields pay ${times(T.farm.crewIncome)}, the crops drink ${Math.round((1 - T.farm.crewThirst) * 100)}% less and the county fair pays ${times(T.farm.crewFair)} ribbons. The crows learn to ignore them, but only slowly.`,
        catchLine: `Fields pay ${times(T.farm.hawkIncome)} with a hawk, so you give up some now.`,
      },
      {
        name: "Hired hawk",
        blurb: `Fields pay ${times(T.farm.hawkIncome)} the moment she lands. She also frightens the fair judges, so the county fair stays at home from now on.`,
        catchLine: "No county fair, no pumpkin prizes.",
      },
    ],
  },
  {
    id: "world",
    phase: PHASE_WORLD,
    resource: "fkWorld",
    title: "What should the land become?",
    prompt:
      "A big green place asks for a plan, and it cannot be everything. Old forest is tall and quiet and pays well. Wetland is wide and wet and pays better, but it takes a lot of getting right.",
    currency: "green",
    baseCost: T.world.cost,
    opensWhen: (run) => owned(run, "windbreak") >= 2,
    sides: [
      {
        name: "Old forest",
        blurb: `Forest pays ${times(T.world.forestGreen)} as much green and spreads ${times(T.world.forestSpread)} as fast. The marshes are drained and stay that way, so wetland is closed.`,
        catchLine: "No wetland, and a thirstier world.",
      },
      {
        name: "Wetland",
        blurb: `Wetland pays ${times(T.world.wetlandGreen)} as much green and holds ${times(T.world.wetlandWater)} the water, so the world rarely runs dry. The forest is left alone and stays closed.`,
        catchLine: "No new forest. Reeds and herons only.",
      },
    ],
  },
  {
    id: "seed",
    phase: PHASE_SEED,
    resource: "fkSeed",
    title: "How should the pot spend its days?",
    prompt:
      "One pot, one window and a lot of time. The pot likes company in the morning, or it likes a quiet light to sit up with it all night. You cannot give it both.",
    currency: "care",
    baseCost: T.seed.cost,
    opensWhen: (run) => owned(run, "trellis") >= 2,
    sides: [
      {
        name: "Morning sun",
        blurb: `Every answer you give the pot is worth ${times(T.seed.sunTap)}. A sunbeam falls across the sill.`,
        catchLine: "You have to be there. The helpers pay as they always did.",
      },
      {
        name: "Night-light",
        blurb: `A little bulb sits up with the pot, so the trellis, chime and dew all pay ${times(T.seed.nightHelpers)}. Moths come to visit.`,
        catchLine: "Your own answers pay as they always did.",
      },
    ],
  },
];

export const forkOf = (id: ForkId): ForkDef =>
  FORKS.find((f) => f.id === id) as ForkDef;

/** The fork of the phase the run is in. */
export const currentFork = (run: RunState): ForkDef =>
  forkOf(
    (["yard", "farm", "world", "seed"] as const)[
      Math.min(3, Math.max(0, run.phase))
    ]
  );

/** The side chosen (0 first, 1 second), or null before a choice. */
export function forkSide(run: RunState, id: ForkId): ForkSide | null {
  const v = Math.round(res(run, forkOf(id).resource));
  if (v === 1) return 0;
  if (v === 2) return 1;
  // A save from before forks that already keeps bees is a bee garden.
  if (
    id === "yard" &&
    (owned(run, "bee-hive") > 0 || run.revealed.includes("bee-hive"))
  )
    return 0;
  return null;
}

/** True when the fork has been decided. */
export const isForkChosen = (run: RunState, id: ForkId): boolean =>
  forkSide(run, id) !== null;

/** True while a fork's phase is on and its choice is waiting. */
export const isForkOpen = (run: RunState, id: ForkId): boolean =>
  PHASE_IDS[run.phase] === forkOf(id).phase && forkOf(id).opensWhen(run);

/** What a side costs now, in the fork's currency (priced with the phase). */
export const forkCost = (id: ForkId): number => {
  const fork = forkOf(id);
  return Math.round(
    fork.baseCost * TUNING.costScale[PHASE_IDS.indexOf(fork.phase)]
  );
};

export const forkActionId = (id: ForkId, side: ForkSide): string =>
  `fork-${id}-${side}`;
export const FORK_ACTION_IDS: readonly string[] = FORKS.flatMap((f) => [
  forkActionId(f.id, 0),
  forkActionId(f.id, 1),
]);

/** The ids of every fork the run could be at (for panels and bots). */
export const FORK_IDS: readonly ForkId[] = FORKS.map((f) => f.id);

// ------------------------------------------------------------------- effects

/** Bee hives, the dance and the keeper need the bees (not the spray). */
export const beesWelcome = (run: RunState): boolean =>
  forkSide(run, "yard") !== 1;

/** True once the spray has been chosen. */
export const isSprayed = (run: RunState): boolean =>
  forkSide(run, "yard") === 1;

/** Every sprinkler ripens this much more (1 without the spray). */
export const sprinklerForkMult = (run: RunState): number =>
  isSprayed(run) ? T.yard.sprayRipen : 1;

/** The orchard's boost once the fork is chosen (the spray halves its fruit). */
export const orchardMult = (run: RunState): number =>
  isSprayed(run) ? T.yard.sprayOrchard : TUNING.yard.orchard;

/** How much more every field pays with the chosen farm helper. */
export function farmForkMult(run: RunState): number {
  const side = forkSide(run, "farm");
  return side === 0 ? T.farm.crewIncome : side === 1 ? T.farm.hawkIncome : 1;
}

/** The crops drink less with the scarecrow crew (1 otherwise). */
export const farmThirstMult = (run: RunState): number =>
  forkSide(run, "farm") === 0 ? T.farm.crewThirst : 1;

/** The county fair multiplies ribbons with the crew (1 otherwise). */
export const fairForkMult = (run: RunState): number =>
  forkSide(run, "farm") === 0 ? T.farm.crewFair : 1;

/** True when the hawk has frightened the fair away. */
export const isFairScared = (run: RunState): boolean =>
  forkSide(run, "farm") === 1;

/** World: forest or wetland focus (null before the choice). */
export const worldFocus = (run: RunState): "forest" | "wetland" | null => {
  const side = forkSide(run, "world");
  return side === 0 ? "forest" : side === 1 ? "wetland" : null;
};

/** Seed: how much more taps and answers pay (the morning sun). */
export const seedTapMult = (run: RunState): number =>
  forkSide(run, "seed") === 0 ? T.seed.sunTap : 1;

/** Seed: how much more the trellis, chime and dew pay (the night-light). */
export const seedHelperMult = (run: RunState): number =>
  forkSide(run, "seed") === 1 ? T.seed.nightHelpers : 1;

/** Marks a side as chosen (the engine has already taken the cost). */
export function chooseSide(run: RunState, id: ForkId, side: ForkSide): void {
  if (isForkChosen(run, id)) return;
  run.resources[forkOf(id).resource] = side + 1;
}

/** One line for the picture caption and the panel's result line. */
export function forkResultLine(run: RunState, id: ForkId): string {
  const side = forkSide(run, id);
  if (side === null) return "";
  return `${forkOf(id).sides[side].name}. ${forkOf(id).sides[side].catchLine}`;
}

export const costLabel = (id: ForkId): string =>
  `${formatNumber(forkCost(id))} ${forkOf(id).currency}`;

/** One button per side; the fork panel draws them itself. */
export const FORK_ACTIONS: readonly ActionDef[] = FORKS.flatMap((fork) =>
  ([0, 1] as const).map((side): ActionDef => ({
    id: forkActionId(fork.id, side),
    phases: [fork.phase],
    isInline: true,
    visibleWhen: (run) => fork.opensWhen(run) || isForkChosen(run, fork.id),
    describe: (run) => ({
      label: fork.sides[side].name,
      detail: `${fork.sides[side].blurb} The catch: ${fork.sides[side].catchLine}`,
      cost: { resource: fork.currency, amount: forkCost(fork.id) },
      isBlocked: isForkChosen(run, fork.id),
    }),
    perform: (run) => chooseSide(run, fork.id, side),
  }))
);

/** The phases the forks live in, for tests. */
export const FORK_PHASES: readonly GrowPhaseId[] = [
  PHASE_YARD,
  PHASE_FARM,
  PHASE_WORLD,
  PHASE_SEED,
];
