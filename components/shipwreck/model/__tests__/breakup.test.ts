import { Object3D, Vector3 } from "three";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { TEAR_AMPLITUDE, isInPart, sideOf, tearX } from "../breakCut";
import { buildShipPart, type ShipPartData } from "../buildShip";
import { applyBodyPose } from "../pose";
import { titanicRecipe } from "../titanicRecipe";

const r = titanicRecipe(titanic);

/** Ship-frame x of every vertex in a part's merged lists. */
function vertexXs(d: ShipPartData, lists: (keyof ShipPartData)[]): number[] {
  const out: number[] = [];
  for (const key of lists) {
    const buf = d[key] as ShipPartData["hull"];
    for (let i = 0; i < buf.pos.length; i += 3) out.push(buf.pos[i]);
  }
  return out;
}
const SURFACES: (keyof ShipPartData)[] = ["hull", "deck", "decal"];
const FITTINGS: (keyof ShipPartData)[] = ["paint", "bronze"];
/** Fittings go whole to the side their foot is on (a dome, a crane's jib). */
const FITTING_REACH = 5;

describe("the tear", () => {
  it("stays within its amplitude of breakX", () => {
    for (let y = -15; y <= 15; y += 0.37)
      for (let z = 0; z <= 30; z += 0.41) {
        const t = tearX(-27.1, y, z);
        expect(Math.abs(t + 27.1)).toBeLessThanOrEqual(TEAR_AMPLITUDE + 1e-9);
      }
  });

  it("puts every point in exactly one half", () => {
    for (let x = -40; x <= -15; x += 0.53)
      for (const y of [-12, -3, 0, 5, 13])
        for (const z of [0, 6, 13, 20, 27]) {
          const bow = isInPart("bow", -27.1, x, y, z);
          const stern = isInPart("stern", -27.1, x, y, z);
          expect(bow !== stern).toBe(true);
          expect(bow).toBe(sideOf(-27.1, x, y, z) === "bow");
          expect(isInPart("whole", null, x, y, z)).toBe(true);
        }
  });
});

describe("the split model", () => {
  const whole = buildShipPart(r, "whole", null, "high");

  it("keeps the whole ship inside its own length", () => {
    for (const x of vertexXs(whole, [...SURFACES, ...FITTINGS])) {
      expect(x).toBeGreaterThanOrEqual(r.hull.xMin - 3);
      expect(x).toBeLessThanOrEqual(r.hull.xMax + 0.6);
    }
    expect(whole.funnels).toEqual([0, 1, 2, 3]);
    expect(whole.boats).toHaveLength(20);
  });

  // The real night's break, one through a funnel, one among the boats,
  // one well forward and one well aft.
  it.each([-27.1, 19.3, 45, 88, -100])(
    "splits at x = %p with every piece on one side",
    (breakX) => {
      const bow = buildShipPart(r, "bow", breakX, "high");
      const stern = buildShipPart(r, "stern", breakX, "high");
      const A = TEAR_AMPLITUDE + 1e-6;
      // The long surfaces stop at the tear; whole fittings may reach a
      // little past it.
      for (const x of vertexXs(bow, SURFACES))
        expect(x).toBeGreaterThanOrEqual(breakX - A);
      for (const x of vertexXs(stern, SURFACES))
        expect(x).toBeLessThanOrEqual(breakX + A);
      for (const x of vertexXs(bow, FITTINGS))
        expect(x).toBeGreaterThanOrEqual(breakX - A - FITTING_REACH);
      for (const x of vertexXs(stern, FITTINGS))
        expect(x).toBeLessThanOrEqual(breakX + A + FITTING_REACH);

      const sameSet = (key: keyof ShipPartData, id: (v: never) => string) => {
        const all = (whole[key] as never[]).map(id).sort();
        const halves = [
          ...(bow[key] as never[]).map(id),
          ...(stern[key] as never[]).map(id),
        ].sort();
        expect(halves).toEqual(all);
      };
      const at = (p: { p: number[] }) => p.p.join(",");
      sameSet("portholes", at);
      sameSet("windows", at);
      sameSet("vents", at);
      sameSet("benches", at);
      sameSet("bollards", at);
      sameSet("posts", (p: number[]) => p.join(","));
      sameSet("funnels", (i: number) => String(i));
      sameSet("boats", (i: number) => String(i));

      for (const l of bow.portholes) expect(sideOf(breakX, ...l.p)).toBe("bow");
      for (const l of stern.windows)
        expect(sideOf(breakX, ...l.p)).toBe("stern");
      for (const i of bow.funnels)
        expect(r.funnels[i].x).toBeGreaterThan(breakX - A);
      for (const i of stern.funnels)
        expect(r.funnels[i].x).toBeLessThan(breakX + A);
      // Wires that cross the tear snap: neither half keeps them.
      expect(bow.lines.pos.length + stern.lines.pos.length).toBeLessThanOrEqual(
        whole.lines.pos.length
      );
    }
  );
});

describe("posing a part from the sim", () => {
  const point = (pose: Parameters<typeof applyBodyPose>[1], ship: number[]) => {
    const o = new Object3D();
    applyBodyPose(o, pose);
    o.updateMatrixWorld(true);
    // Ship frame to three.js: (x, z, -y).
    return new Vector3(ship[0], ship[2], -ship[1]).applyMatrix4(o.matrixWorld);
  };
  const level = {
    part: "whole" as const,
    x: 0,
    y: 0,
    z: -9.83,
    pitch: 0,
    roll: 0,
    yaw: 0,
  };

  it("maps earth position to three.js axes", () => {
    const p = point({ ...level, x: 5, y: 7 }, [0, 0, 0]);
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(-9.83);
    expect(p.z).toBeCloseTo(-7);
  });

  it("puts the bow down for positive pitch", () => {
    expect(point({ ...level, pitch: 0.2 }, [100, 0, 0]).y).toBeLessThan(
      -9.83 - 15
    );
  });

  it("lifts the port side for positive roll", () => {
    const port = point({ ...level, roll: 0.1 }, [0, 10, 0]);
    expect(port.y).toBeGreaterThan(-9.83 + 0.9);
  });

  it("turns the bow to port for positive yaw", () => {
    const bow = point({ ...level, yaw: Math.PI / 2 }, [100, 0, 0]);
    // Earth +y (port of the first heading) is three.js -z.
    expect(bow.z).toBeCloseTo(-100);
    expect(bow.x).toBeCloseTo(0);
  });
});
