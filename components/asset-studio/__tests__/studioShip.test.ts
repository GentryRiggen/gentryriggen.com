import { PART_TYPES } from "@/lib/ship-builder/model/types";
import { buildStudioScene } from "../studioShip";

describe("buildStudioScene", () => {
  it.each([...PART_TYPES])("finds a place for %s", (type) => {
    const scene = buildStudioScene(type);
    expect(scene.candidate.type).toBe(type);
    expect(scene.origin).toHaveLength(3);
  });
});
