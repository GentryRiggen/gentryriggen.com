import {
  attachPointsOf,
  claimedKeys,
  openAttachPoints,
  type PointSource,
} from "./attach";
import type { Occupancy } from "./grid";
import { occupancyOf } from "./occupancyCache";
import { computeStats, type Stats } from "./stats";
import type { AttachPartDef, AttachPoint, PartType, Ship } from "./types";

export interface OpenAttachPoint {
  parentId: string;
  point: AttachPoint;
}

/**
 * Everything derived from one ship that several parts of the app need. Shared
 * between callers: treat every field as read-only.
 */
export interface ShipAnalysis {
  readonly ship: Ship;
  readonly occupancy: Occupancy;
  readonly stats: Stats;
  /** Free points this attach part could go on, cached per part type. */
  openAttachPoints(def: AttachPartDef): readonly OpenAttachPoint[];
}

const analyses = new WeakMap<Ship, ShipAnalysis>();

function lazy<T>(compute: () => T): () => T {
  let cached: { value: T } | undefined;
  return () => {
    cached ??= { value: compute() };
    return cached.value;
  };
}

function createAnalysis(ship: Ship): ShipAnalysis {
  const occupancy = occupancyOf(ship);
  const getStats = lazy(() => computeStats(ship));
  const pointsByParent = new Map<string, AttachPoint[]>();
  const getClaimed = lazy(() => claimedKeys(ship, occupancy));
  const source: PointSource = {
    get claimed() {
      return getClaimed();
    },
    pointsOf(parentId) {
      let points = pointsByParent.get(parentId);
      if (!points) {
        points = attachPointsOf(ship, parentId, occupancy);
        pointsByParent.set(parentId, points);
      }
      return points;
    },
  };
  const openByType = new Map<PartType, readonly OpenAttachPoint[]>();

  return {
    ship,
    occupancy,
    get stats() {
      return getStats();
    },
    openAttachPoints(def) {
      let open = openByType.get(def.type);
      if (!open) {
        open = openAttachPoints(ship, def, source);
        openByType.set(def.type, open);
      }
      return open;
    },
  };
}

/**
 * The ship's occupancy, stats and open attach points, worked out once per
 * ship object. Ships are replaced on every edit, so an edited ship gets a
 * fresh analysis and the old one is collected with it.
 */
export function analyzeShip(ship: Ship): ShipAnalysis {
  const cached = analyses.get(ship);
  if (cached && cached.occupancy === occupancyOf(ship)) return cached;
  const analysis = createAnalysis(ship);
  analyses.set(ship, analysis);
  return analysis;
}
