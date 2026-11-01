import { formatNumber } from "../../engine/format";
import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import { FULL_GROWTH, PHASE_SEED } from "./resources";
import { TUNING } from "./tuning";

/**
 * The old window box: the last seed, and the one small pot on its sill.
 * Care grows the pot (sprout, bud, bloom). Every little while the pot seems to
 * want something: more sun, a song, or a drink from the can. The clue is plain
 * in the words, and the right answer pays well. Any other answer still pays a
 * little, because the pot likes all of it. A want waits as long as it takes,
 * and nothing is ever wrong. The music box answers a waiting want after a
 * pause, for less, so it only adds to hand play.
 *
 * The pot's wants come from a random stream of their own (`run.rng` is never
 * touched). All state lives in hidden `run.resources`, so a save without them
 * simply reads as "nothing wanted yet".
 */

const B = TUNING.windowbox;

export const WATERING_CAN_ID = "watering-can";
export const MUSIC_BOX_ID = "music-box";
export const LANTERN_ID = "window-lantern";

export type PotStage = "soil" | "sprout" | "bud" | "bloom";
export const POT_STAGES: readonly PotStage[] = [
  "soil",
  "sprout",
  "bud",
  "bloom",
];

/** What the pot can want, in the order of the three tending choices. */
export const WANTS = [
  {
    id: "sun",
    label: "Turn the pot to the sun",
    clue: "The little leaves are leaning toward the window.",
    done: "You turned the pot to the sun, and it stretched toward the light.",
  },
  {
    id: "song",
    label: "Sing it a song",
    clue: "It is very quiet, and the pot seems to be listening.",
    done: "You sang a soft song, and the leaves swayed along.",
  },
  {
    id: "water",
    label: "Water it from the can",
    clue: "The soil on top looks pale and dry.",
    done: "You watered it from the little can, and the soil went dark and happy.",
  },
] as const;

export const WANT_COUNT = WANTS.length;

export const tendActionId = (choice: number): string =>
  `windowbox-${WANTS[choice].id}`;
export const WINDOWBOX_ACTION_IDS: readonly string[] = WANTS.map((_, i) =>
  tendActionId(i)
);

/** Mixed into the run's seed so the pot's wants have a stream of their own. */
const SEED_MIX = 0x70b0c5;

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** How much of the pot is grown, 0 to 1. */
export const potGrowth = (run: RunState): number =>
  Math.min(1, Math.max(0, res(run, "growth") / FULL_GROWTH));

export function potStage(run: RunState): PotStage {
  const g = potGrowth(run);
  if (g >= 1) return "bloom";
  if (g >= B.budAt) return "bud";
  if (g >= B.sproutAt) return "sprout";
  return "soil";
}

/** True once the pot is fully grown: the milestone that brings a visitor. */
export const isSeedBloomed = (run: RunState): boolean => potGrowth(run) >= 1;

/** Keeps the hidden stage counter in step (the bloom sound reads it). */
export function syncPotStage(run: RunState): void {
  const index = POT_STAGES.indexOf(potStage(run));
  if (index > res(run, "potStage")) run.resources.potStage = index;
}

/** Care earned in the seed phase grows the pot (once per tap or per tick). */
export function addCare(run: RunState, amount: number): void {
  run.resources.care = res(run, "care") + amount;
  run.resources.growth = Math.min(
    FULL_GROWTH,
    res(run, "growth") +
      amount * B.growthPerCare * (1 + B.lanternBoost * owned(run, LANTERN_ID))
  );
  syncPotStage(run);
}

export const isWindowBoxOpen = (run: RunState): boolean =>
  run.phase === 3 && !run.complete;

/** True while the pot wants something and waits for the player to choose. */
export const isWanting = (run: RunState): boolean =>
  isWindowBoxOpen(run) && res(run, "wbStage") === 1;

/** What the pot wants (an index into WANTS) while it wants something. */
export const currentWant = (run: RunState): number =>
  Math.round(res(run, "wbWant"));

/** Times the pot has been tended through a choice. */
export const tendsSoFar = (run: RunState): number => res(run, "wbTends");

export const hasMusicBox = (run: RunState): boolean =>
  owned(run, MUSIC_BOX_ID) > 0;

/** Seconds until the pot next wants something (while it rests). */
export const secondsToWant = (run: RunState): number =>
  res(run, "wbStage") === 0
    ? Math.max(0, restTotal(run) - res(run, "wbTime"))
    : 0;

const restTotal = (run: RunState): number =>
  res(run, "wbShown") === 0 ? B.firstWantSeconds : B.restSeconds;

/** The watering can makes every answer pay a little more. */
export const canMult = (run: RunState): number =>
  1 + B.canPer * owned(run, WATERING_CAN_ID);

/** What an answer pays in care: seconds of tending at the current pace. */
export const tendPays = (
  run: RunState,
  choice: number,
  value: number
): number =>
  (choice === currentWant(run) ? B.matchSeconds : B.otherSeconds) *
  canMult(run) *
  Math.max(1, value);

/** What the music box pays when it answers (it always picks the right one). */
export const boxPays = (run: RunState, value: number): number =>
  B.matchSeconds * canMult(run) * Math.max(1, value) * B.boxShare;

/** The music box is offered once the pot has been tended a few times. */
export const musicBoxShown = (run: RunState): boolean =>
  tendsSoFar(run) >= B.boxAfterTends;

function answer(
  run: RunState,
  choice: number,
  pays: number,
  byBox: boolean
): void {
  const r = run.resources;
  r.wbLastChoice = choice;
  r.wbLastWant = currentWant(run);
  r.wbLastPays = pays;
  r.wbBy = byBox ? 1 : 0;
  r.wbTends = tendsSoFar(run) + 1;
  r.wbStage = 0;
  r.wbTime = 0;
  addCare(run, pays);
}

/** Answers the pot by hand (the panel's buttons call this). */
export function tendPot(run: RunState, choice: number, value: number): void {
  if (!isWanting(run) || choice < 0 || choice >= WANT_COUNT) return;
  answer(run, choice, tendPays(run, choice, value), false);
}

/** The pot wants something new, picked from its own stream. */
function want(run: RunState): void {
  const r = run.resources;
  const stream = { rng: res(run, "wbRng") | 0 };
  // Never the same thing twice in a row, so there is always something to read.
  const last = res(run, "wbShown") === 0 ? -1 : currentWant(run);
  let pick = Math.floor(nextRandom(stream) * WANT_COUNT) % WANT_COUNT;
  if (pick === last) pick = (pick + 1) % WANT_COUNT;
  r.wbRng = stream.rng;
  r.wbWant = pick;
  r.wbStage = 1;
  r.wbTime = 0;
  r.wbShown = res(run, "wbShown") + 1;
}

/** Gives the pot its own stream and a quiet start (the seed phase calls it). */
export function openWindowBox(run: RunState): void {
  const r = run.resources;
  r.wbRng = (run.rng ^ SEED_MIX) | 0;
  r.wbStage = 0;
  r.wbTime = 0;
  r.wbShown = 0;
  r.growth = 0;
  r.potStage = 0;
}

/**
 * Runs the window box for `dt` seconds. `value` is the care a second of
 * tending is worth (read lazily: only an answer needs it).
 */
export function tickWindowBox(
  run: RunState,
  dt: number,
  value: () => number = () => 1
): void {
  if (!isWindowBoxOpen(run)) return;
  const r = run.resources;
  if (r.wbPaused === 1) return;
  r.wbTime = res(run, "wbTime") + dt;
  if (res(run, "wbStage") === 0) {
    if (r.wbTime >= restTotal(run)) want(run);
    return;
  }
  if (hasMusicBox(run) && r.wbTime >= B.boxDelay)
    answer(run, currentWant(run), boxPays(run, value()), true);
}

/** For the simulator's income probes: a paused box never answers. */
export function withoutWindowBox(run: RunState): RunState {
  run.resources.wbPaused = 1;
  return run;
}

/** The line under the pot: what it wants, or how the last answer went. */
export function windowBoxLine(run: RunState): string {
  if (isSeedBloomed(run))
    return "The flower is open. Someone is coming up the stairs.";
  if (isWanting(run)) return WANTS[currentWant(run)].clue;
  const last = res(run, "wbShown") === 0 ? -1 : currentWant(run);
  if (tendsSoFar(run) === 0)
    return last < 0
      ? "The pot sits in the sun. The robot waits beside it."
      : WANTS[last].clue;
  const choice = Math.round(res(run, "wbLastChoice"));
  if (res(run, "wbBy") === 1) return "The music box played a soft little tune.";
  if (choice === Math.round(res(run, "wbLastWant")))
    return `${WANTS[choice].done} It grew a lot.`;
  return `${WANTS[choice].done} It liked that too.`;
}

/** One tending button per choice; the window box panel draws them itself. */
export function tendActions(
  value: (run: RunState) => number
): readonly ActionDef[] {
  return WANTS.map((w, index) => ({
    id: tendActionId(index),
    phases: [PHASE_SEED],
    isInline: true,
    visibleWhen: isWindowBoxOpen,
    describe: (run: RunState) => {
      const on = isWanting(run);
      const right = on && currentWant(run) === index;
      return {
        label: w.label,
        detail: on
          ? `About +${formatNumber(Math.floor(tendPays(run, index, value(run))))} care${right ? ", just what it wanted" : ""}.`
          : "The pot is resting. It will ask when it is ready.",
        isBlocked: !on,
        hint: right
          ? { text: "it wants this", tone: "good" as const }
          : undefined,
      };
    },
    perform: (run: RunState) => tendPot(run, index, value(run)),
  }));
}
