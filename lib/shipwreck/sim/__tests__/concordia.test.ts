import {
  CONCORDIA_BOATS,
  CONCORDIA_DECKS,
  SHIP_IDS,
  SHIPS,
  concordia,
  getShip,
} from "../../ships";
import {
  CONCORDIA_BOATS_KEPT,
  CONCORDIA_FIXES,
  DECK0_Z,
  FRAME_M,
  concordiaEarth,
  frameX,
} from "../../ships/concordia";
import { RHO } from "../constants";
import { buildHull, hullSlice } from "../geometry";
import {
  R_CHT,
  R_MX,
  R_MZ,
  R_SIZE,
  R_VOL,
  integrateSlice,
} from "../hydrostatics";
import { pathAt } from "../headway";
import { floorAt } from "../seabed";

/**
 * The Costa Concordia's data [MIT]: her particulars, her hull's
 * displacement at her departure draught, WTC 4–8 at the report's frames,
 * the door into the motor room, the gash, her boats, the seabed and her
 * drift through the report's fixes.
 */

function upright(draught: number) {
  const hull = buildHull(concordia);
  const out = new Float64Array(R_SIZE);
  integrateSlice(hullSlice(hull, hull.xMin, hull.xMax), 0, 0, 1, -draught, out);
  const v = out[R_VOL];
  return {
    tonnes: (v * RHO) / 1000,
    km: (out[R_MZ] + out[R_CHT]) / v,
    lcb: out[R_MX] / v,
  };
}

const at = (id: string) => concordia.compartments.find((c) => c.id === id)!;

describe("the Costa Concordia's data", () => {
  it("is in the registry, after the Britannic, a rocks ship at 21:45:07 in 30 m", () => {
    expect(getShip("concordia")).toBe(concordia);
    expect(SHIP_IDS.indexOf("concordia")).toBe(
      SHIP_IDS.indexOf("britannic") + 1
    );
    expect(SHIPS.concordia).toBe(concordia);
    expect(concordia.cause).toBe("rocks");
    expect(concordia.clockStartS).toBe(21 * 3600 + 45 * 60 + 7);
    expect(concordia.seaDepthM).toBe(30);
    expect(concordia.preRollS).toBeGreaterThanOrEqual(30);
    expect(concordia.preRollS).toBeLessThanOrEqual(50);
    expect(concordia.agroundTimeScale).toBe(6);
    expect(concordia.boxWaterAtSide).toBe(true);
    expect(concordia.funnels).toHaveLength(1);
    expect(concordia.funnels[0].falls).toBe(false);
  });

  it("has her particulars (R3)", () => {
    expect(Math.abs(concordia.loa - 290.2)).toBeLessThanOrEqual(0.3);
    expect(Math.abs(concordia.lbp - 247.4)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(concordia.beam - 35.5)).toBeLessThanOrEqual(0.05);
    const st = concordia.stations;
    expect(st.length).toBeGreaterThanOrEqual(41);
    for (let i = 1; i < st.length; i += 1)
      expect(st[i].x).toBeGreaterThan(st[i - 1].x);
    // Her stations span her length overall, and she is 35.5 m wide.
    expect(
      Math.abs(st[st.length - 1].x - st[0].x - concordia.loa)
    ).toBeLessThanOrEqual(0.3);
    const widest = Math.max(
      ...st.flatMap((s) => s.offsets.map(([, hb]) => hb))
    );
    expect(Math.abs(2 * widest - concordia.beam)).toBeLessThan(0.05);
    expect(concordia.draught).toBe(8.12);
  });

  it("displaces about 56,600 t at 8.12 m even keel, with an intact GM of 1.5–3 m", () => {
    const now = upright(concordia.draught);
    expect(Math.abs(now.tonnes - 56600) / 56600).toBeLessThan(0.02);
    expect(
      Math.abs(now.tonnes - concordia.displacementT) / concordia.displacementT
    ).toBeLessThan(0.02);
    const gm = now.km - concordia.kg;
    expect(gm).toBeGreaterThanOrEqual(1.5);
    expect(gm).toBeLessThanOrEqual(3);
    expect(Math.abs(now.lcb - concordia.lcg)).toBeLessThan(0.2);
  });

  it("has decks 0 and 1–14 as her deck plan names them, deck 0 at 11.2 m [MIT p.103]", () => {
    const names = CONCORDIA_DECKS.map((d) => d.name);
    for (let n = 0; n <= 14; n += 1) expect(names).toContain(String(n));
    for (let i = 1; i < CONCORDIA_DECKS.length; i += 1)
      expect(CONCORDIA_DECKS[i].z).toBeLessThan(CONCORDIA_DECKS[i - 1].z);
    expect(CONCORDIA_DECKS.find((d) => d.name === "0")!.z).toBe(11.2);
    expect(CONCORDIA_DECKS.find((d) => d.name === "1")!.z).toBe(14.18);
    expect(concordia.decks).toBe(CONCORDIA_DECKS);
  });

  it("has WTC 4–8 at the report's frames (0.725 m, frame 0 at the AP), every bulkhead to deck 0", () => {
    expect(FRAME_M).toBe(0.725);
    expect(frameX(0)).toBeCloseTo(-concordia.lbp / 2, 6);
    const frames: Record<string, [number, number]> = {
      wtc4: [44, 60],
      wtc5: [60, 76],
      wtc6: [76, 100],
      wtc7: [100, 116],
      wtc8: [116, 140],
    };
    for (const [id, [a, b]] of Object.entries(frames)) {
      expect(at(id).fromX).toBeCloseTo(-123.7 + a * 0.725, 3);
      expect(at(id).toX).toBeCloseTo(-123.7 + b * 0.725, 3);
    }
    const comps = concordia.compartments;
    expect(comps.length).toBeGreaterThanOrEqual(18);
    expect(comps.length).toBeLessThanOrEqual(20);
    expect(comps.map((c) => c.id)).toEqual(comps.map((_, i) => `wtc${i + 1}`));
    for (let i = 1; i < comps.length; i += 1) {
      expect(comps[i].fromX).toBeCloseTo(comps[i - 1].toX, 6);
      expect(comps[i].aftBulkheadTopZ).toBe(DECK0_Z);
      expect(comps[i - 1].fwdBulkheadTopZ).toBe(DECK0_Z);
    }
    // Each under the floodable length (about 14.6 m), but the ends.
    for (const c of comps.slice(1, -1))
      expect(c.toX - c.fromX).toBeLessThanOrEqual(18);
  });

  it("has the door from WTC 5 into WTC 4 on their bulkhead (R6)", () => {
    const doors = concordia.doors ?? [];
    expect(doors).toHaveLength(1);
    const [d] = doors;
    expect(d.kind).toBe("door");
    expect([d.aftId, d.fwdId].sort()).toEqual(["wtc4", "wtc5"]);
    expect(d.x).toBeCloseTo(at("wtc5").fromX, 6);
    // Open no wider than a 1 m × 2 m door.
    expect(d.areaM2).toBeGreaterThan(0);
    expect(d.areaM2).toBeLessThanOrEqual(2);
  });

  it("is torn on her port side between frames 52 and 124, bilge strake to 1 m under her waterline (R5)", () => {
    const real = concordia.realNight;
    expect([...new Set(real.map((o) => o.compartmentId))].sort()).toEqual([
      "wtc4",
      "wtc5",
      "wtc6",
      "wtc7",
      "wtc8",
    ]);
    for (const o of real) {
      expect(o.side).toBe("port");
      expect(o.x).toBeGreaterThanOrEqual(frameX(52));
      expect(o.x).toBeLessThanOrEqual(frameX(124));
      const c = at(o.compartmentId);
      expect(o.x).toBeGreaterThanOrEqual(c.fromX);
      expect(o.x).toBeLessThanOrEqual(c.toX);
      expect(o.zLow).toBeGreaterThanOrEqual(0);
      expect(o.zHigh).toBeLessThanOrEqual(concordia.draught - 1 + 1e-9);
      expect(o.areaM2).toBeGreaterThan(0);
      // Forward first, over about 7 s.
      expect(o.t ?? 0).toBeGreaterThanOrEqual(0);
      expect(o.t ?? 0).toBeLessThanOrEqual(8);
    }
    const byX = real.slice().sort((a, b) => b.x - a.x);
    for (let i = 1; i < byX.length; i += 1)
      expect(byX[i].t ?? 0).toBeGreaterThanOrEqual(byX[i - 1].t ?? 0);
    // Tear A [MIT §4.7.2]: 1.12 m × 0.05 m.
    expect(real.find((o) => o.compartmentId === "wtc8")!.areaM2).toBeCloseTo(
      0.056,
      3
    );
    const g = concordia.gash!;
    expect(g.side).toBe("port");
    expect(g.zHigh).toBeLessThanOrEqual(concordia.draught - 1 + 1e-9);
  });

  it("names her own spaces and ends her pace at her rest", () => {
    const ids = concordia.compartments.map((c) => c.id);
    expect(ids).toContain(concordia.blackout!.compartmentId);
    for (const id of concordia.headway!.pathWhenOpen!)
      expect(ids).toContain(id);
    for (const d of concordia.doors ?? []) {
      expect(ids).toContain(d.aftId);
      expect(ids).toContain(d.fwdId);
    }
    for (const o of concordia.realNight) expect(ids).toContain(o.compartmentId);
    const pace = concordia.aground!.pace;
    expect(pace[pace.length - 1][1]).toBe(concordia.aground!.restDeg);
    for (let i = 1; i < pace.length; i += 1) {
      expect(pace[i][0]).toBeGreaterThan(pace[i - 1][0]);
      expect(pace[i][1]).toBeGreaterThan(pace[i - 1][1]);
    }
    // Her rock lies in her hull's length.
    const rock = concordia.heel!.rock!;
    expect(rock.x).toBeGreaterThan(concordia.stations[0].x);
    expect(rock.x).toBeLessThan(
      concordia.stations[concordia.stations.length - 1].x
    );
  });

  it("carries 26 lifeboats, 13 a side, 23 lowered from 22:55 starboard first (R19)", () => {
    expect(CONCORDIA_BOATS).toHaveLength(26);
    expect(CONCORDIA_BOATS.filter((b) => b.side === "port")).toHaveLength(13);
    expect(CONCORDIA_BOATS.filter((b) => b.side === "starboard")).toHaveLength(
      13
    );
    CONCORDIA_BOATS.forEach((b, i) => expect(b.index).toBe(i));
    const lowered = concordia.scripted.filter((e) => e.kind === "boat-lowered");
    expect(lowered).toHaveLength(23);
    for (const k of CONCORDIA_BOATS_KEPT)
      expect(CONCORDIA_BOATS[k].side).toBe("port");
    // Real seconds after the strike (`agroundTimeScale`): 22:55 = 4193 s.
    expect(lowered[0].t).toBe(22 * 3600 + 55 * 60 - (21 * 3600 + 45 * 60 + 7));
    expect(CONCORDIA_BOATS[lowered[0].index!].side).toBe("starboard");
  });

  it("has a seabed: 20–32 m at the 22:58 fix, 80 m or more at the 22:12 anchor point (R9)", () => {
    const f = CONCORDIA_FIXES.final;
    const [fx, fy] = concordiaEarth(f.lat, f.lon);
    expect(-floorAt(concordia, fx, fy)).toBeGreaterThanOrEqual(20);
    expect(-floorAt(concordia, fx, fy)).toBeLessThanOrEqual(32);
    const n = CONCORDIA_FIXES.north;
    const [nx, ny] = concordiaEarth(n.lat, n.lon);
    expect(-floorAt(concordia, nx, ny)).toBeGreaterThanOrEqual(80);
    // Deep where she struck (her draught clears the floor but at the rock).
    expect(-floorAt(concordia, 0, 0)).toBeGreaterThan(30);
  });

  it("drifts by the report's fixes: on 350° to 22:12, back to the 22:58 fix (R8)", () => {
    const path = concordia.headway!.path!;
    const buf: [number, number, number, number] = [0, 0, 0, 0];
    const n = CONCORDIA_FIXES.north;
    const [nx, ny] = concordiaEarth(n.lat, n.lon);
    const p = pathAt(path, n.t, buf);
    expect(Math.hypot(p[0] - nx, p[1] - ny)).toBeLessThan(100);
    const f = CONCORDIA_FIXES.final;
    const [fx, fy] = concordiaEarth(f.lat, f.lon);
    const last = path[path.length - 1];
    expect(last[0]).toBe(f.t);
    expect(Math.hypot(last[1] - fx, last[2] - fy)).toBeLessThan(1);
    // 8.3 kn just after the strike [MIT §3].
    const kn = (t: number) => pathAt(path, t, buf)[3] / (1852 / 3600);
    expect(kn(1)).toBeGreaterThan(7.5);
    expect(kn(1)).toBeLessThan(8.6);
    expect(kn(n.t)).toBeLessThan(1);
    // The sea path shares hers past 26 minutes, then leaves her.
    const sea = concordia.headway!.pathToSea!;
    const shared = sea.findIndex(
      (q, i) => JSON.stringify(q) !== JSON.stringify(path[i])
    );
    expect(sea[shared - 2][0]).toBeGreaterThanOrEqual(26 * 60);
  });
});
