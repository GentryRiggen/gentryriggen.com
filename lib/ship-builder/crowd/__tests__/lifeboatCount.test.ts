import { analyzeShip } from "../../model/analysis";
import { emptyShip } from "../../model/placement";
import type { Ship } from "../../model/types";
import { findTemplate } from "../../templates";
import { attachPart, gridPart, testShip } from "../../testing";
import { hungLifeboats, lifeboatCount } from "../lifeboatCount";

function countOf(ship: Ship) {
  return lifeboatCount(ship, analyzeShip(ship).stats);
}

describe("lifeboatCount", () => {
  it("counts the Titanic's davit boats against everyone aboard", () => {
    // 16 standard boats of 65 and 2 collapsibles of 47; 2300 aboard.
    const ship = findTemplate("titanic")!.build();
    const stats = analyzeShip(ship).stats;
    expect(countOf(ship)).toEqual({
      seats: 1098,
      people: stats.passengers.total + stats.crewBerths,
    });
    expect(countOf(ship).people).toBe(2300);
  });

  it("is zero seats on a ship with no lifeboats", () => {
    const ship = emptyShip("liner", "Bare", 4, 4);
    expect(countOf(ship).seats).toBe(0);
  });

  it("counts only boats that hang from a davit", () => {
    const ship = testShip(
      [
        gridPart("c0", "cabin-3rd", 0, 2, 0),
        gridPart("c1", "cabin-3rd", 0, 5, 0),
        attachPart("d", "davit", "c0", "davit:2:0"),
        attachPart("b", "lifeboat-standard", "d", "boat"),
      ],
      4,
      4
    );
    const stats = analyzeShip(ship).stats;
    expect(countOf(ship)).toEqual({
      seats: 65,
      people: stats.passengers.total + stats.crewBerths,
    });
  });

  it("leaves out a boat whose davit has nowhere to hang, as the evacuation does", () => {
    // The davit's point is not on the cabin, so the evacuation cannot lower
    // that boat; counting its seats would promise places nobody gets.
    const ship = testShip(
      [
        gridPart("c0", "cabin-3rd", 0, 2, 0),
        attachPart("d", "davit", "c0", "davit:2:0"),
        attachPart("b", "lifeboat-standard", "d", "boat"),
        attachPart("d2", "davit", "c0", "davit:99:0"),
        attachPart("b2", "lifeboat-standard", "d2", "boat"),
      ],
      4,
      4
    );
    expect(countOf(ship).seats).toBe(65);
    expect(hungLifeboats(ship).map((boat) => boat.part.id)).toEqual(["b"]);
  });
});
