import { walkMapFor, type V2, type WalkMap } from "../../walk";
import { doorArrow } from "../doorArrow";

const map = walkMapFor("titanic") as WalkMap;
const DRY = () => -1;
const idOf = (i: number) => (i < 0 ? null : map.stairs[i].id);
const arrow = (
  area: string,
  at: V2,
  depthAt: (area: string, x: number, y: number) => number = DRY,
  broken = false
) => idOf(doorArrow(map, area, at, depthAt, broken));

describe("the arrow over a deck door", () => {
  it("stands over the nearest door on the walker's own deck", () => {
    // The spawn, starboard: the starboard staircase door.
    expect(arrow("boat-deck", [10, -10])).toBe("gs-door-starboard");
    expect(arrow("boat-deck", [10, 10])).toBe("gs-door-port");
    expect(arrow("boat-deck", [-70, -8])).toBe("gs-door-starboard");
    // By the bridge the third class door is nearer, but on another deck.
    expect(arrow("boat-deck", [68, 9])).toBe("gs-door-port");
    expect(arrow("forward-well", [80, 0])).toBe("third-class-door");
  });

  it("points the way from a deck with no door of its own", () => {
    expect(arrow("forecastle", [110, 0])).toBe("third-class-door");
    expect(arrow("poop", [-125, -5])).toBe("gs-door-starboard");
  });

  it("skips a door whose inside is flooded", () => {
    const wetC = (area: string) => (area === "third-stairs-c" ? 0.5 : -1);
    expect(arrow("forward-well", [80, 0], wetC)).toMatch(/^gs-door-/);
    expect(arrow("forecastle", [110, 0], wetC)).toMatch(/^gs-door-/);
    const allWet = () => 0.2;
    expect(arrow("boat-deck", [10, -10], allWet)).toBeNull();
  });

  it("is hidden inside, after the break and on a ship without doors", () => {
    expect(arrow("gs-boat", [34, 0])).toBeNull();
    expect(arrow("scotland-road", [60, 4.3])).toBeNull();
    expect(arrow("boat-deck", [10, -10], DRY, true)).toBeNull();
    const lusitania = walkMapFor("lusitania") as WalkMap;
    expect(
      doorArrow(lusitania, lusitania.spawn.area, lusitania.spawn.at, DRY, false)
    ).toBe(-1);
  });
});
