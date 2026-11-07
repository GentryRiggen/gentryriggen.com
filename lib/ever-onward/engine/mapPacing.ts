import { counted, freshRun } from "./map";
import { routeStep } from "./mapRoute";
import { simulate, type Strategy } from "./sim";
import type { UniverseDef, UniverseSave } from "./types";
import { newUniverseSave } from "./prestige";

export interface RouteRun {
  square: string;
  finishTime: number;
  found: number;
}

/**
 * Plays `runs` runs along the route bot's path (each run by `strategy`),
 * returning each run's finish time. Used by the pacing tests and M13.
 */
export function playRoute(
  def: UniverseDef,
  strategy: Strategy,
  runs: number,
  options: { step?: number; maxSeconds?: number; allOn?: boolean } = {}
): RouteRun[] {
  let save: UniverseSave = newUniverseSave(def);
  if (options.allOn)
    save = {
      ...save,
      map: { ...save.map!, found: def.map!.artifacts.map((a) => a.id) },
    };
  const out: RouteRun[] = [];
  for (let i = 0; i < runs; i += 1) {
    const result = simulate(def, {
      strategy,
      maxSeconds: options.maxSeconds ?? 8 * 3600,
      step: options.step ?? 1,
      startRun: freshRun(def, save),
    });
    const finished = { ...save, run: result.finalRun };
    out.push({
      square: save.map!.at,
      finishTime: result.finishTime ?? Infinity,
      found: counted(def, finished).found.length,
    });
    const target = routeStep(def, finished);
    const map = { ...counted(def, finished), at: target };
    save = { ...finished, map, run: freshRun(def, { ...finished, map }) };
  }
  return out;
}
