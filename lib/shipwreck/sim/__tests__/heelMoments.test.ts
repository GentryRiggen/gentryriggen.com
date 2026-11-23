import type { ShipSpec } from "../../ships/types";
import { AIR_DENSITY, RHO } from "../constants";
import { simulate } from "../run";
import { type SimTrack, sampleTrack } from "../track";
import { threeShip } from "./testShips";

/**
 * Heeling moments from outside (`ShipSpec.heel`), physics in roll like any
 * moment: a steady beam wind heels an intact box to the static angle
 * M/(Δ·g·GM); wind dead ahead heels it not at all; a rock's mass held in
 * her side from its time lists her toward it by the angle its moment and
 * her stability give. Neither present: the same track.
 */

const DEG = Math.PI / 180;
const KN = 1852 / 3600;
const G = 9.81;

// threeShip: 120 m × 20 m × 12 m, draught 5 m, KG 7 m.
const L = 120;
const B = 20;
const T = 5;
const KG = 7;
const MASS = L * B * T * RHO;

function gm(t: number, kg: number): number {
  return t / 2 + (B * B) / (12 * t) - kg;
}

function lastList(track: SimTrack): number {
  return track.frames[track.frames.length - 1].listDeg;
}

const wind = (fromDeg: number) => ({
  fromDeg,
  kn: 80,
  areaM2: 1200,
  leverM: 10,
  cd: 1.1,
});

function windMoment(kn: number, area: number, lever: number, cd: number) {
  const v = kn * KN;
  return 0.5 * AIR_DENSITY * cd * area * v * v * lever;
}

describe("heeling moments", () => {
  it("a beam wind heels her to the static angle", () => {
    const spec: ShipSpec = { ...threeShip(), heel: { wind: wind(90) } };
    const w = wind(90);
    const m = windMoment(w.kn, w.areaM2, w.leverM, w.cd);
    const want = m / (MASS * G * gm(T, KG)) / DEG;
    expect(want).toBeGreaterThan(2);
    const got = lastList(simulate(spec, [], { endT: 900 }));
    // From port: she heels to starboard (+).
    expect(got).toBeGreaterThan(0);
    expect(Math.abs(got - want)).toBeLessThanOrEqual(0.05 * want);
  });

  it("from starboard she heels to port", () => {
    const spec: ShipSpec = { ...threeShip(), heel: { wind: wind(-90) } };
    expect(lastList(simulate(spec, [], { endT: 900 }))).toBeLessThan(-2);
  });

  it("wind dead ahead heels her not at all", () => {
    const spec: ShipSpec = { ...threeShip(), heel: { wind: wind(0) } };
    expect(Math.abs(lastList(simulate(spec, [], { endT: 900 })))).toBeLessThan(
      1e-6
    );
  });

  it("the rock's mass lists her to port from its time", () => {
    const rock = { t: 120, massT: 100, x: 0, y: 10, z: 2 };
    const spec: ShipSpec = { ...threeShip(), heel: { rock } };
    const track = simulate(spec, [], { endT: 1200 });
    expect(Math.abs(sampleTrack(track, 110).listDeg)).toBeLessThan(1e-9);
    const m = rock.massT * 1000;
    const mass = MASS + m;
    const t = mass / (RHO * L * B);
    const kg = (MASS * KG + m * rock.z) / mass;
    const want = -Math.atan((m * rock.y) / (mass * gm(t, kg))) / DEG;
    const got = lastList(track);
    expect(got).toBeLessThan(0);
    expect(Math.abs(got - want)).toBeLessThanOrEqual(0.05 * Math.abs(want));
  });

  it("a rock outside a body's length is not that body's weight", () => {
    // Held at x 500 m, off her 120 m hull: no body holds it.
    const rock = { t: 120, massT: 100, x: 500, y: 10, z: 2 };
    const off = simulate({ ...threeShip(), heel: { rock } }, [], {
      endT: 600,
    });
    expect(off).toEqual(simulate(threeShip(), [], { endT: 600 }));
  });

  it("neither present: the same track", () => {
    const plain = simulate(threeShip(), [], { endT: 900 });
    const empty = simulate({ ...threeShip(), heel: {} }, [], { endT: 900 });
    expect(empty).toEqual(plain);
  });
});
