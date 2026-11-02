import { formatNumber } from "../../engine/format";
import type { RunState, UpgradeDef } from "../../engine/types";
import { coolPerSecond } from "./meter";
import {
  BENCH_ID,
  KETTLE_ID,
  hasKettle,
  kettleShown,
  tendsSoFar,
  trustFraction,
  trustMult,
} from "./quiet";
import {
  PHASE_FRIEND,
  PHASE_IDS,
  PHASE_QUIET,
  PHASE_TOWN,
  PHASE_WORLD,
  type SmilePhaseId,
} from "./resources";
import {
  NO_BAD_DAYS,
  NO_BAD_DAYS_MULT,
  incomePerSecond,
  manualPerTap,
} from "./tick";
import { TUNING } from "./tuning";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const num = (n: number): string => formatNumber(n);

const plusOne = (run: RunState, id: string): RunState => ({
  ...run,
  owned: { ...run.owned, [id]: owned(run, id) + 1 },
});

/** "Per tap 2 → 3" for a scale step, read from the run as it stands. */
const scalePreview = (run: RunState, id: string): string =>
  `Per tap ${num(manualPerTap(run))} → ${num(manualPerTap(plusOne(run, id)))}`;

const helperPreview = (run: RunState, id: string): string =>
  `Per second ${num(incomePerSecond(run))} → ${num(
    incomePerSecond(plusOne(run, id))
  )}`;

const coolPreview = (run: RunState, id: string): string =>
  `Cooling speed ${coolPerSecond(run).toFixed(2)} → ${coolPerSecond(
    plusOne(run, id)
  ).toFixed(2)}`;

type Gate = (run: RunState) => boolean;
const has =
  (id: string, n = 1): Gate =>
  (run) =>
    owned(run, id) >= n;

interface LineSpec {
  id: string;
  name: string;
  description: string;
  phase: SmilePhaseId;
  currency: string;
  baseCost: number;
  /** The first line of a part needs no gate. */
  gate?: Gate;
  maxLevel?: number;
  costGrowth?: number;
}

const LINE_PRIORITY: Readonly<Record<string, number>> = {
  puppy: 1,
  lemonade: 2,
  "magic-hat": 3,
  band: 1,
  "smile-factory": 2,
  fireworks: 3,
  loudspeaker: 1,
  "cheer-tower": 2,
  "cheer-blimp": 3,
  blanket: 1,
  rain: 2,
  candle: 3,
};

/** Lines whose price climbs more gently than the rest (the late, big ones). */
const LINE_GROWTH: Readonly<Record<string, number>> = {
  lemonade: 2.1,
  fireworks: 1.8,
  "smile-factory": 2.2,
  "magic-hat": 1.9,
  "cheer-tower": 1.9,
  "cheer-blimp": 1.75,
};

/** A helper line: every level multiplies it, so every buy is a jump. */
const line = (s: LineSpec): UpgradeDef => ({
  id: s.id,
  name: s.name,
  description: s.description,
  phases: [s.phase],
  currency: s.currency,
  baseCost: s.baseCost,
  costGrowth: s.costGrowth ?? LINE_GROWTH[s.id] ?? 2.4,
  maxLevel: s.maxLevel ?? 8,
  kind: "mechanic",
  // The later lines are better value; a sensible player buys them first.
  priority: LINE_PRIORITY[s.id] ?? 0,
  visibleWhen: s.gate,
  effectPreview: (run) => helperPreview(run, s.id),
});

/** A scaling upgrade: taps and helpers alike pay more. */
const scale = (s: LineSpec): UpgradeDef => ({
  id: s.id,
  name: s.name,
  description: s.description,
  phases: [s.phase],
  currency: s.currency,
  baseCost: s.baseCost,
  costGrowth: s.costGrowth ?? 2.4,
  maxLevel: s.maxLevel ?? 4,
  visibleWhen: s.gate,
  effectPreview: (run) => scalePreview(run, s.id),
});

/** A one-off with a clear new ability. */
const once = (
  s: LineSpec,
  effectPreview?: (run: RunState) => string | null
): UpgradeDef => ({
  id: s.id,
  name: s.name,
  description: s.description,
  phases: [s.phase],
  currency: s.currency,
  baseCost: s.baseCost,
  costGrowth: 1,
  kind: "mechanic",
  visibleWhen: s.gate,
  effectPreview,
});

const RAW_UPGRADES: readonly UpgradeDef[] = [
  // One Sad Friend
  line({
    id: "balloon",
    name: "A bunch of balloons",
    description:
      "They bob over the friend's head, and one corner of a mouth twitches. Every bunch brings more smiles.",
    phase: PHASE_FRIEND,
    currency: "smiles",
    baseCost: 90,
  }),
  scale({
    id: "joke-book",
    name: "A bigger joke book",
    description:
      "Knock knock jokes, riddles and one very long pun about a bear. Every tap and every helper pays more.",
    phase: PHASE_FRIEND,
    currency: "smiles",
    baseCost: 540,
    gate: has("balloon", 2),
  }),
  line({
    id: "puppy",
    name: "A wagging puppy",
    description:
      "It tumbles over its own paws and the friend laughs out loud. It also fetches, if you throw the ball.",
    phase: PHASE_FRIEND,
    currency: "smiles",
    baseCost: 630,
    gate: has("balloon", 1),
  }),
  once(
    {
      id: "bracelet",
      name: "A friendship bracelet",
      description:
        "Made of three colors of string. It opens the friendship bank: set some smiles aside as time together, and every later laugh grows bigger.",
      phase: PHASE_FRIEND,
      currency: "smiles",
      baseCost: 270,
      gate: has("puppy", 1),
    },
    () => "Opens the friendship bank"
  ),
  line({
    id: "lemonade",
    name: "A lemonade stand",
    description:
      "Squeeze, stir, pour. A cold cup of sunshine, and a sign that says free smiles with every sip.",
    phase: PHASE_FRIEND,
    currency: "smiles",
    baseCost: 13000,
    gate: has("puppy", 1),
  }),
  line({
    id: "magic-hat",
    name: "A magic hat",
    description:
      "Out comes a rabbit, then a scarf, then a second, smaller rabbit. The friend has stopped trying to see how it is done.",
    phase: PHASE_FRIEND,
    currency: "smiles",
    baseCost: 250000,
    gate: has("lemonade", 1),
  }),
  once({
    id: "next-door",
    name: "Knock next door",
    description:
      "The friend is smiling now, and the neighbors want to know what the fuss is about. Time to go and say hello.",
    phase: PHASE_FRIEND,
    currency: "smiles",
    baseCost: 4100000,
    gate: has("magic-hat", 2),
  }),
  // The Town
  line({
    id: "clown",
    name: "A clown school graduate",
    description:
      "Big shoes, bigger hat, a flower that squirts. The whole street stops to watch.",
    phase: PHASE_TOWN,
    currency: "cheers",
    baseCost: 450,
  }),
  scale({
    id: "bunting",
    name: "Bunting on every lamppost",
    description:
      "Little flags in every color. The town looks like a birthday, and every cheer pays more.",
    phase: PHASE_TOWN,
    currency: "cheers",
    baseCost: 2700,
    gate: has("clown", 2),
  }),
  line({
    id: "band",
    name: "A marching band",
    description:
      "Tubas, a very small drum and a conductor who is mostly mustache. Feet start tapping on their own.",
    phase: PHASE_TOWN,
    currency: "cheers",
    baseCost: 3150,
    gate: has("clown", 1),
  }),
  {
    ...scale({
      id: "bench",
      name: "Resting benches",
      description:
        "Cheering is tiring work, even for a town. Each set of benches cools the cheer meter a good deal faster.",
      phase: PHASE_TOWN,
      currency: "cheers",
      baseCost: 1800,
      costGrowth: 1.9,
      maxLevel: 3,
      gate: has("clown", 2),
    }),
    kind: "mechanic",
    effectPreview: (run) => coolPreview(run, "bench"),
  },
  line({
    id: "smile-factory",
    name: "A smile factory",
    description:
      "Smiles go in the front as lemons and come out the back in boxes. The belts run all day, and the whistle toots a little tune.",
    phase: PHASE_TOWN,
    currency: "cheers",
    baseCost: 115000,
    gate: has("band", 1),
  }),
  line({
    id: "fireworks",
    name: "A fireworks show",
    description:
      "Whistles, bangs and a big golden willow of sparks. The whole town says ooh at the same time, which is a sound worth hearing.",
    phase: PHASE_TOWN,
    currency: "cheers",
    baseCost: 2700000,
    gate: has("smile-factory", 1),
  }),
  once({
    id: "key-to-town",
    name: "The key to the town",
    description:
      "The mayor hands it over with a very big ribbon. Everyone here is happy, which means the next town over is next.",
    phase: PHASE_TOWN,
    currency: "cheers",
    baseCost: 105000000,
    gate: has("fireworks", 2),
  }),
  // The World
  line({
    id: "poster",
    name: "Smile posters",
    description:
      "A big friendly face on every wall, grinning down at the street. It is nice to be looked at so kindly.",
    phase: PHASE_WORLD,
    currency: "grins",
    baseCost: 7000,
  }),
  scale({
    id: "bigger-brush",
    name: "A bigger paintbrush",
    description:
      "For the posters that need a wider smile. Every tap and every helper pays more.",
    phase: PHASE_WORLD,
    currency: "grins",
    baseCost: 40000,
    gate: has("poster", 2),
  }),
  line({
    id: "loudspeaker",
    name: "A cheerful loudspeaker",
    description:
      "A friendly voice on every corner, saying have a nice day, over and over, in case anyone missed it.",
    phase: PHASE_WORLD,
    currency: "grins",
    baseCost: 48000,
    gate: has("poster", 1),
  }),
  {
    ...scale({
      id: "mask-booth",
      name: "A smile-mask booth",
      description:
        "Pick a mask with a happy mouth and wear it all day. Nobody looks tired in a mask, and the cheer meter cools a good deal faster.",
      phase: PHASE_WORLD,
      currency: "grins",
      baseCost: 28000,
      costGrowth: 1.9,
      maxLevel: 3,
      gate: has("loudspeaker", 1),
    }),
    kind: "mechanic",
    effectPreview: (run) => coolPreview(run, "mask-booth"),
  },
  line({
    id: "cheer-tower",
    name: "A cheer tower",
    description:
      "Tall as a lighthouse, and it sends a cheerful hum out to every house in the world. Even the ones that did not ask.",
    phase: PHASE_WORLD,
    currency: "grins",
    baseCost: 6800000,
    gate: has("loudspeaker", 1),
  }),
  line({
    id: "cheer-blimp",
    name: "A grinning blimp",
    description:
      "A big silver blimp with a smile painted on its side, drifting over the rooftops. It follows people home. Gently.",
    phase: PHASE_WORLD,
    currency: "grins",
    baseCost: 195000000,
    gate: has("cheer-tower", 1),
  }),
  once(
    {
      id: NO_BAD_DAYS,
      name: "A sign: No Bad Days",
      description:
        "A big, bright sign over every door. Every grin pays more, because there is nothing else to be.",
      phase: PHASE_WORLD,
      currency: "grins",
      baseCost: 160000000,
      gate: has("cheer-tower", 1),
    },
    () => `Every place pays ${NO_BAD_DAYS_MULT}x`
  ),
  once({
    id: "cheer-satellite",
    name: "A cheer satellite",
    description:
      "Up where the stars are, beaming smiles to every roof at once. After this there is nowhere left to cheer.",
    phase: PHASE_WORLD,
    currency: "grins",
    baseCost: 5000000000,
    gate: (run) =>
      owned(run, "cheer-blimp") >= 2 && owned(run, NO_BAD_DAYS) >= 1,
  }),
  // The Quiet
  line({
    id: "tea",
    name: "A cup of tea",
    description:
      "Warm in both hands, and no need to say anything. The steam curls up like a slow sentence.",
    phase: PHASE_QUIET,
    currency: "patience",
    baseCost: 75,
  }),
  scale({
    id: "long-silence",
    name: "A long silence",
    description:
      "Some things do not need saying. Every moment, and every answer, is worth more.",
    phase: PHASE_QUIET,
    currency: "patience",
    baseCost: 450,
    costGrowth: 2.8,
    gate: has("tea", 1),
  }),
  line({
    id: "blanket",
    name: "A warm blanket",
    description:
      "Wool, a bit scratchy, and big enough for two. It does not ask anything of anybody.",
    phase: PHASE_QUIET,
    currency: "patience",
    baseCost: 525,
    gate: has("tea", 1),
  }),
  line({
    id: "rain",
    name: "Rain on the window",
    description:
      "A soft, steady sound that fills the quiet so nobody has to. You are both just listening to it.",
    phase: PHASE_QUIET,
    currency: "patience",
    baseCost: 16000,
    gate: has("blanket", 1),
  }),
  line({
    id: "candle",
    name: "A candle in the window",
    description:
      "A small flame that does not ask for anything. It lights up the bench just enough to see each other's hands.",
    phase: PHASE_QUIET,
    currency: "patience",
    baseCost: 420000,
    gate: has("rain", 1),
  }),
  once(
    {
      id: KETTLE_ID,
      name: "A kettle on the stove",
      description:
        "It pours a cup when you are busy, after a pause. Your own answer is still better.",
      phase: PHASE_QUIET,
      currency: "patience",
      baseCost: 250,
      gate: (run) => kettleShown(run),
    },
    (run) =>
      hasKettle(run)
        ? "Answers a waiting friend"
        : `Answers a waiting friend after a pause (${tendsSoFar(run)} answers so far)`
  ),
  once(
    {
      id: BENCH_ID,
      name: "Room on the bench",
      description:
        "Shuffle over, just a bit. Every bit of patience builds twice as much trust.",
      phase: PHASE_QUIET,
      currency: "patience",
      baseCost: 6000000,
      gate: (run) => trustFraction(run) >= 0.1 || owned(run, "blanket") >= 2,
    },
    (run) =>
      `Trust per patience ${trustMult(run)}x → ${trustMult(plusOne(run, BENCH_ID))}x`
  ),
];

/**
 * Every price in a phase, scaled together: the pacing knob (see TUNING).
 * Repeatable upgrades also climb a little steeper in a phase that needs it.
 */
export const UPGRADES: readonly UpgradeDef[] = RAW_UPGRADES.map((u) => {
  const phase = Math.max(
    0,
    PHASE_IDS.indexOf((u.phases?.[0] ?? PHASE_FRIEND) as SmilePhaseId)
  );
  return {
    ...u,
    baseCost: u.baseCost * TUNING.costScale[phase],
    costGrowth:
      u.costGrowth > 1 ? u.costGrowth * TUNING.costSteepness[phase] : 1,
  };
});
