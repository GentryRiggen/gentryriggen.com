import { gridPart, testShip } from "../../testing";
import { halfWalkGrid, walkHalfOf } from "../halfGrid";
import { stepWalker } from "../step";
import type { WalkInput, WalkState } from "../types";
import { walkGridOf } from "../walkGrid";

const BREAK_AT = 4;
/** Yaw PI faces the stern, which is +x in the model. */
const TO_STERN = Math.PI;

describe("walkHalfOf", () => {
  it("goes by the column's centre, as a grid part does", () => {
    expect(walkHalfOf(3.9, BREAK_AT)).toBe("bow");
    expect(walkHalfOf(3, BREAK_AT)).toBe("bow");
    expect(walkHalfOf(4, BREAK_AT)).toBe("stern");
    expect(walkHalfOf(4.9, BREAK_AT)).toBe("stern");
  });

  it("puts the column centred exactly on the break aft", () => {
    expect(walkHalfOf(3.5, 4)).toBe("bow");
    expect(walkHalfOf(3.5, 3)).toBe("stern");
  });
});

describe("halfWalkGrid", () => {
  const whole = walkGridOf(testShip());
  const bow = halfWalkGrid(whole, "bow", BREAK_AT);
  const stern = halfWalkGrid(whole, "stern", BREAK_AT);

  it("leaves the walker's half exactly as it was", () => {
    expect(bow.isWalkable(3, 1, 0)).toBe(true);
    expect(bow.floorLevel(3, 1)).toBe(whole.floorLevel(3, 1));
    expect(bow.obstructionAt(3, 1, 0)).toBe(whole.obstructionAt(3, 1, 0));
    expect(bow.stepLevel(2, 1, 0, 3, 1)).toBe(whole.stepLevel(2, 1, 0, 3, 1));
    expect(stern.isWalkable(4, 1, 0)).toBe(true);
  });

  it("closes the other half's columns", () => {
    expect(bow.isWalkable(4, 1, 0)).toBe(false);
    expect(bow.floorLevel(4, 1)).toBeNull();
    expect(bow.dropLevel(4, 1, 1)).toBeNull();
    expect(bow.obstructionAt(4, 1, 0)).toBeNull();
    expect(bow.isBlocked(4, 1, 0)).toBe(true);
    expect(bow.stepLevel(3, 1, 0, 4, 1)).toBeNull();
    expect(stern.isWalkable(3, 1, 0)).toBe(false);
    expect(stern.stepLevel(4, 1, 0, 3, 1)).toBeNull();
  });

  it("drops blockers and stair links on the other half", () => {
    const grid = walkGridOf(
      testShip([
        gridPart("c", "cabin-1st", 0, 2, 1),
        gridPart("d", "cabin-1st", 0, 8, 1),
      ])
    );
    const cut = halfWalkGrid(grid, "bow", BREAK_AT);
    expect(cut.blockers.every((b) => walkHalfOf(b.x, BREAK_AT) === "bow")).toBe(
      true
    );
    expect(
      cut.stairs.every(
        (link) =>
          walkHalfOf(link.from.x, BREAK_AT) === "bow" &&
          walkHalfOf(link.to.x, BREAK_AT) === "bow"
      )
    ).toBe(true);
    expect(cut.isBlocked(8, 1, 0)).toBe(true);
  });

  it("keeps a walker on their half, walking or jumping at the break", () => {
    const start: WalkState = {
      x: 3.5,
      z: 1.5,
      yaw: TO_STERN,
      level: 0,
      time: 0,
    };
    const run = (input: WalkInput) => {
      let state = start;
      for (let i = 0; i < 120; i++) state = stepWalker(state, input, bow);
      return state;
    };
    const FORWARD: WalkInput = { forward: 1, strafe: 0, turn: 0 };
    expect(run(FORWARD).x).toBeLessThan(4);
    expect(run({ ...FORWARD, jump: true }).x).toBeLessThan(4);
  });
});
