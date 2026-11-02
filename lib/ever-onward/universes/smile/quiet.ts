import type { ActionDef, RunState } from "../../engine/types";
import { forkTapMult } from "./forks";
import { FULL_TRUST, PHASE_QUIET } from "./resources";
import { tendingValue } from "./tick";
import { TUNING } from "./tuning";

/**
 * The quiet bench: the last part. Patience builds trust, and trust is the
 * only thing that fills the bar. Every little while the friend seems to want
 * something: someone to listen, a bit more room on the bench, or a cup of
 * tea. The clue is plain in the words and the right answer pays well. Any
 * other answer still pays a little, because it all helps. A want waits as long
 * as it takes, and nothing is ever wrong. The kettle answers a waiting want
 * after a pause, for less, so it only adds to hand play.
 *
 * What the friend wants follows a fixed pattern (never luck), and all state
 * lives in hidden `run.resources`, so a save without them reads as "nothing
 * wanted yet".
 */

const Q = TUNING.quiet;

export const KETTLE_ID = "kettle";
export const BENCH_ID = "room-on-bench";

export const WANTS = [
  {
    id: "listen",
    label: "Listen",
    clue: "They take a small breath, as if there is something to say.",
    done: "You listened, and nobody said anything for a while. It was a good while.",
  },
  {
    id: "closer",
    label: "Sit a little closer",
    clue: "They pull their coat in tight, and look at the empty end of the bench.",
    done: "You shuffled along the bench, and the cold shuffled off.",
  },
  {
    id: "tea",
    label: "Pass the tea",
    clue: "Their cup is empty, and they are turning it around in their hands.",
    done: "You poured a cup, and they held it in both hands like a small sun.",
  },
] as const;

export const WANT_COUNT = WANTS.length;

/** The order the friend asks in: fixed, so it never feels like a game of luck. */
const PATTERN: readonly number[] = [0, 2, 1, 0, 1, 2, 2, 0, 1, 1, 2, 0];

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

export const tendActionId = (choice: number): string => `quiet-${choice}`;
export const QUIET_ACTION_IDS: readonly string[] = WANTS.map((_, i) =>
  tendActionId(i)
);

/** How much of the one friendship is grown, 0 to 1. */
export const trustFraction = (run: RunState): number =>
  Math.min(1, Math.max(0, res(run, "trust") / FULL_TRUST));

export type TrustStage = "frown" | "flicker" | "warm" | "smile";
export const TRUST_STAGES: readonly TrustStage[] = [
  "frown",
  "flicker",
  "warm",
  "smile",
];

export function trustStage(run: RunState): TrustStage {
  const g = trustFraction(run);
  if (g >= 1) return "smile";
  if (g >= 0.6) return "warm";
  if (g >= 0.015) return "flicker";
  return "frown";
}

/** True once the friend has smiled, really. */
export const isRealSmile = (run: RunState): boolean => trustFraction(run) >= 1;

/** The bench: how much trust each bit of patience builds. */
export const trustMult = (run: RunState): number =>
  1 + Q.benchBoost * Math.min(1, owned(run, BENCH_ID));

/** Patience adds up, and the same patience builds trust. */
export function addPatience(run: RunState, amount: number): void {
  if (amount <= 0) return;
  run.resources.patience = res(run, "patience") + amount;
  run.resources.trust = Math.min(
    FULL_TRUST,
    res(run, "trust") + amount * Q.growthPerPatience * trustMult(run)
  );
}

export const isQuietOpen = (run: RunState): boolean => run.phase === 3;
export const isWanting = (run: RunState): boolean =>
  isQuietOpen(run) && res(run, "qtStage") === 1;
export const currentWant = (run: RunState): number =>
  Math.min(WANT_COUNT - 1, Math.max(0, Math.round(res(run, "qtWant"))));
export const tendsSoFar = (run: RunState): number => res(run, "qtTends");
export const hasKettle = (run: RunState): boolean => owned(run, KETTLE_ID) > 0;

/** Seconds until the friend next wants something (0 while one waits). */
export const secondsToWant = (run: RunState): number =>
  isWanting(run)
    ? 0
    : Math.max(
        0,
        (res(run, "qtTends") === 0 ? Q.firstWaitSeconds : Q.restSeconds) -
          res(run, "qtTime")
      );

/** What a right answer pays, given a second of tending (`value`). */
export const tendPays = (
  run: RunState,
  value: number,
  isRight: boolean
): number =>
  value * (isRight ? Q.matchSeconds : Q.otherSeconds) * forkTapMult(run);

/** What the kettle pays for the answer it gives. */
export const kettlePays = (run: RunState, value: number): number =>
  value * Q.matchSeconds * Q.kettleShare;

/** The kettle is offered once a few answers have been given. */
export const kettleShown = (run: RunState): boolean =>
  tendsSoFar(run) >= Q.kettleAfterAnswers || hasKettle(run);

/** Answers a want; `choice` is what the player did. */
export function tendFriend(run: RunState, choice: number, value: number): void {
  if (!isWanting(run)) return;
  const isRight = choice === currentWant(run);
  const pays = tendPays(run, value, isRight);
  addPatience(run, pays);
  run.resources.qtLastRight = isRight ? 1 : 0;
  run.resources.qtLastPays = pays;
  run.resources.qtTends = tendsSoFar(run) + 1;
  run.resources.qtStage = 0;
  run.resources.qtTime = 0;
  run.resources.qtWant = PATTERN[tendsSoFar(run) % PATTERN.length];
}

/** Opens the bench: the friend wants nothing yet. */
export function openQuiet(run: RunState): void {
  run.resources.qtStage = 0;
  run.resources.qtTime = 0;
  run.resources.qtWant = PATTERN[0];
}

/** Runs the friend's clock; the kettle answers a want that waits too long. */
export function tickQuiet(
  run: RunState,
  dt: number,
  valueOf: () => number
): void {
  if (!isQuietOpen(run)) return;
  const time = res(run, "qtTime") + dt;
  if (res(run, "qtStage") === 0) {
    const wait = res(run, "qtTends") === 0 ? Q.firstWaitSeconds : Q.restSeconds;
    run.resources.qtTime = time;
    if (time >= wait) {
      run.resources.qtStage = 1;
      run.resources.qtTime = 0;
    }
    return;
  }
  run.resources.qtTime = time;
  if (hasKettle(run) && time >= Q.kettleDelay) {
    const pays = kettlePays(run, valueOf());
    addPatience(run, pays);
    run.resources.qtLastRight = 1;
    run.resources.qtLastPays = pays;
    run.resources.qtTends = tendsSoFar(run) + 1;
    run.resources.qtStage = 0;
    run.resources.qtTime = 0;
    run.resources.qtWant = PATTERN[tendsSoFar(run) % PATTERN.length];
  }
}

/** One line for the panel: what the friend wants, or that they are resting. */
export function quietLine(run: RunState): string {
  if (isWanting(run)) return WANTS[currentWant(run)].clue;
  const last = tendsSoFar(run);
  if (last === 0) return "The friend sits very still. Wait for them.";
  return res(run, "qtLastRight") >= 1
    ? WANTS[PATTERN[(tendsSoFar(run) - 1 + PATTERN.length) % PATTERN.length]]
        .done
    : "That helped a little too. The friend is resting now.";
}

/** One button per answer; the friend panel draws them itself. */
export const QUIET_ACTIONS: readonly ActionDef[] = WANTS.map((want, i) => ({
  id: tendActionId(i),
  phases: [PHASE_QUIET],
  isInline: true,
  visibleWhen: isQuietOpen,
  describe: (run) => ({
    label: want.label,
    detail: isWanting(run)
      ? want.clue
      : "Nothing is wanted just yet. Waiting is fine.",
    isBlocked: !isWanting(run),
  }),
  perform: (run) => tendFriend(run, i, tendingValue(run)),
}));
