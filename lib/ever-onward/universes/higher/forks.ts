import { formatNumber } from "../../engine/format";
import type { ActionDef, RunState } from "../../engine/types";
import { owned, res } from "./lines";
import {
  PHASE_IDS,
  PHASE_PLAYROOM,
  PHASE_SKY,
  PHASE_TOP,
  PHASE_TOWN,
  type HigherPhaseId,
} from "./resources";
import { TUNING } from "./tuning";

/**
 * Forks: one either-or choice in every part of the game. Buying one side
 * locks the other for the rest of this run, so each side is a different way
 * to build, with a different picture, different numbers and a catch that is
 * told plainly on the card before anything is spent:
 *  - the playroom: tall and thin, or wide and sturdy;
 *  - the town: a steel frame, or timber;
 *  - the sky: a space elevator, or cloud terraces;
 *  - the top: down the stairs, or in the old lift.
 * Nothing is lost by waiting and nothing is a trap: both sides finish their
 * part in about the same time, one by hand and one while you rest.
 *
 * The choice lives in one hidden resource per fork (0 not chosen, 1 the first
 * side, 2 the second), so a save from before forks existed reads as "not
 * chosen".
 */

const T = TUNING.forks;

export type ForkId = "play" | "town" | "sky" | "top";
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
  phase: HigherPhaseId;
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

const times = (n: number): string => `${Number(n.toFixed(2))}x`;

export const FORKS: readonly ForkDef[] = [
  {
    id: "play",
    phase: PHASE_PLAYROOM,
    resource: "fkPlay",
    title: "How should the tower grow?",
    prompt:
      "The block tower is getting tall. You can keep it tall and thin, which is quick but a bit wobbly, or make it wide and sturdy, which is steady but slow. Only one of them works out, and the rug remembers.",
    currency: "blocks",
    baseCost: T.play.cost,
    opensWhen: (run) => owned(run, "bear") >= 3,
    sides: [
      {
        name: "Tall and thin",
        blurb: `Helpers pay ${times(T.play.tallPay)} as much. It also leans ${times(T.play.tallSway)} as fast, so keep an eye on it.`,
        catchLine: "It wobbles. You will be steadying it a lot.",
      },
      {
        name: "Wide and sturdy",
        blurb: `Helpers pay ${times(T.play.widePay)} as much, and the tower leans less than half as fast.`,
        catchLine: "Slower to climb. Everything pays less than tall and thin.",
      },
    ],
  },
  {
    id: "town",
    phase: PHASE_TOWN,
    resource: "fkTown",
    title: "Steel or timber?",
    prompt:
      "The town is arguing about what the next floors should be made of. Steel is bright and quick. Timber is warm and clever. The crane operator says you can have one, not both.",
    currency: "bricks",
    baseCost: T.town.cost,
    opensWhen: (run) => owned(run, "mason") >= 2,
    sides: [
      {
        name: "A steel frame",
        blurb: `Helpers pay ${times(T.town.steelPay)} as much. The crews are so busy riveting that they learn slowly: know-how comes in ${times(T.town.steelKnow)}.`,
        catchLine: "Half the know-how, so fewer projects and overtime.",
      },
      {
        name: "Timber beams",
        blurb: `Helpers pay ${times(T.town.timberPay)} as much. Crews learn ${times(T.town.timberKnow)} as fast, and the tower leans half as fast.`,
        catchLine: "Timber pays less than steel.",
      },
    ],
  },
  {
    id: "sky",
    phase: PHASE_SKY,
    resource: "fkSky",
    title: "How should the tower reach?",
    prompt:
      "Above the clouds the tower can climb straight up on a long cable, or spread out into airy terraces. The cable is quicker. The terraces let the sun through. Only one fits.",
    currency: "beams",
    baseCost: T.sky.cost,
    opensWhen: (run) => owned(run, "sky-crew") >= 2,
    sides: [
      {
        name: "A space elevator",
        blurb: `Helpers pay ${times(T.sky.elevatorPay)} as much. The tower's shadow falls across the town, and fewer loads make the long trip up: loads pay ${times(T.sky.elevatorLoads)}.`,
        catchLine: "The town sits in the shade, and loads pay half.",
      },
      {
        name: "Cloud terraces",
        blurb: `Helpers pay ${times(T.sky.terracePay)} as much. Sunlight reaches the streets and the birds have somewhere to land, so loads pay ${times(T.sky.terraceLoads)}.`,
        catchLine: "Terraces pay less than the elevator.",
      },
    ],
  },
  {
    id: "top",
    phase: PHASE_TOP,
    resource: "fkTop",
    title: "How should the robot go down?",
    prompt:
      "There is a long way down, and two ways to go. You can walk the stairs yourself, one step at a time, or you can ride the old lift while it hums. You cannot do both.",
    currency: "quiet",
    baseCost: T.top.cost,
    opensWhen: (run) => owned(run, "stair-lamp") >= 2,
    sides: [
      {
        name: "Take the stairs",
        blurb: `Every step you take yourself is worth ${times(T.top.stairsTap)}, and the lamps, songbirds and humming pay ${times(T.top.stairsHelpers)}.`,
        catchLine: "You have to be there. The lift pays more while you rest.",
      },
      {
        name: "Ride the old lift",
        blurb: `The lamps, the songbirds and the humming all pay ${times(T.top.liftHelpers)}. It creaks, and it is a little slow.`,
        catchLine: "Your own steps pay as they always did.",
      },
    ],
  },
];

export const forkOf = (id: ForkId): ForkDef =>
  FORKS.find((f) => f.id === id) as ForkDef;

/** The fork of each phase, by phase index. */
export const FORK_BY_PHASE: readonly ForkId[] = ["play", "town", "sky", "top"];

/** The fork of the phase the run is in. */
export const currentFork = (run: RunState): ForkDef =>
  forkOf(FORK_BY_PHASE[Math.min(3, Math.max(0, run.phase))]);

/** The side chosen (0 first, 1 second), or null before a choice. */
export function forkSide(run: RunState, id: ForkId): ForkSide | null {
  const v = Math.round(res(run, forkOf(id).resource));
  if (v === 1) return 0;
  if (v === 2) return 1;
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

// ------------------------------------------------------------------- effects

/** How much more the helpers pay with the chosen side of this part's fork. */
export function helperForkMult(run: RunState): number {
  const side = forkSide(run, currentFork(run).id);
  if (side === null) return 1;
  switch (run.phase) {
    case 0:
      return side === 0 ? T.play.tallPay : T.play.widePay;
    case 1:
      return side === 0 ? T.town.steelPay : T.town.timberPay;
    case 2:
      return side === 0 ? T.sky.elevatorPay : T.sky.terracePay;
    default:
      return side === 1 ? T.top.liftHelpers : T.top.stairsHelpers;
  }
}

/** How much more your own taps pay (the stairs). */
export const tapForkMult = (run: RunState): number =>
  run.phase === 3 && forkSide(run, "top") === 0 ? T.top.stairsTap : 1;

/** How much faster the tower sways with the chosen side (1 = as usual). */
export function swayForkMult(run: RunState): number {
  const side = forkSide(run, currentFork(run).id);
  if (side === null) return 1;
  if (run.phase === 0) return side === 0 ? T.play.tallSway : T.play.wideSway;
  if (run.phase === 1 && side === 1) return T.town.timberSway;
  return 1;
}

/** How fast know-how comes in with the chosen side (1 = as usual). */
export function knowForkMult(run: RunState): number {
  if (run.phase !== 1) return 1;
  const side = forkSide(run, "town");
  return side === 0 ? T.town.steelKnow : side === 1 ? T.town.timberKnow : 1;
}

/** How much a delivery pays with the chosen side of the sky's fork. */
export function loadForkMult(run: RunState): number {
  if (run.phase !== 2) return 1;
  const side = forkSide(run, "sky");
  return side === 0 ? T.sky.elevatorLoads : side === 1 ? T.sky.terraceLoads : 1;
}

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
