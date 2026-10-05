import { gridLength } from "@/lib/ship-builder/model/grid";
import { emptyShip } from "@/lib/ship-builder/model/placement";
import {
  HULL_ID,
  type PlacedPart,
  type Ship,
} from "@/lib/ship-builder/model/types";
import { findTemplate } from "@/lib/ship-builder/templates";
import { halfOfX, partHalves, snappedWires } from "../partHalves";

function grid(id: string, x: number, rotation: 0 | 90 = 0): PlacedPart {
  return {
    id,
    type: "deck-2x1",
    anchor: { kind: "grid", level: 0, x, z: 0 },
    rotation,
  };
}

function attached(id: string, parentId: string, pointId: string): PlacedPart {
  return {
    id,
    type: "funnel",
    anchor: { kind: "attach", parentId, pointId },
    rotation: 0,
  };
}

function shipWith(parts: PlacedPart[]): Ship {
  return { ...emptyShip(), parts };
}

describe("halfOfX", () => {
  it("puts everything ahead of the break in the bow", () => {
    expect(halfOfX(3.9, 4)).toBe("bow");
    expect(halfOfX(4, 4)).toBe("stern");
    expect(halfOfX(10, 4)).toBe("stern");
  });
});

describe("partHalves", () => {
  it("splits grid parts by the centre of their footprint", () => {
    // A 2-long block from x 3 to 5 has its centre at 4.
    const ship = shipWith([grid("a", 0), grid("b", 3), grid("c", 8)]);
    const sides = partHalves(ship, 4.5);
    expect(sides.get("a")).toBe("bow");
    expect(sides.get("b")).toBe("bow");
    expect(sides.get("c")).toBe("stern");
  });

  it("uses the rotated footprint", () => {
    // Turned 90°, the block is 1 long: x 3 to 4, centre 3.5.
    const ship = shipWith([grid("a", 3, 90)]);
    expect(partHalves(ship, 3.6).get("a")).toBe("bow");
    expect(partHalves(ship, 3.4).get("a")).toBe("stern");
  });

  it("sends attached parts with their parent chain", () => {
    const ship = shipWith([
      grid("front", 1),
      grid("back", 9),
      attached("f1", "front", "funnel"),
      attached("f2", "f1", "top"),
      attached("b1", "back", "funnel"),
    ]);
    const sides = partHalves(ship, 5);
    expect(sides.get("f1")).toBe("bow");
    expect(sides.get("f2")).toBe("bow");
    expect(sides.get("b1")).toBe("stern");
  });

  it("follows the chain even when a child is listed before its parent", () => {
    const ship = shipWith([
      attached("f1", "front", "funnel"),
      grid("front", 0),
    ]);
    expect(partHalves(ship, 5).get("f1")).toBe("bow");
  });

  it("places parts fixed to the hull by where they are fixed", () => {
    const base = emptyShip();
    const ship: Ship = {
      ...base,
      parts: [
        {
          id: "mast",
          type: "mast",
          anchor: { kind: "attach", parentId: HULL_ID, pointId: "mast-fore" },
          rotation: 0,
        },
        {
          id: "prop",
          type: "propeller",
          anchor: { kind: "attach", parentId: HULL_ID, pointId: "prop:0" },
          rotation: 0,
        },
      ],
    };
    const sides = partHalves(ship, gridLength(ship) / 2);
    expect(sides.get("mast")).toBe("bow");
    expect(sides.get("prop")).toBe("stern");
  });

  it("sends parts it cannot trace to the stern", () => {
    const ship = shipWith([
      attached("orphan", "missing", "funnel"),
      attached("loopA", "loopB", "x"),
      attached("loopB", "loopA", "x"),
      {
        id: "lost",
        type: "mast",
        anchor: { kind: "attach", parentId: HULL_ID, pointId: "no-such" },
        rotation: 0,
      },
    ]);
    const sides = partHalves(ship, 100);
    expect(sides.get("orphan")).toBe("stern");
    expect(sides.get("loopA")).toBe("stern");
    expect(sides.get("loopB")).toBe("stern");
    expect(sides.get("lost")).toBe("stern");
  });
});

describe("snappedWires", () => {
  const titanic = findTemplate("titanic")!.build();
  const aerialId = titanic.parts.find(
    (part) => part.type === "wireless-aerial"
  )!.id;

  it("snaps the aerial strung between masts on either side of the break", () => {
    expect(snappedWires(titanic, gridLength(titanic) / 2).has(aerialId)).toBe(
      true
    );
  });

  it("keeps a wire whose masts both stay in one half", () => {
    // Breaking right at the stern leaves both masts in the bow half.
    expect(snappedWires(titanic, gridLength(titanic)).size).toBe(0);
  });
});
