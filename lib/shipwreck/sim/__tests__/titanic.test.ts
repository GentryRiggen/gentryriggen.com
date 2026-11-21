import { getShip, titanic } from "../../ships";
import { RHO } from "../constants";
import { buildHull, hullSlice } from "../geometry";
import { R_CHT, R_MZ, R_SIZE, R_VOL, integrateSlice } from "../hydrostatics";
import { simulate } from "../run";

const DEG = Math.PI / 180;

describe("Titanic's data", () => {
  it("is in the registry", () => {
    expect(getShip("titanic")).toBe(titanic);
  });

  it("has a full hull, 16 compartments end to end and the real damage", () => {
    expect(titanic.stations.length).toBeGreaterThanOrEqual(41);
    for (let i = 1; i < titanic.stations.length; i += 1)
      expect(titanic.stations[i].x).toBeGreaterThan(titanic.stations[i - 1].x);
    const comps = titanic.compartments;
    expect(comps).toHaveLength(16);
    expect(comps[0].fromX).toBeCloseTo(titanic.stations[0].x, 1);
    for (let i = 1; i < comps.length; i += 1)
      expect(comps[i].fromX).toBeCloseTo(comps[i - 1].toX, 6);
    const area = titanic.realNight.reduce((a, o) => a + o.areaM2, 0);
    expect(area).toBeGreaterThanOrEqual(1.1);
    expect(area).toBeLessThanOrEqual(1.2);
    for (const o of titanic.realNight) {
      expect(o.zLow).toBeGreaterThanOrEqual(1);
      expect(o.zHigh).toBeLessThanOrEqual(7);
      expect(comps.some((c) => c.id === o.compartmentId)).toBe(true);
    }
  });

  it("has 8 rockets and 20 boats, Boat 7 first and the last at 2:05", () => {
    const rockets = titanic.scripted.filter((e) => e.kind === "rocket");
    const boats = titanic.scripted.filter((e) => e.kind === "boat-lowered");
    expect(rockets).toHaveLength(8);
    expect(boats).toHaveLength(20);
    expect(new Set(boats.map((b) => b.index)).size).toBe(20);
    expect(boats[0]).toMatchObject({ t: 65 * 60, index: 6 });
    expect(boats[19].t).toBe(145 * 60);
  });

  it("has a fine hull: block coefficient about 0.67–0.70", () => {
    const hull = buildHull(titanic);
    const slice = hullSlice(hull, hull.xMin, hull.xMax);
    const out = new Float64Array(R_SIZE);
    const loadDraught = 10.54;
    integrateSlice(slice, 0, 0, 1, -loadDraught, out);
    const cb = out[R_VOL] / (titanic.lbp * titanic.beam * loadDraught);
    expect(cb).toBeGreaterThan(0.66);
    expect(cb).toBeLessThan(0.71);
  });

  it("displaces her weight at her draught with a small positive GM", () => {
    const hull = buildHull(titanic);
    const slice = hullSlice(hull, hull.xMin, hull.xMax);
    const out = new Float64Array(R_SIZE);
    integrateSlice(slice, 0, 0, 1, -titanic.draught, out);
    const tonnes = (out[R_VOL] * RHO) / 1000;
    expect(
      Math.abs(tonnes - titanic.displacementT) / titanic.displacementT
    ).toBeLessThan(0.03);
    const kb = out[R_MZ] / out[R_VOL];
    const bm = out[R_CHT] / out[R_VOL];
    const gm = kb + bm - titanic.kg;
    expect(gm).toBeGreaterThan(0.6);
    expect(gm).toBeLessThan(2.5);
  });

  it("floats level at her draught when undamaged", () => {
    const track = simulate(titanic, [], { endT: 600 });
    const last = track.frames[track.frames.length - 1];
    const whole = last.bodies[0];
    expect(whole.part).toBe("whole");
    expect(Math.abs(-whole.z - titanic.draught)).toBeLessThan(0.1);
    expect(Math.abs(whole.pitch / DEG)).toBeLessThan(0.2);
    // A few centimetres of weight to port (spec.tcg) give her a slight list.
    expect(last.listDeg).toBeLessThan(0);
    expect(last.listDeg).toBeGreaterThan(-2.5);
    expect(last.waterAboardT).toBe(0);
    expect(track.outcome).toBe("floated");
  });
});
