import { gridPart } from "@/lib/ship-builder/testing";
import { emptyShip } from "../../model/placement";
import { backUpShip } from "../backup";
import { listShips, saveShip } from "../local";

function shipWithParts(name: string) {
  const ship = emptyShip();
  return { ...ship, name, parts: [gridPart("p1", "deck-1x1", 0, 0, 0)] };
}

describe("backUpShip", () => {
  beforeEach(() => localStorage.clear());

  it("saves a ship with parts to My Ships, named as a backup", () => {
    expect(backUpShip(shipWithParts("Sea Queen"))).toBe("backed-up");
    expect(listShips().map((s) => s.name)).toEqual(["Sea Queen (backup)"]);
  });

  it("skips an empty hull", () => {
    expect(backUpShip(emptyShip())).toBe("not-needed");
    expect(listShips()).toEqual([]);
  });

  it("skips a ship My Ships already holds", () => {
    const ship = shipWithParts("Kept");
    saveShip(ship, null);
    expect(backUpShip(ship)).toBe("not-needed");
    expect(listShips()).toHaveLength(1);
  });
});
