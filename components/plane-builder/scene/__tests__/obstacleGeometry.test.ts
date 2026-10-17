import { buildObstacleGeometry } from "../obstacleGeometry";
import type {
  LevelPalette,
  ObstacleKind,
} from "@/lib/plane-builder/levels/types";

const PALETTE = { soft: "#3f8f4a", hard: "#a0a4aa" } as LevelPalette;
const KINDS: ObstacleKind[] = [
  "tree",
  "barn",
  "balloon",
  "wall",
  "arch",
  "bird",
  "palm",
  "skyscraper",
  "iceberg",
  "cloud",
  "peak",
];
const TOLERANCE = 1e-3;
// The barn roof deliberately overhangs its walls by a couple of percent.
const EAVES: Partial<Record<ObstacleKind, number>> = { barn: 0.03 };

describe("buildObstacleGeometry", () => {
  it.each(KINDS)(
    "builds a non-empty coloured %s inside the unit box",
    (kind) => {
      const geometry = buildObstacleGeometry(kind, PALETTE);
      const positionCount = geometry.getAttribute("position").count;
      expect(positionCount).toBeGreaterThan(0);
      expect(geometry.getAttribute("color").count).toBe(positionCount);

      const tolerance = TOLERANCE + (EAVES[kind] ?? 0);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      expect(box).not.toBeNull();
      for (const axis of ["x", "y", "z"] as const) {
        expect(box!.min[axis]).toBeGreaterThanOrEqual(-0.5 - tolerance);
        expect(box!.max[axis]).toBeLessThanOrEqual(0.5 + tolerance);
      }
    }
  );
});
