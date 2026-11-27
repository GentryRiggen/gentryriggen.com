import { walkMapFor, type WalkMap } from "../../walk";
import { DOOR_REACH_M, doorExit, doorToEnter, type DepthAt } from "../doorExit";

const map = walkMapFor("titanic") as WalkMap;
const door = (id: string) => map.stairs.find((s) => s.id === id)!;
const DRY: DepthAt = () => -5;

/** Dry everywhere except the areas listed (flooded 1 m deep). */
const floodedIn =
  (...areas: string[]): DepthAt =>
  (area) =>
    areas.includes(area) ? 1 : -5;

describe("doorExit (Go outside)", () => {
  it("goes out by the door you came in by, facing away from her house", () => {
    const out = doorExit(map, "gs-door-port", DRY, [35.5, -4]);
    const d = door("gs-door-port");
    expect(out).toMatchObject({
      id: "gs-door-port",
      area: d.from.area,
      at: d.from.at,
    });
    // From the inside end to the outside end: to port (+y).
    expect(Math.cos(out!.yaw)).toBeCloseTo(0, 6);
    expect(Math.sin(out!.yaw)).toBeCloseTo(1, 6);
  });

  it("the came-in door flooded outside: the nearest dry deck door", () => {
    // Came in at the third-class door (forward well), now flooded; the
    // walker is near the Grand Staircase's starboard side.
    const out = doorExit(
      map,
      "third-class-door",
      floodedIn("forward-well"),
      [35.5, -4.2]
    );
    expect(out?.id).toBe("gs-door-starboard");
  });

  it("no door remembered: the nearest dry one to the walker", () => {
    expect(doorExit(map, null, DRY, [75, 4.9])?.id).toBe("third-class-door");
    expect(doorExit(map, null, DRY, [35.5, 4.2])?.id).toBe("gs-door-port");
  });

  it("every deck door flooded outside: null (the spawn, else the sea)", () => {
    expect(
      doorExit(map, "gs-door-port", floodedIn("boat-deck", "forward-well"))
    ).toBeNull();
  });

  it("only doors, never a lift", () => {
    const out = doorExit(map, "first-class-lift", DRY, [42.4, -4.6]);
    expect(out?.id).not.toBe("first-class-lift");
    expect(door(out!.id).kind).toBe("door");
  });
});

describe("doorToEnter (the door button)", () => {
  it("the nearest deck door within reach whose inside is dry", () => {
    const d = door("gs-door-starboard");
    const at = [d.from.at[0] - 3, d.from.at[1]] as const;
    const got = doorToEnter(map, "boat-deck", at, DRY);
    expect(got).toMatchObject({
      id: "gs-door-starboard",
      area: d.to.area,
      at: d.to.at,
    });
    // Facing on in: to port from the starboard side.
    expect(Math.sin(got!.yaw)).toBeCloseTo(1, 6);
  });

  it("nothing out of reach, on another deck, or flooded inside", () => {
    const d = door("gs-door-starboard");
    const far = [d.from.at[0] - DOOR_REACH_M - 0.5, d.from.at[1]] as const;
    expect(doorToEnter(map, "boat-deck", far, DRY)).toBeNull();
    expect(doorToEnter(map, "poop", d.from.at, DRY)).toBeNull();
    expect(
      doorToEnter(map, "boat-deck", d.from.at, floodedIn("gs-boat"))
    ).toBeNull();
  });

  it("a named door anywhere (the test hook), still only when dry", () => {
    expect(
      doorToEnter(map, "poop", [-100, 0], DRY, "third-class-door")?.area
    ).toBe("third-stairs-c");
    expect(
      doorToEnter(
        map,
        "poop",
        [-100, 0],
        floodedIn("third-stairs-c"),
        "third-class-door"
      )
    ).toBeNull();
    expect(doorToEnter(map, "poop", [-100, 0], DRY, "first-class-lift")).toBe(
      null
    );
  });
});
