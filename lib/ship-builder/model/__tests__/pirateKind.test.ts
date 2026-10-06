import { emptyShip } from "../placement";
import {
  isShipKind,
  KIND_DEFAULTS,
  REFERENCE_SHIPS,
  SHIP_KINDS,
} from "../kinds";
import { BOW_SHAPES, STERN_SHAPES } from "../hullEnds";
import { paintHex } from "../paint";
import { CURRENT_VERSION, migrate, parseShip } from "../../persist/schema";

describe("pirate kind", () => {
  it("is a registered kind with wooden defaults", () => {
    expect(SHIP_KINDS).toContain("pirate");
    expect(isShipKind("pirate")).toBe(true);
    const ship = emptyShip("pirate");
    expect(ship.name).toBe("Untitled pirate ship");
    expect(ship.hull).toMatchObject({
      bow: "beakhead",
      stern: "galleon",
      paint: { topsides: "oak", bottom: "dark-oak" },
    });
    expect(KIND_DEFAULTS.pirate.name).toBe("Untitled pirate ship");
  });

  it("has hull ends and wood paints", () => {
    expect(BOW_SHAPES.beakhead.length).toBeGreaterThan(2);
    expect(STERN_SHAPES.galleon.speedModifier).toBe(-0.5);
    for (const id of ["oak", "dark-oak", "weathered"] as const) {
      expect(paintHex(id)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("compares against Queen Anne's Revenge", () => {
    expect(REFERENCE_SHIPS.pirate.title).toBe("Queen Anne's Revenge (1718)");
    expect(REFERENCE_SHIPS.pirate.figures.map((f) => f.metric)).toEqual([
      "speed",
      "crew",
      "cannons",
    ]);
  });

  it("saves as v7 and reads v6 saves", () => {
    expect(CURRENT_VERSION).toBe(7);
    const ship = emptyShip("pirate");
    const parsed = parseShip(JSON.parse(JSON.stringify(ship)));
    expect(parsed.ok).toBe(true);
    const v6 = { ...emptyShip("liner"), v: 6 };
    expect(migrate(v6)).toEqual({ ...v6, v: 7 });
  });
});
