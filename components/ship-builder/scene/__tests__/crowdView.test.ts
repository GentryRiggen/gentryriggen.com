import { personWorldTransform } from "../crowdView";
import { DECK_Y, LEVEL_HEIGHT } from "../coords";
import type { PersonPose } from "@/lib/ship-builder/crowd/types";
import type { WalkGrid } from "@/lib/ship-builder/walk";

const grid = {
  surfaceHeight: (_x: number, _z: number, level: number) =>
    level === 1 ? 0.9 : level,
} as unknown as WalkGrid;

function pose(over: Partial<PersonPose> = {}): PersonPose {
  return { x: 3.5, z: 1.5, level: 0, yaw: 0, activity: "walk", ...over };
}

describe("personWorldTransform", () => {
  it("maps model x and z to world x and z", () => {
    const t = personWorldTransform(pose(), grid, 40, 6);
    expect(t.x).toBeCloseTo(20 - 3.5);
    expect(t.z).toBeCloseTo(3 - 1.5);
  });

  it("stands on the floor height of the level", () => {
    expect(personWorldTransform(pose(), grid, 40, 6).y).toBeCloseTo(DECK_Y);
    expect(personWorldTransform(pose({ level: 2 }), grid, 40, 6).y).toBeCloseTo(
      DECK_Y + 2 * LEVEL_HEIGHT
    );
  });

  it("uses the surface height where a roof sits a little low", () => {
    expect(personWorldTransform(pose({ level: 1 }), grid, 40, 6).y).toBeCloseTo(
      DECK_Y + 0.9 * LEVEL_HEIGHT
    );
  });

  it("turns the figure so yaw 0 faces the bow (world +X)", () => {
    const rotation = (yaw: number) =>
      personWorldTransform(pose({ yaw }), grid, 40, 6).rotationY;
    // A mesh facing local +X rotated by r faces (cos r, -sin r) in (x, z).
    const facing = (r: number) => [Math.cos(r), -Math.sin(r)];
    expect(facing(rotation(0))[0]).toBeCloseTo(1);
    expect(facing(rotation(0))[1]).toBeCloseTo(0);
    // Yaw PI / 2 looks to starboard, world +Z.
    expect(facing(rotation(Math.PI / 2))[0]).toBeCloseTo(0);
    expect(facing(rotation(Math.PI / 2))[1]).toBeCloseTo(1);
  });
});
