import type { GrowSceneInfo } from "@/lib/ever-onward/universes/grow";
import type { LastBuy } from "../../universes/types";
import {
  BARROW,
  FRAME,
  GREENHOUSE,
  KEEPER,
  SILL_BOX,
  STAND,
  TEA,
  TREES,
  barrelAt,
  basketAt,
  bedAt,
  gardenerAt,
  hiveAt,
  type Point,
} from "./anchors";

export interface Callout extends Point {
  text: string;
}

type Place = (n: number, info: GrowSceneInfo) => Callout;

const at = (p: Point, text: string, dy = 0): Callout => ({
  x: p.x,
  y: p.y + dy,
  text,
});

const nth = (n: number, cap: number): number => Math.min(n, cap) - 1;

const PLACES: Record<string, Place> = {
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

/** Upgrades whose landing is a caption change, not a spot in the picture. */
export const CAPTION_ONLY: ReadonlySet<string> = new Set<string>();

/** The callout for a purchase, or null when the scene has no spot for it. */
export function calloutFor(
  buy: Pick<LastBuy, "upgradeId" | "n">,
  info: GrowSceneInfo
): Callout | null {
  if (info.phase !== "yard") return null;
  const place = PLACES[buy.upgradeId];
  return place ? place(buy.n, info) : null;
}

/** Upgrade ids with a callout (a test keeps this in step with the shop). */
export const CALLOUT_IDS: readonly string[] = Object.keys(PLACES);
