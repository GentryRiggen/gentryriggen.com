import type { RunState } from "../../engine/types";
import {
  BIOMES,
  biomeShare,
  blightOf,
  justBlighted,
  justHealed,
  worldCover,
  type Biome,
} from "./biomes";
import {
  FIELD_CROPS,
  grownNow,
  harvestDays,
  isDayShowing,
  isFieldPlanted,
  lastDay,
  plantedCrop,
  secondsToHarvest,
  soilOf,
  type FieldCrop,
} from "./market";
import {
  isDayFree,
  isOutcomeShowing,
  isPumpkinOpen,
  lastPumpkin,
  pumpkinEvents,
  pumpkinStep,
  isJudging,
} from "./pumpkin";
import { FULL_GROWTH, PHASE_IDS, type GrowPhaseId } from "./resources";
import { seasonOf, type Season } from "./seasons";
import {
  BEDS,
  BEE_KEEPER_ID,
  beesHome,
  beesOn,
  bloomOf,
  honeyOf,
  isBeesOpen,
  isLeaving,
  isPlanted,
  justCrossed,
  justWilted,
  rareCount,
  winterNeeds,
} from "./bees";
import { isDry, waterLevel } from "./water";
import { FORK_IDS, forkSide } from "./forks";
import { isFestivalOn, isProjectDone } from "./knowhow";
import { TUNING } from "./tuning";
import { visitorHereFlag } from "../../engine/engine";
import { RETURN_VISITOR_ID } from "./visitors";
import {
  DEEP_POT_ID,
  LANTERN_ID,
  leafOf,
  lightOf,
  momentOf,
  potGrowth,
  potStage,
  skyOf,
  sunOnPot,
  type LeafMood,
  type PotMoment,
  type PotStage,
  type SkyId,
} from "./windowbox";

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
  crop: FieldCrop;
  /** World: how much of the planet is green, and each biome's share (twentieths). */
  cover: number;
  forest: number;
  jungle: number;
  meadow: number;
  wetland: number;
  /** World: each biome's rot in tenths, "forest|jungle|meadow|wetland" ("0|0|0|0" when healthy). */
  blight: string;
  /** World: the rot has just shown, or the world has just healed (a few seconds each). */
  blightNew: boolean;
  healed: boolean;
  /** World: how full the planet's water is, 0 to 10 (rivers, wetlands and cracks read it). */
  worldWater: number;
  /** World: how much of the globe is green, in twentieths (the pull-back picture). */
  greenFraction: number;
  /** World: river bends, clouds drifting, and flocks of seed birds in the picture. */
  rivers: number;
  clouds: number;
  flocks: number;
  /** World: how much of the old roads and towns the picture still draws (0 to 1 in tenths). Drawn only, never shown as a number or a label. */
  roadsLeft: number;
  townsLeft: number;
  /** This part's fork: 0 not chosen, 1 the first side, 2 the second. */
  fork: number;
  /** Farm and world: which know-how projects are done (bit 0, 1 and 2). */
  projects: number;
  /** Farm and world: a festival is on. */
  festival: boolean;
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
  greenhouse: boolean;
  orchard: boolean;
  stand: boolean;
  barrow: boolean;
  tea: boolean;
  keeper: boolean;
  /**
   * Yard pollination, flat so the picture's equality check stays cheap: one
   * "planted:bees:bloom-tenths:wilting" group per bed, joined by "|", or ""
   * before the first hive. Bees are capped at 6 a bed for drawing.
   */
  flowerBeds: string;
  /** Bees resting at the hives (drawn, up to 6). */
  beesIdle: number;
  /** Honey jars on the shelf, 0 to 6 (6: a winter's worth or more). */
  honeyJars: number;
  /** Rare flowers grown, and the pair crossing right now (-1: none). */
  rare: number;
  crossPair: number;
  /** Hungry bees are flying away (winter, no honey). */
  leaving: boolean;
  /**
   * Farm: how grown the crop is (0 an empty field, 1 a sprout, 2 young, 3
   * growing, 4 ready), the soil (0 worn out and pale to 4 dark and rich),
   * the cart on its way (0 far off to 4 at the gate), and the last harvest
   * day's mood ("cheer", "droop", "beans" or "empty") while the scene shows
   * it, with a count that changes with every harvest day.
   */
  cropStage: number;
  soil: number;
  cart: number;
  dayMood: string;
  dayN: number;
  /**
   * Farm: the prize pumpkin, flat: whether the fair is open, its size step
   * (0 to 5), whether today's feeding or entry is free, and what to show
   * ("", "judging:<step>", "blue:<step>", "red:<step>", "green:<step>" or
   * "split:<step>") with a count that changes on every ribbon or split.
   */
  pumpkinOpen: boolean;
  pumpkinStep: number;
  pumpkinFree: boolean;
  pumpkinShow: string;
  pumpkinN: number;
  /** Farm: fields in the picture, tractors, glasshouses, wells, and how many harvest days have been held (tenths of a town's windows). */
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
  /** Seed phase: soil, sprout, bud or bloom. */
  potStage: PotStage;
  /** Seed phase: the weather outside (it changes how much sun is right). */
  sky: SkyId;
  /** Seed phase: how the leaves look (the player reads these). */
  leaf: LeafMood;
  /** Seed phase: how far the blind is open, 0 to 8 eighths (it slides). */
  light: number;
  /** Seed phase: how hard the sun lands on the pot, 0 (none) to 3 (fierce). */
  glare: number;
  /** Seed phase: a thrive, or a dry or soggy spell, the scene is showing. */
  moment: PotMoment;
  /** Seed phase: the light is left on in the window. */
  windowLit: boolean;
  /** Seed phase: someone came back and is at the window. */
  visitorHere: boolean;
  /** Seed phase: what sits on the sill and window. */
  trellis: boolean;
  chime: boolean;
  dew: boolean;
  catcher: boolean;
  sunnySill: boolean;
  /** Seed phase: how many deeper pots (the pot sits in a bigger tray). */
  deepPot: number;
}

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

const HELPERS = ["sprinkler", "scarecrow", "windbreak", "trellis"];
const SCALES = ["mulch", "compost", "rain-makers", "sunny-sill"];
const ENDERS = ["cold-frame", "grain-barn", "seed-vault", ""];

const tenths = (n: number): number =>
  Math.round(Math.min(1, Math.max(0, n)) * 10) / 10;

/** The old window box's extra numbers; bare outside the seed phase. */
function seedInfo(
  run: RunState,
  isSeed: boolean
): Pick<
  GrowSceneInfo,
  | "potStage"
  | "sky"
  | "leaf"
  | "light"
  | "glare"
  | "moment"
  | "windowLit"
  | "visitorHere"
  | "trellis"
  | "chime"
  | "dew"
  | "catcher"
  | "sunnySill"
  | "deepPot"
> {
  const has = (id: string) => isSeed && owned(run, id) > 0;
  const grown = isSeed ? potGrowth(run) : 0;
  return {
    potStage: isSeed ? potStage(run) : "soil",
    sky: isSeed ? (skyOf(run).id as SkyId) : "cloud",
    leaf: isSeed ? leafOf(run) : "perky",
    light: isSeed ? Math.round(lightOf(run) * 8) : 0,
    glare: isSeed ? Math.min(3, Math.floor(sunOnPot(run) / 0.3)) : 0,
    moment: isSeed ? momentOf(run) : "",
    // The robot leaves a light on near the end, and the lantern keeps one.
    windowLit: has(LANTERN_ID) || (isSeed && grown >= 0.85),
    visitorHere:
      isSeed && run.flags[visitorHereFlag(RETURN_VISITOR_ID)] === true,
    trellis: has("trellis"),
    chime: has("wind-chime"),
    dew: has("dew-collector"),
    catcher: has("sun-catcher"),
    sunnySill: has("sunny-sill"),
    deepPot: isSeed ? Math.min(3, owned(run, DEEP_POT_ID)) : 0,
  };
}

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
  | "greenhouse"
  | "orchard"
  | "stand"
  | "barrow"
  | "tea"
  | "keeper"
  | "flowerBeds"
  | "beesIdle"
  | "honeyJars"
  | "rare"
  | "crossPair"
  | "leaving"
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
    greenhouse: has("greenhouse"),
    orchard: has("orchard"),
    stand: has("honey-stand"),
    barrow: has("wheelbarrow"),
    tea: has("compost-tea"),
    keeper: has(BEE_KEEPER_ID),
    ...pollenInfo(run, isYard),
  };
}

function pollenInfo(run: RunState, isYard: boolean) {
  if (!isYard || !isBeesOpen(run))
    return {
      flowerBeds: "",
      beesIdle: 0,
      honeyJars: 0,
      rare: 0,
      crossPair: -1,
      leaving: false,
    };
  const need = Math.max(1, winterNeeds(run));
  return {
    flowerBeds: BEDS.map((_, i) =>
      [
        isPlanted(run, i) ? 1 : 0,
        Math.min(6, beesOn(run, i)),
        Math.round(bloomOf(run, i) * 10),
        justWilted(run, i) ? 1 : 0,
      ].join(":")
    ).join("|"),
    beesIdle: Math.min(6, beesHome(run)),
    honeyJars: Math.min(6, Math.round((honeyOf(run) / need) * 6)),
    rare: rareCount(run),
    crossPair: justCrossed(run) ? (run.resources.pbCrossPair ?? 0) : -1,
    leaving: isLeaving(run),
  };
}

/** How grown the planted crop is, in the five steps the picture draws. */
function cropStageOf(run: RunState): number {
  if (!isFieldPlanted(run)) return 0;
  const g = grownNow(run);
  return g < 0.2 ? 1 : g < 0.55 ? 2 : g < 1 ? 3 : 4;
}

/** The pumpkin's flat "what to show" string (see GrowSceneInfo). */
function pumpkinShowOf(run: RunState): string {
  if (isJudging(run))
    return `judging:${Math.round(run.resources.pkEnterStep ?? 0)}`;
  if (!isOutcomeShowing(run)) return "";
  const { outcome, step } = lastPumpkin(run);
  return outcome === "none" ? "" : `${outcome}:${step}`;
}

/** Harvest day, soil and the prize pumpkin; bare outside the farm. */
function farmDayInfo(
  run: RunState,
  isFarm: boolean
): Pick<
  GrowSceneInfo,
  | "cropStage"
  | "soil"
  | "cart"
  | "dayMood"
  | "dayN"
  | "pumpkinOpen"
  | "pumpkinStep"
  | "pumpkinFree"
  | "pumpkinShow"
  | "pumpkinN"
> {
  if (!isFarm)
    return {
      cropStage: 0,
      soil: 0,
      cart: 0,
      dayMood: "",
      dayN: 0,
      pumpkinOpen: false,
      pumpkinStep: 0,
      pumpkinFree: false,
      pumpkinShow: "",
      pumpkinN: 0,
    };
  const showing = isDayShowing(run);
  const open = isPumpkinOpen(run);
  return {
    cropStage: cropStageOf(run),
    soil: Math.round(soilOf(run) * 4),
    // The cart rolls in over the last stretch of the day.
    cart: Math.min(
      4,
      Math.max(
        0,
        Math.floor((1 - secondsToHarvest(run) / TUNING.market.cartSeconds) * 4)
      )
    ),
    dayMood: showing ? lastDay(run).mood : "",
    dayN: harvestDays(run),
    pumpkinOpen: open,
    pumpkinStep: open ? pumpkinStep(run) : 0,
    pumpkinFree: open && isDayFree(run),
    pumpkinShow: open ? pumpkinShowOf(run) : "",
    pumpkinN: pumpkinEvents(run),
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
  | "cropStage"
  | "soil"
  | "cart"
  | "dayMood"
  | "dayN"
  | "pumpkinOpen"
  | "pumpkinStep"
  | "pumpkinFree"
  | "pumpkinShow"
  | "pumpkinN"
> {
  const n = (id: string) => (isFarm ? owned(run, id) : 0);
  return {
    fields: isFarm ? Math.min(8, 1 + n("scarecrow")) : 0,
    tractors: n("tractor"),
    greenhouses: n("glasshouse"),
    wells: n("well"),
    silos: n("silo"),
    agent: n("market-agent") > 0,
    townFed: isFarm ? tenths(harvestDays(run) / 16) : 0,
    ...farmDayInfo(run, isFarm),
  };
}

/** The world's extra numbers, in tenths; bare outside the world. */
function worldInfo(
  run: RunState,
  isWorld: boolean
): Pick<
  GrowSceneInfo,
  | "cover"
  | "forest"
  | "jungle"
  | "meadow"
  | "wetland"
  | "blight"
  | "blightNew"
  | "healed"
  | "worldWater"
  | "greenFraction"
  | "rivers"
  | "clouds"
  | "flocks"
  | "roadsLeft"
  | "townsLeft"
> {
  const share = (b: Biome) =>
    isWorld ? Math.round(biomeShare(run, b) * 20) : 0;
  const cover = isWorld ? worldCover(run) : 0;
  const n = (id: string) => (isWorld ? owned(run, id) : 0);
  return {
    greenFraction: Math.round(cover * 20) / 20,
    rivers: Math.min(6, n("river-bend")),
    clouds: isWorld ? 2 + Math.min(4, n("cloud-seeder")) : 0,
    flocks: Math.min(5, n("sky-seeder")),
    // Roads go quiet first, towns a little later; both are only drawn.
    roadsLeft: isWorld ? tenths(1 - (cover - 0.05) / 0.7) : 0,
    townsLeft: isWorld ? tenths(1 - (cover - 0.15) / 0.7) : 0,
    cover: isWorld ? Math.round(worldCover(run) * 20) : 0,
    forest: share(BIOMES[0]),
    jungle: share(BIOMES[1]),
    meadow: share(BIOMES[2]),
    wetland: share(BIOMES[3]),
    blight: BIOMES.map((b) =>
      isWorld ? Math.round(blightOf(run, b) * 10) : 0
    ).join("|"),
    blightNew: isWorld && justBlighted(run),
    healed: isWorld && justHealed(run),
    worldWater: isWorld ? tenths(waterLevel(run)) : 0,
  };
}

const PROJECT_IDS: readonly (readonly string[])[] = [
  [],
  ["drip-lines", "compost-heap", "hybrid-seed"],
  ["rain-gauges", "tree-nursery", "wildlife-corridors"],
  [],
];

/** The done projects of the part the run is in, as bits (first is bit 0). */
function projectBits(run: RunState, phase: number): number {
  return PROJECT_IDS[phase].reduce(
    (bits, id, bit) => bits | (isProjectDone(run, id) ? 1 << bit : 0),
    0
  );
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
        : i === 2
          ? owned(run, "planting-rover") + owned(run, "sky-seeder")
          : 0,
    crop: i === 1 ? plantedCrop(run) : FIELD_CROPS[0],
    ...worldInfo(run, i === 2),
    storage:
      i === 0
        ? owned(run, "rain-barrel") + owned(run, "garden-hose")
        : i === 1
          ? owned(run, "well") + owned(run, "irrigation")
          : i === 2
            ? owned(run, "river-bend") + owned(run, "cloud-seeder")
            : 0,
    season: i === 0 ? seasonOf(run) : "spring",
    dry: i <= 2 && isDry(run),
    ...yardInfo(run, i === 0),
    ...farmInfo(run, i === 1),
    ...seedInfo(run, i === 3),
    fork: (() => {
      const side = forkSide(run, FORK_IDS[i]);
      return side === null ? 0 : side + 1;
    })(),
    projects: projectBits(run, i),
    festival: (i === 1 || i === 2) && isFestivalOn(run),
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
