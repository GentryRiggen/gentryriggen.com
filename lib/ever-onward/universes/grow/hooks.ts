import type { ConsumableDef, RunState } from "../../engine/types";
import { isSameSceneInfo, sceneInfo } from "./scene";

/** Systems asking for the player's attention: only the tap, for now. */
export function growPlates(run: RunState): string[] {
  void run;
  return ["tap"];
}

/** No plate here needs hands beyond the tap yet. */
export const GROW_PLATE_ACTIONS: Readonly<Record<string, readonly string[]>> =
  {};

/** Nothing to keep topped up yet. */
export const GROW_CONSUMABLES: readonly ConsumableDef[] = [];

/** Nothing to take out of the income probes yet. */
export const growIncomeView = (run: RunState): RunState => run;

/** True when the picture differs between two runs. */
export const growSceneDiff = (before: RunState, after: RunState): boolean =>
  !isSameSceneInfo(sceneInfo(before), sceneInfo(after));
