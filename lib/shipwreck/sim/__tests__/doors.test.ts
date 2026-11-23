import type { BulkheadDoor, Opening, ShipSpec } from "../../ships/types";
import { simulate } from "../run";
import type { SimFrame } from "../track";
import { threeShip } from "./testShips";

/**
 * Watertight doors (1.4, the Britannic): an opening in the transverse
 * bulkhead between two neighbouring holds, orifice flow on the head
 * difference either way. A "door" shuts with `doorsClosed`; a bulkhead
 * torn by the blast ("damage") never does.
 */

const END = 400;
/** A hole low in hold A's side: A fills to the sea in about ten minutes. */
const HOLE: Opening = {
  compartmentId: "A",
  areaM2: 2,
  zLow: 1,
  zHigh: 2,
  x: -40,
  side: "starboard",
};
const door = (kind: BulkheadDoor["kind"]): BulkheadDoor => ({
  id: "ab",
  aftId: "A",
  fwdId: "B",
  x: -20,
  zLow: 0.5,
  zHigh: 2.5,
  areaM2: 0.05,
  kind,
});
const ship = (doors?: readonly BulkheadDoor[]): ShipSpec =>
  threeShip({ extra: doors ? { doors } : {} });

const at = (frames: readonly SimFrame[], t: number): SimFrame =>
  frames.find((f) => f.t >= t - 1e-9) as SimFrame;

describe("watertight doors", () => {
  it("an open door fills the next compartment", () => {
    const track = simulate(ship([door("door")]), [HOLE], { endT: END });
    const f = at(track.frames, 300);
    const [a, b, c] = f.water;
    // 0.05 m² under a couple of metres of head: about 0.2 m³/s once A's
    // water is over the door, some 20 m³ of B's 9,000 by 300 s.
    expect(b).toBeGreaterThan(0.001);
    expect(b).toBeLessThan(a);
    expect(c).toBe(0);
  });

  it("doorsClosed shuts doors", () => {
    const track = simulate(ship([door("door")]), [HOLE], {
      endT: END,
      doorsClosed: true,
    });
    expect(at(track.frames, 300).water[1]).toBe(0);
    expect(at(track.frames, 300).water[0]).toBeGreaterThan(0.05);
  });

  it("damage never shuts", () => {
    const open = simulate(ship([door("damage")]), [HOLE], { endT: END });
    const shut = simulate(ship([door("damage")]), [HOLE], {
      endT: END,
      doorsClosed: true,
    });
    expect(at(shut.frames, 300).water[1]).toBeGreaterThan(0.001);
    expect(shut).toEqual(open);
  });

  it("no doors, no change", () => {
    const none = simulate(ship(), [HOLE], { endT: END });
    const empty = simulate(ship([]), [HOLE], { endT: END });
    const closed = simulate(ship([door("door")]), [HOLE], {
      endT: END,
      doorsClosed: true,
    });
    for (const other of [empty, closed]) {
      expect(other.frames).toHaveLength(none.frames.length);
      other.frames.forEach((f, i) => {
        const g = none.frames[i];
        f.bodies.forEach((b, k) => {
          const p = g.bodies[k];
          for (const key of ["x", "y", "z", "pitch", "roll", "yaw"] as const)
            expect(Math.abs(b[key] - p[key])).toBeLessThanOrEqual(1e-12);
        });
        f.water.forEach((v, k) =>
          expect(Math.abs(v - g.water[k])).toBeLessThanOrEqual(1e-12)
        );
      });
    }
  });
});
