import type { RunState } from "../../engine/types";
import { bestCrop, cropPrice, plantedCrop, type Crop } from "./market";
import { FULL_GROWTH, PHASE_IDS, type GrowPhaseId } from "./resources";
import { seasonOf, type Season } from "./seasons";
import { BEE_KEEPER_ID } from "./bees";
import { isDry, waterLevel } from "./water";

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
  /** Yard, in the order the picture draws them (all quantized). */
  beds: number;
  /** How lush the garden is, 0 to 1 in tenths. */
  bloom: number;
  /** The water tank, 0 to 1 in tenths. */
  waterFraction: number;
  sprinklers: number;
  bees: number;
  gardeners: number;
  isDry: boolean;
  greenhouse: boolean;
  orchard: boolean;
  stand: boolean;
  barrow: boolean;
  tea: boolean;
  keeper: boolean;
  /** Farm: fields in the picture, tractors, glasshouses, wells, and how well the planted crop matches what the towns want (0 to 1 in tenths). */
  fields: number;
  tractors: number;
  greenhouses: number;
  wells: number;
  silos: number;
  /** The market agent is hired. */
  agent: boolean;
  townFed: number;
  /** Seed phase: whole percent of the pot grown. */
  growth: number;
}

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

const HELPERS = ["sprinkler", "scarecrow", "windbreak", "trellis"];
const SCALES = ["mulch", "compost", "rain-makers", "sunny-sill"];
const ENDERS = ["cold-frame", "grain-barn", "seed-vault", ""];

const tenths = (n: number): number =>
  Math.round(Math.min(1, Math.max(0, n)) * 10) / 10;

/** The backyard's extra numbers; zeros and falses outside the yard. */
function yardInfo(
  run: RunState,
  isYard: boolean
): Pick<
  GrowSceneInfo,
  | "beds"
  | "bloom"
  | "waterFraction"
  | "sprinklers"
  | "bees"
  | "gardeners"
  | "isDry"
  | "greenhouse"
  | "orchard"
  | "stand"
  | "barrow"
  | "tea"
  | "keeper"
> {
  const has = (id: string) => isYard && owned(run, id) > 0;
  const n = (id: string) => (isYard ? owned(run, id) : 0);
  const crew =
    n("sprinkler") + n("basket") + n("bee-hive") + n("gardener") + n("mulch");
  return {
    beds: isYard ? Math.min(8, 1 + n("sprinkler")) : 0,
    bloom: isYard ? tenths(0.1 + crew / 30) : 0,
    waterFraction: isYard ? tenths(waterLevel(run)) : 0,
    sprinklers: n("sprinkler"),
    bees: n("bee-hive"),
    gardeners: n("gardener"),
    isDry: isYard && isDry(run),
    greenhouse: has("greenhouse"),
    orchard: has("orchard"),
    stand: has("honey-stand"),
    barrow: has("wheelbarrow"),
    tea: has("compost-tea"),
    keeper: has(BEE_KEEPER_ID),
  };
}

/** The farm's extra numbers; zeros outside the farm. */
function farmInfo(
  run: RunState,
  isFarm: boolean
): Pick<
  GrowSceneInfo,
  | "fields"
  | "tractors"
  | "greenhouses"
  | "wells"
  | "silos"
  | "agent"
  | "townFed"
> {
  const n = (id: string) => (isFarm ? owned(run, id) : 0);
  return {
    fields: isFarm ? Math.min(8, 1 + n("scarecrow")) : 0,
    tractors: n("tractor"),
    greenhouses: n("glasshouse"),
    wells: n("well"),
    silos: n("silo"),
    agent: n("market-agent") > 0,
    townFed: isFarm
      ? tenths(cropPrice(run, plantedCrop(run)) / cropPrice(run, bestCrop(run)))
      : 0,
  };
}

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
    ...yardInfo(run, i === 0),
    ...farmInfo(run, i === 1),
    isDry: i <= 1 && isDry(run),
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
