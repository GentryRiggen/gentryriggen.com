import { formatNumber } from "../../engine/format";
import type { ActionDef, RunState } from "../../engine/types";
import {
  PHASE_FRIEND,
  PHASE_IDS,
  PHASE_QUIET,
  PHASE_TOWN,
  PHASE_WORLD,
  type SmilePhaseId,
} from "./resources";
import { TUNING } from "./tuning";

/**
 * Forks: one either-or choice in every part of the game. Buying one side
 * locks the other for the rest of this run, so each side is a different way
 * to play, with its own picture, its own numbers and a catch told plainly on
 * the card before anything is spent:
 *  - one sad friend: tell jokes, or be kind;
 *  - the town: a clown school, or a smile factory;
 *  - the world: loudspeakers, or listening boxes;
 *  - the quiet: say something, or only sit.
 * Nothing is lost by waiting and nothing is a trap: both sides finish their
 * part in about the same time, one by hand and one while you rest.
 *
 * The choice lives in one hidden resource per fork (0 not chosen, 1 the first
 * side, 2 the second), so a save from before reads as "not chosen".
 */

const T = TUNING.forks;

export type ForkId = "friend" | "town" | "world" | "quiet";
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
  phase: SmilePhaseId;
  resource: string;
  title: string;
  prompt: string;
  currency: string;
  baseCost: number;
  opensWhen(run: RunState): boolean;
  sides: readonly [ForkSideDef, ForkSideDef];
}

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const times = (n: number): string => `${Number(n.toFixed(2))}x`;
const less = (n: number): string => `${Math.round((1 - n) * 100)}%`;

export const FORKS: readonly ForkDef[] = [
  {
    id: "friend",
    phase: PHASE_FRIEND,
    resource: "fkFriend",
    title: "How do you cheer up a friend?",
    prompt:
      "The friend is still looking at the ground. You could tell your best jokes, one after another, or you could sit down and be kind about the little things. Only one of these becomes your way, and the friend remembers.",
    currency: "smiles",
    baseCost: T.friend.cost,
    opensWhen: (run) => owned(run, "balloon") >= 3,
    sides: [
      {
        name: "Tell jokes",
        blurb: `Knock knock! Every tap you make pays ${times(T.friend.jokesTap)} as much. The jokes are good ones, and some are even new.`,
        catchLine: `Laughs fade fast, so the bond you build together grows ${less(T.friend.jokesBond)} less.`,
      },
      {
        name: "Be kind",
        blurb: `A thank-you here, a drawing there. Balloons, puppies and lemonade all pay ${times(T.friend.kindHelpers)} as much while you rest.`,
        catchLine: "It takes a while to start, and your taps pay as they did.",
      },
    ],
  },
  {
    id: "town",
    phase: PHASE_TOWN,
    resource: "fkTown",
    title: "Who should run the cheering?",
    prompt:
      "The whole town wants a smile, and the robot cannot do it all by hand. A clown school trains hands-on cheerers. A smile factory makes smiles by the crate. A town can only afford one at a time.",
    currency: "cheers",
    baseCost: T.town.cost,
    opensWhen: (run) => owned(run, "band") >= 2,
    sides: [
      {
        name: "Clown school",
        blurb: `Honk! Every tap pays ${times(T.town.clownTap)} as much, and the big shoes get a laugh every time.`,
        catchLine: `Clowns stir a crowd up, so a street with no float turns grumpy ${Math.round((TUNING.town.clownFall - 1) * 100)}% faster.`,
      },
      {
        name: "Smile factory",
        blurb: `Smiles in boxes, on belts, all day and night. Clowns, bands and factory floors all pay ${times(T.town.factoryHelpers)} as much.`,
        catchLine: `Every factory smile looks alike, so a float cheers a street only ${Math.round(TUNING.town.factoryCare * 100)}% as much.`,
      },
    ],
  },
  {
    id: "world",
    phase: PHASE_WORLD,
    resource: "fkWorld",
    title: "How should the cheer reach everyone?",
    prompt:
      "There are more places than the robot can walk to. Loudspeakers can cheer a whole street at once, all day. Or you could put a little box in every square, where anyone can say how they are. Only one gets built first.",
    currency: "grins",
    baseCost: T.world.cost,
    opensWhen: (run) => owned(run, "loudspeaker") >= 2,
    sides: [
      {
        name: "Loudspeakers",
        blurb: `A cheerful voice on every corner, saying the nicest thing. Every helper pays ${times(T.world.speakerHelpers)} as much.`,
        catchLine: `Nobody can turn them down, so the cheer meter cools ${less(T.world.speakerCool)} slower.`,
      },
      {
        name: "Listening boxes",
        blurb: `Notes go in, notes get read. Helpers pay ${times(T.world.boxHelpers)} as much, and the cheer meter cools ${times(T.world.boxCool)} as fast.`,
        catchLine: "Slower to build, and the notes are not always happy ones.",
      },
    ],
  },
  {
    id: "quiet",
    phase: PHASE_QUIET,
    resource: "fkQuiet",
    title: "What does the friend need?",
    prompt:
      "They are not saying much. You could say a few careful words, or you could say nothing at all and be there. You cannot do both at once.",
    currency: "patience",
    baseCost: T.quiet.cost,
    opensWhen: (run) => owned(run, "tea") >= 2,
    sides: [
      {
        name: "A few words",
        blurb: `Every answer you give pays ${times(T.quiet.wordsTap)} as much, and every word is a small gift.`,
        catchLine: "You have to be there. The helpers pay as they always did.",
      },
      {
        name: "Just sit",
        blurb: `You stop talking and keep the bench warm. Tea, blanket and rain all pay ${times(T.quiet.silenceHelpers)} as much.`,
        catchLine: "Your own answers pay as they always did.",
      },
    ],
  },
];

export const forkOf = (id: ForkId): ForkDef =>
  FORKS.find((f) => f.id === id) as ForkDef;

/** The fork of the phase the run is in. */
export const currentFork = (run: RunState): ForkDef =>
  FORKS[Math.min(3, Math.max(0, run.phase))];

/** The side chosen (0 first, 1 second), or null before a choice. */
export function forkSide(run: RunState, id: ForkId): ForkSide | null {
  const v = Math.round(res(run, forkOf(id).resource));
  if (v === 1) return 0;
  if (v === 2) return 1;
  return null;
}

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

export const FORK_IDS: readonly ForkId[] = FORKS.map((f) => f.id);

// ------------------------------------------------------------------- effects

const pick = (run: RunState, id: ForkId, a: number, b: number): number => {
  const side = forkSide(run, id);
  return side === 0 ? a : side === 1 ? b : 1;
};

/** How much more every tap pays with the chosen side. */
export const forkTapMult = (run: RunState): number =>
  PHASE_IDS[run.phase] === PHASE_FRIEND
    ? pick(run, "friend", T.friend.jokesTap, 1)
    : PHASE_IDS[run.phase] === PHASE_TOWN
      ? pick(run, "town", T.town.clownTap, 1)
      : PHASE_IDS[run.phase] === PHASE_QUIET
        ? pick(run, "quiet", T.quiet.wordsTap, 1)
        : 1;

/** How much more every helper pays with the chosen side. */
export const forkHelperMult = (run: RunState): number =>
  PHASE_IDS[run.phase] === PHASE_FRIEND
    ? pick(run, "friend", 1, T.friend.kindHelpers)
    : PHASE_IDS[run.phase] === PHASE_TOWN
      ? pick(run, "town", 1, T.town.factoryHelpers)
      : PHASE_IDS[run.phase] === PHASE_WORLD
        ? pick(run, "world", T.world.speakerHelpers, T.world.boxHelpers)
        : PHASE_IDS[run.phase] === PHASE_QUIET
          ? pick(run, "quiet", 1, T.quiet.silenceHelpers)
          : 1;

/** How much the bond gives of what it would (jokes fade fast). */
export const forkBondMult = (run: RunState): number =>
  pick(run, "friend", T.friend.jokesBond, 1);

/** How fast a street with no float turns grumpy (clowns stir a crowd up). */
export const forkFallMult = (run: RunState): number =>
  pick(run, "town", TUNING.town.clownFall, 1);

/** How much a float cheers a street (the factory's smiles are all alike). */
export const forkCareMult = (run: RunState): number =>
  pick(run, "town", 1, TUNING.town.factoryCare);

/** How fast the cheer meter cools. */
export const forkCoolMult = (run: RunState): number =>
  pick(run, "world", T.world.speakerCool, T.world.boxCool);

/** The multiplier of a cheer broadcast. */
export const forkParadeMult = (): number => TUNING.knowhow.paradeMult;

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
export const FORK_PHASES: readonly SmilePhaseId[] = [
  PHASE_FRIEND,
  PHASE_TOWN,
  PHASE_WORLD,
  PHASE_QUIET,
];
