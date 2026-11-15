import type { PlanetId } from "./planets";
import type { ToolId } from "./tools";

/** Points are a lifetime total and are never spent; crossing a threshold unlocks. */
export type Unlockable =
  { kind: "tool"; id: ToolId } | { kind: "planet"; id: PlanetId };

/** The 1.2 path, frozen: saves from before 1.3 keep what it had unlocked. */
export const LEGACY_UNLOCK_PATH_1_2: readonly {
  at: number;
  item: Unlockable;
}[] = [
  { at: 30, item: { kind: "tool", id: "meteorShower" } },
  { at: 120, item: { kind: "tool", id: "megaBomb" } },
  { at: 300, item: { kind: "tool", id: "nuke" } },
  { at: 600, item: { kind: "tool", id: "supervolcano" } },
  { at: 1000, item: { kind: "tool", id: "earthquake" } },
  { at: 1500, item: { kind: "tool", id: "alienLaser" } },
  { at: 2000, item: { kind: "planet", id: "mars" } },
  { at: 2600, item: { kind: "tool", id: "freezeRay" } },
  { at: 3400, item: { kind: "tool", id: "moonRam" } },
  { at: 4200, item: { kind: "planet", id: "ice" } },
  { at: 5200, item: { kind: "tool", id: "blackHole" } },
  { at: 6000, item: { kind: "tool", id: "nukeTwin" } },
  { at: 7000, item: { kind: "tool", id: "ufoSwarm" } },
  { at: 8200, item: { kind: "tool", id: "gravityBeam" } },
  { at: 9500, item: { kind: "tool", id: "nukeRain" } },
  { at: 11000, item: { kind: "tool", id: "nanobots" } },
  { at: 13000, item: { kind: "tool", id: "mothership" } },
  { at: 14500, item: { kind: "tool", id: "monster" } },
  { at: 16000, item: { kind: "tool", id: "tsunami" } },
  { at: 18000, item: { kind: "tool", id: "sunDive" } },
  { at: 20000, item: { kind: "tool", id: "planetCollision" } },
];

export const UNLOCK_PATH: readonly { at: number; item: Unlockable }[] = [
  { at: 25, item: { kind: "tool", id: "meteorShower" } },
  { at: 80, item: { kind: "tool", id: "megaBomb" } },
  { at: 160, item: { kind: "tool", id: "nuke" } },
  { at: 3300, item: { kind: "tool", id: "nukeTwin" } },
  { at: 5600, item: { kind: "tool", id: "alienLaser" } },
  { at: 8000, item: { kind: "tool", id: "nukeRain" } },
  { at: 10800, item: { kind: "tool", id: "supervolcano" } },
  { at: 12500, item: { kind: "planet", id: "lava" } },
  { at: 15000, item: { kind: "tool", id: "ufoSwarm" } },
  { at: 19000, item: { kind: "tool", id: "monster" } },
  { at: 23500, item: { kind: "tool", id: "earthquake" } },
  { at: 28000, item: { kind: "tool", id: "gravityBeam" } },
  { at: 33000, item: { kind: "tool", id: "nanobots" } },
  { at: 38500, item: { kind: "tool", id: "mothership" } },
  { at: 44000, item: { kind: "tool", id: "tsunami" } },
  { at: 50000, item: { kind: "tool", id: "freezeRay" } },
  { at: 56000, item: { kind: "tool", id: "moonRam" } },
  { at: 72500, item: { kind: "planet", id: "mars" } },
  { at: 89000, item: { kind: "planet", id: "candy" } },
  { at: 105500, item: { kind: "tool", id: "blackHole" } },
  { at: 122000, item: { kind: "planet", id: "ice" } },
  { at: 138500, item: { kind: "planet", id: "ocean" } },
  { at: 158500, item: { kind: "tool", id: "sunDive" } },
  { at: 178500, item: { kind: "tool", id: "planetCollision" } },
];

const same = (a: Unlockable, b: Unlockable) =>
  a.kind === b.kind && a.id === b.id;

/** The key an item has in `Progress.owned`, like "tool:nuke". */
export const ownedKey = (item: Unlockable): string => `${item.kind}:${item.id}`;

/** True when the points reach the item or the save already owns it. */
export function isUnlocked(
  item: Unlockable,
  points: number,
  owned?: readonly string[]
): boolean {
  if (owned?.includes(ownedKey(item))) return true;
  const entry = UNLOCK_PATH.find((e) => same(e.item, item));
  return entry ? points >= entry.at : true; // asteroid and earth are free
}

/** Everything the 1.2 path had open at these points, as owned keys. */
export function legacyOwned(points: number): string[] {
  return LEGACY_UNLOCK_PATH_1_2.filter((e) => points >= e.at).map((e) =>
    ownedKey(e.item)
  );
}

/** Everything the current path has open at these points, as owned keys. */
export function pathOwned(points: number): string[] {
  return UNLOCK_PATH.filter((e) => points >= e.at).map((e) => ownedKey(e.item));
}

/** Newly crossed items; ones the save already owns do not count. */
export function unlocksBetween(
  prev: number,
  next: number,
  owned?: readonly string[]
): Unlockable[] {
  return UNLOCK_PATH.filter(
    (e) => e.at > prev && e.at <= next && !owned?.includes(ownedKey(e.item))
  ).map((e) => e.item);
}

/** The next item above `points` that the save does not already own. */
export function nextUnlock(
  points: number,
  owned?: readonly string[]
): { at: number; item: Unlockable } | null {
  return (
    UNLOCK_PATH.find(
      (e) => e.at > points && !owned?.includes(ownedKey(e.item))
    ) ?? null
  );
}
