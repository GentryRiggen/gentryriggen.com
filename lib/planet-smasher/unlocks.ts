import type { PlanetId } from "./planets";
import type { ToolId } from "./tools";

/** Points are a lifetime total and are never spent; crossing a threshold unlocks. */
export type Unlockable =
  { kind: "tool"; id: ToolId } | { kind: "planet"; id: PlanetId };

export const UNLOCK_PATH: readonly { at: number; item: Unlockable }[] = [
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
];

const same = (a: Unlockable, b: Unlockable) =>
  a.kind === b.kind && a.id === b.id;

export function isUnlocked(item: Unlockable, points: number): boolean {
  const entry = UNLOCK_PATH.find((e) => same(e.item, item));
  return entry ? points >= entry.at : true; // asteroid and earth are free
}

export function unlocksBetween(prev: number, next: number): Unlockable[] {
  return UNLOCK_PATH.filter((e) => e.at > prev && e.at <= next).map(
    (e) => e.item
  );
}

export function nextUnlock(
  points: number
): { at: number; item: Unlockable } | null {
  return UNLOCK_PATH.find((e) => e.at > points) ?? null;
}
