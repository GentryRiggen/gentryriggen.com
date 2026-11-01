import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";
import type { LastBuy } from "../../universes/types";
import {
  BARROW,
  AGENT,
  COMPOST,
  DITCH,
  FAIR_TENT,
  FARM_BARN,
  FARM_GLASS,
  FRAME,
  SILO,
  GREENHOUSE,
  KEEPER,
  SILL_BOX,
  STAND,
  TEA,
  TREES,
  barrelAt,
  basketAt,
  droneAt,
  fieldAt,
  bedAt,
  gardenerAt,
  hiveAt,
  tractorAt,
  wellAt,
  type Point,
} from "./anchors";

export interface Callout extends Point {
  text: string;
}

type Grow = GrowSceneInfo;
type Place = (n: number, info: GrowSceneInfo) => Callout;

const at = (p: Point, text: string, dy = 0): Callout => ({
  x: p.x,
  y: p.y + dy,
  text,
});

const nth = (n: number, cap: number): number => Math.min(n, cap) - 1;

const YARD_PLACES: Record<string, Place> = {
  sprinkler: (n) => at(bedAt(nth(n + 1, 8)), `Sprinkler ${n}`, 6),
  basket: (n) => at(basketAt(nth(n, 8)), `Basket ${n}`),
  mulch: (n) => at(SILL_BOX, `Mulch ${n}: richer soil`, 4),
  "rain-barrel": (n) => at(barrelAt(nth(n, 4)), "Rain barrel", 8),
  "bee-hive": (n) => at(hiveAt(nth(n, 8)), `Bee hive ${n}`),
  "bee-keeper": () => at(KEEPER, "Bee keeper"),
  "garden-hose": () => at(barrelAt(3), "Long hose", 8),
  gardener: (n) => at(gardenerAt(nth(n, 6)), `Gardener bot ${n}`),
  "compost-tea": () => at(TEA, "Compost tea"),
  wheelbarrow: () => at(BARROW, "Wheelbarrow"),
  greenhouse: () => at(GREENHOUSE, "Greenhouse", 20),
  orchard: () => at(TREES[1], "Little orchard", -10),
  "honey-stand": () => at(STAND, "Honey stand", 8),
  "cold-frame": () => at(FRAME, "Cold frame"),
};

const FARM_PLACES: Record<string, Place> = {
  scarecrow: (n) => at(fieldAt(nth(n, 8)), `Scarecrow ${n}`, 20),
  compost: () => at(COMPOST, "Compost heap", -8),
  well: (n) => at(wellAt(nth(n, 6)), `Well ${n}`, -12),
  tractor: (n) => at(tractorAt(nth(n, 4)), `Tractor ${n}`),
  "market-agent": () => at(AGENT, "Market agent"),
  irrigation: () => at(DITCH, "Irrigation ditches", -6),
  silo: () => at(SILO, "Silo", 56),
  glasshouse: () => at(FARM_GLASS, "Glasshouse", 20),
  "seed-drone": (n) => at(droneAt(nth(n, 4)), `Seed drone ${n}`, -8),
  "fair-hand": () => at(FAIR_TENT, "Fair helper", 20),
  "grain-barn": () => at(FARM_BARN, "Grain barn", 20),
};

const PLACES: Record<Grow["phase"], Record<string, Place>> = {
  yard: YARD_PLACES,
  farm: FARM_PLACES,
  world: {},
  seed: {},
};

/** Upgrades whose landing is a caption change, not a spot in the picture. */
export const CAPTION_ONLY: ReadonlySet<string> = new Set<string>();

/** The callout for a purchase, or null when the scene has no spot for it. */
export function calloutFor(
  buy: Pick<LastBuy, "upgradeId" | "n">,
  info: GrowSceneInfo
): Callout | null {
  const place = PLACES[info.phase][buy.upgradeId];
  return place ? place(buy.n, info) : null;
}

/** Upgrade ids with a callout (a test keeps this in step with the shop). */
export const CALLOUT_IDS: readonly string[] = Object.keys(YARD_PLACES);

/** The farm's upgrade ids with a callout. */
export const FARM_CALLOUT_IDS: readonly string[] = Object.keys(FARM_PLACES);
