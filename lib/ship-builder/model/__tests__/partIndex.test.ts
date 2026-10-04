import { attachPart, gridPart, testShip } from "../../testing";
import { partAt, partById } from "../partIndex";

describe("partIndex", () => {
  it("finds parts by id and by attach anchor", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 1, 0, 0),
      attachPart("dv", "davit", "a", "davit:0:0"),
    ]);
    expect(partById(ship, "a")?.type).toBe("deck-1x1");
    expect(partAt(ship, "a", "davit:0:0")?.id).toBe("dv");
    expect(partById(ship, "missing")).toBeUndefined();
    expect(partAt(ship, "a", "funnel")).toBeUndefined();
  });

  it("catches up when parts are appended to the same array", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 0, 0)]);
    expect(partById(ship, "b")).toBeUndefined();
    ship.parts.push(gridPart("b", "deck-1x1", 0, 1, 0));
    expect(partById(ship, "b")?.id).toBe("b");
  });

  it("keeps the first part when ids repeat, like Array#find", () => {
    const first = gridPart("a", "deck-1x1", 0, 0, 0);
    const ship = testShip([first, gridPart("a", "deck-1x1", 0, 1, 0)]);
    expect(partById(ship, "a")).toBe(first);
  });
});
