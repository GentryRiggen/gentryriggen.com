/** Hull size of each open lifeboat that hangs from a davit, in world units. */
export interface LifeboatHull {
  length: number;
  width: number;
  /** Depth of the hull below its rim. */
  depth: number;
}

export const LIFEBOAT_HULLS: Readonly<Record<string, LifeboatHull>> = {
  "lifeboat-standard": { length: 0.9, width: 0.35, depth: 0.3 },
  "lifeboat-collapsible": { length: 0.9, width: 0.35, depth: 0.2 },
  "lifeboat-large": { length: 1.9, width: 0.45, depth: 0.35 },
};

/** A boat hangs with its rim this far below its attach point. */
export const LIFEBOAT_HANG_OFFSET = 0.1;

/** The hull of a lifeboat type, or the standard boat's for any other. */
export function lifeboatHullOf(type: string): LifeboatHull {
  return LIFEBOAT_HULLS[type] ?? LIFEBOAT_HULLS["lifeboat-standard"];
}
