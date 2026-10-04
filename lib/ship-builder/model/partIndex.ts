import type { PlacedPart, Ship } from "./types";

interface PartIndex {
  /** How many of the parts array's entries are indexed. */
  count: number;
  byId: Map<string, PlacedPart>;
  /** Attach parts by `parentId/pointId`. */
  byAnchor: Map<string, PlacedPart>;
}

const indexes = new WeakMap<readonly PlacedPart[], PartIndex>();

function anchorKey(parentId: string, pointId: string): string {
  return `${parentId}/${pointId}`;
}

/**
 * Parts by id and by attach anchor, cached per parts array. Ships replace
 * their parts array on every edit; the only in-place change is a build
 * appending parts (see addToBuild), so the index catches up from where it
 * left off. Like Array#find, the first part with a given key wins.
 */
function partIndex(ship: Ship): PartIndex {
  const { parts } = ship;
  let index = indexes.get(parts);
  if (!index || index.count > parts.length) {
    index = { count: 0, byId: new Map(), byAnchor: new Map() };
    indexes.set(parts, index);
  }
  for (; index.count < parts.length; index.count++) {
    const part = parts[index.count];
    if (!index.byId.has(part.id)) index.byId.set(part.id, part);
    if (part.anchor.kind === "attach") {
      const key = anchorKey(part.anchor.parentId, part.anchor.pointId);
      if (!index.byAnchor.has(key)) index.byAnchor.set(key, part);
    }
  }
  return index;
}

export function partById(ship: Ship, id: string): PlacedPart | undefined {
  return partIndex(ship).byId.get(id);
}

/** The first part attached at this parent's point, if any. */
export function partAt(
  ship: Ship,
  parentId: string,
  pointId: string
): PlacedPart | undefined {
  return partIndex(ship).byAnchor.get(anchorKey(parentId, pointId));
}
