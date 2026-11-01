import type { RunState } from "../../engine/types";
import { plantedCrop, type Crop } from "./market";
import { FULL_GROWTH, PHASE_IDS, type GrowPhaseId } from "./resources";
import { seasonOf, type Season } from "./seasons";
import { isDry } from "./water";

/** The few numbers the picture needs; the scene redraws only when they change. */
export interface GrowSceneInfo {
  phase: GrowPhaseId;
  /** Helpers owned in this phase. */
  helpers: number;
  /** Scaling levels owned in this phase. */
  scaling: number;
  /** Whether this phase's ending purchase is made. */
  ended: boolean;
  /** Yard: bee hives, baskets and gardeners, rain barrels and hoses. */
  hives: number;
  pickers: number;
  storage: number;
  /** Farm: tractors, glasshouses and seed drones, and the crop planted. */
  machines: number;
  crop: Crop;
  /** Yard and farm: the season (spring on the farm), and whether the tank has run dry. */
  season: Season;
  dry: boolean;
  /** Seed phase: whole percent of the pot grown. */
  growth: number;
}

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

const HELPERS = ["sprinkler", "scarecrow", "windbreak", "trellis"];
const SCALES = ["mulch", "compost", "rain-makers", "sunny-sill"];
const ENDERS = ["cold-frame", "grain-barn", "seed-vault", ""];

export function sceneInfo(run: RunState): GrowSceneInfo {
  const i = Math.min(Math.max(run.phase, 0), PHASE_IDS.length - 1);
  return {
    phase: PHASE_IDS[i],
    helpers: owned(run, HELPERS[i]),
    scaling: owned(run, SCALES[i]),
    hives: i === 0 ? owned(run, "bee-hive") : 0,
    pickers: i === 0 ? owned(run, "basket") + owned(run, "gardener") : 0,
    machines:
      i === 1
        ? owned(run, "tractor") +
          owned(run, "glasshouse") +
          owned(run, "seed-drone")
        : 0,
    crop: i === 1 ? plantedCrop(run) : "tomato",
    storage:
      i === 0
        ? owned(run, "rain-barrel") + owned(run, "garden-hose")
        : i === 1
          ? owned(run, "well") + owned(run, "irrigation")
          : 0,
    season: i === 0 ? seasonOf(run) : "spring",
    dry: i <= 1 && isDry(run),
    ended: ENDERS[i] !== "" && owned(run, ENDERS[i]) > 0,
    growth: Math.floor(
      Math.min(FULL_GROWTH, Math.max(0, run.resources.growth ?? 0))
    ),
  };
}

export function isSameSceneInfo(a: GrowSceneInfo, b: GrowSceneInfo): boolean {
  return (Object.keys(a) as (keyof GrowSceneInfo)[]).every(
    (k) => a[k] === b[k]
  );
}
