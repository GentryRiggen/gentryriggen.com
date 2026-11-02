import type { ActionDef, RunState } from "../../engine/types";
import { PHASE_FRIEND } from "./resources";
import { tendingValue } from "./tick";
import { TUNING } from "./tuning";

/**
 * Fetch: the puppy's game. Every little while the puppy trots back with a ball
 * and waits, tail going, for a throw. A throw makes a burst of smiles (a few
 * seconds of the friend's whole laugh), and then the puppy runs off to find
 * the ball again. A ball waits as long as it takes and nothing is ever lost.
 *
 * State is two hidden resources (`ftStage`, `ftTime`), so a save from before
 * reads as "no ball yet".
 */

const F = TUNING.fetch;

export const FETCH_ACTION_ID = "fetch-throw";

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** The game starts once the friend has a puppy. */
export const isFetchOpen = (run: RunState): boolean =>
  run.phase === 0 && owned(run, "puppy") >= 1;

export const isBallReady = (run: RunState): boolean =>
  isFetchOpen(run) && res(run, "ftStage") === 1;

export const throwsSoFar = (run: RunState): number => res(run, "ftThrows");

/** What one throw pays: a few seconds of the friend's whole laugh. */
export const throwPays = (run: RunState): number =>
  tendingValue(run) * F.seconds;

/** Runs the puppy's clock: after a rest, the ball is back. */
export function tickFetch(run: RunState, dt: number): void {
  if (!isFetchOpen(run) || res(run, "ftStage") === 1) return;
  const time = res(run, "ftTime") + dt;
  run.resources.ftTime = time;
  if (time >= F.restSeconds) {
    run.resources.ftStage = 1;
    run.resources.ftTime = 0;
  }
}

export const FETCH_ACTIONS: readonly ActionDef[] = [
  {
    id: FETCH_ACTION_ID,
    phases: [PHASE_FRIEND],
    visibleWhen: isFetchOpen,
    describe: (run) => {
      const ready = isBallReady(run);
      return {
        label: ready ? "Throw the ball" : "The puppy is fetching",
        detail: ready
          ? "A big happy burst of smiles. The puppy will be back with the ball soon."
          : "The puppy is off finding the ball. It never gets lost for long.",
        isBlocked: !ready,
        hint: ready ? { text: "fetch!", tone: "good" } : undefined,
      };
    },
    perform: (run) => {
      run.resources.smiles += throwPays(run);
      run.resources.ftStage = 0;
      run.resources.ftTime = 0;
      run.resources.ftThrows = throwsSoFar(run) + 1;
    },
  },
];
