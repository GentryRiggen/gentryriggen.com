import {
  POSEIDON_BOATS,
  POSEIDON_DECKS,
  SHIP_IDS,
  SHIPS,
  getShip,
  poseidon,
} from "../../ships";
import { BALLROOM, DECK0_Z, deckZ } from "../../ships/poseidon";
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

/**
 * The Poseidon's data (spec "Her data", R3, R4, R7, R9, R16): her
 * particulars (ours), her displacement and intact GM, her subdivision and
 * superstructure spaces, the wave and what it smashes, her boats.
 */

function upright(draught: number) {
  const hull = buildHull(poseidon);
  const out = new Float64Array(R_SIZE);
  integrateSlice(hullSlice(hull, hull.xMin, hull.xMax), 0, 0, 1, -draught, out);
  const v = out[R_VOL];
  return {
    tonnes: (v * RHO) / 1000,
    km: (out[R_MZ] + out[R_CHT]) / v,
    lcb: out[R_MX] / v,
  };
}

const wave = poseidon.wave!;
const boxOf = (id: string) => poseidon.superstructure.find((s) => s.id === id);
const compOf = (id: string) => poseidon.compartments.find((c) => c.id === id);

describe("the Poseidon's data", () => {
  it("is in the registry, last, a wave ship at 23:58 over 4,000 m", () => {
    expect(getShip("poseidon")).toBe(poseidon);
    expect(SHIP_IDS[SHIP_IDS.length - 1]).toBe("poseidon");
    expect(SHIP_IDS.indexOf("concordia")).toBe(SHIP_IDS.length - 2);
    expect(SHIPS.poseidon).toBe(poseidon);
    expect(poseidon.cause).toBe("wave");
    expect(poseidon.clockStartS).toBe(23 * 3600 + 58 * 60);
    expect(poseidon.preRollS).toBe(60);
    expect(poseidon.seaDepthM).toBe(4000);
    expect(poseidon.seabed).toBeUndefined();
    expect(poseidon.capsizeTimeScale).toBe(6);
    expect(poseidon.blackout!.listDeg).toBe(60);
    expect(poseidon.wreck).toEqual({ restDeg: 180, minListDeg: 120 });
    expect(poseidon.rideOut!.afterS).toBe(300);
    expect(poseidon.endS).toBeGreaterThan(0);
    expect(poseidon.funnels).toHaveLength(1);
    expect(poseidon.funnels[0].falls).toBe(false);
    expect(poseidon.scripted.some((e) => e.kind === "boat-lowered")).toBe(
      false
    );
    expect(poseidon.trappedAir).toBeDefined();
  });

  it("has her particulars (ours, R3)", () => {
    expect(Math.abs(poseidon.loa - 305)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(poseidon.lbp - 265)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(poseidon.beam - 36)).toBeLessThanOrEqual(0.05);
    const st = poseidon.stations;
    expect(st.length).toBeGreaterThanOrEqual(41);
    for (let i = 1; i < st.length; i += 1)
      expect(st[i].x).toBeGreaterThan(st[i - 1].x);
    expect(
      Math.abs(st[st.length - 1].x - st[0].x - poseidon.loa)
    ).toBeLessThanOrEqual(0.5);
    const widest = Math.max(
      ...st.flatMap((s) => s.offsets.map(([, hb]) => hb))
    );
    expect(Math.abs(2 * widest - poseidon.beam)).toBeLessThan(0.05);
    expect(poseidon.draught).toBe(8.4);
  });

  it("displaces about 57,500 t at 8.4 m even keel, with an intact GM of 1.5–3 m", () => {
    const now = upright(poseidon.draught);
    expect(Math.abs(now.tonnes - 57500) / 57500).toBeLessThan(0.02);
    expect(
      Math.abs(now.tonnes - poseidon.displacementT) / poseidon.displacementT
    ).toBeLessThan(0.02);
    const gm = now.km - poseidon.kg;
    expect(gm).toBeGreaterThanOrEqual(1.5);
    expect(gm).toBeLessThanOrEqual(3);
    expect(Math.abs(now.lcb - poseidon.lcg)).toBeLessThan(0.2);
  });

  it("has decks 0–14, deck 0 at 14.5 m, 2.8 m apart", () => {
    expect(POSEIDON_DECKS.map((d) => d.name)).toEqual(
      Array.from({ length: 15 }, (_, i) => String(14 - i))
    );
    expect(poseidon.decks).toBe(POSEIDON_DECKS);
    expect(DECK0_Z).toBe(14.5);
    for (const d of POSEIDON_DECKS)
      expect(d.z).toBeCloseTo(14.5 + 2.8 * Number(d.name), 6);
  });

  it("has about 20 watertight compartments, every bulkhead to deck 0, side tanks inside", () => {
    const comps = poseidon.compartments;
    // Her compartments end to end; the side tanks beside them.
    const main = comps.filter((c) => !c.span || c.span.side === "centre");
    expect(main.length).toBeGreaterThanOrEqual(18);
    expect(main.length).toBeLessThanOrEqual(22);
    // Inside the X-ray's slots, side tanks and all.
    expect(comps.length).toBeLessThanOrEqual(32);
    for (let i = 1; i < main.length; i += 1) {
      expect(main[i].fromX).toBeCloseTo(main[i - 1].toX, 6);
      expect(main[i].aftBulkheadTopZ).toBe(DECK0_Z);
      expect(main[i - 1].fwdBulkheadTopZ).toBe(DECK0_Z);
    }
    // Each under the floodable length (about 14–15 m), but the ends.
    for (const c of main.slice(1, -1))
      expect(c.toX - c.fromX).toBeLessThanOrEqual(15);
    // Side tanks, port and starboard, each from one bulkhead to another
    // beside centre spaces of the same breadth.
    const wings = comps.filter((c) => c.span && c.span.side !== "centre");
    expect(wings.length).toBeGreaterThan(0);
    for (const c of wings) {
      expect(main.some((m) => m.fromX === c.fromX)).toBe(true);
      expect(main.some((m) => m.toX === c.toX)).toBe(true);
      for (const m of main.filter(
        (m) => m.fromX >= c.fromX && m.toX <= c.toX
      )) {
        expect(m.span?.side).toBe("centre");
        expect(m.span!.y).toBe(c.span!.y);
      }
    }
    for (const side of ["port", "starboard"])
      expect(wings.filter((c) => c.span!.side === side)).toHaveLength(
        wings.length / 2
      );
    expect(compOf(poseidon.blackout!.compartmentId)!.kind).toBe("engine");
  });

  it("has named superstructure spaces over decks 1–13, the ballroom forward of her funnel", () => {
    const boxes = poseidon.superstructure;
    for (const b of boxes) expect(b.id).toBeTruthy();
    expect(new Set(boxes.map((b) => b.id)).size).toBe(boxes.length);
    const base = (b: (typeof boxes)[number]) => b.baseZ ?? poseidon.sheerZ(0);
    expect(Math.min(...boxes.map(base))).toBeLessThanOrEqual(deckZ(1) + 1e-9);
    expect(Math.max(...boxes.map((b) => b.topZ))).toBeGreaterThanOrEqual(
      deckZ(14) - 1e-9
    );
    // Every deck 1–13 is inside some box amidships.
    for (let n = 1; n <= 13; n += 1) {
      const z = deckZ(n) + 1.4;
      expect(
        boxes.some(
          (b) => b.fromX <= 0 && b.toX >= 0 && base(b) <= z && b.topZ >= z
        )
      ).toBe(true);
    }
    const ball = boxOf("ballroom")!;
    expect(ball).toBeDefined();
    expect(ball.toX - ball.fromX).toBeGreaterThanOrEqual(28);
    expect(ball.toX - ball.fromX).toBeLessThanOrEqual(32);
    expect(ball.baseZ).toBeCloseTo(deckZ(12), 6);
    expect(ball.topZ).toBeGreaterThan(deckZ(14));
    expect(ball.fromX).toBeGreaterThan(poseidon.funnels[0].x);
    expect(ball).toEqual(expect.objectContaining(BALLROOM));
  });

  it("has seven spots on her port side, each opening inside its space", () => {
    expect(wave.spots.map((s) => s.id)).toEqual([
      "stern",
      "aft-win",
      "mid-win",
      "vents",
      "ballroom",
      "fwd-win",
      "lobby",
    ]);
    for (const s of wave.spots) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.openings.length).toBeGreaterThan(0);
      for (const o of s.openings) {
        expect(o.side).toBe("port");
        expect(o.areaM2).toBeGreaterThan(0);
        expect(o.t ?? 0).toBe(0);
        expect(o.zHigh).toBeGreaterThan(o.zLow);
        const c = compOf(o.compartmentId);
        const b = boxOf(o.compartmentId);
        expect(Boolean(c) !== Boolean(b)).toBe(true);
        if (c) {
          expect(o.x).toBeGreaterThanOrEqual(c.fromX);
          expect(o.x).toBeLessThanOrEqual(c.toX);
          expect(o.zLow).toBeGreaterThanOrEqual(0);
          expect(o.zHigh).toBeLessThanOrEqual(poseidon.depth);
        } else {
          expect(o.x).toBeGreaterThanOrEqual(b!.fromX);
          expect(o.x).toBeLessThanOrEqual(b!.toX);
          expect(o.zLow).toBeGreaterThanOrEqual(b!.baseZ ?? poseidon.depth);
          expect(o.zHigh).toBeLessThanOrEqual(b!.topZ);
        }
      }
    }
    // The dome's glass: about 40 m² into the ballroom (R9).
    const dome = wave.spots.find((s) => s.id === "ballroom")!.openings;
    expect(dome.map((o) => o.compartmentId)).toEqual(["ballroom"]);
    expect(dome[0].areaM2).toBeCloseTo(40, 6);
    // Only the front windows from ahead.
    expect(wave.spots.filter((s) => s.fwd).map((s) => s.id)).toEqual([
      "fwd-win",
    ]);
    // Her real night is every spot.
    expect(poseidon.realNight).toEqual(wave.spots.flatMap((s) => s.openings));
  });

  it("meets the wave: 30 m, one crest, from her port beam, in an Hs 3 m swell (R7)", () => {
    expect(wave.group).toEqual(
      expect.objectContaining({ t: 0, heightM: 30, count: 1, dirDeg: -90 })
    );
    expect(wave.group.periodS).toBeGreaterThanOrEqual(14);
    expect(wave.group.periodS).toBeLessThanOrEqual(16);
    expect(wave.peakDeg).toBe(190);
    expect(wave.rollS).toBeGreaterThanOrEqual(20);
    expect(wave.rollS).toBeLessThanOrEqual(30);
    expect(wave.smaller).toEqual({ heightM: 15, peakDeg: 45 });
    expect(wave.ahead).toEqual({ dirDeg: 0 });
    expect(poseidon.storm!.hsM).toBe(3);
    expect(poseidon.storm!.windKn).toBe(20);
    // Every box is in the box flood (a rule), each to a share of 1.
    expect(new Set((wave.boxFlood ?? []).map((f) => f.id))).toEqual(
      new Set(poseidon.superstructure.map((b) => b.id))
    );
    for (const f of wave.boxFlood ?? []) {
      expect(boxOf(f.id)).toBeDefined();
      expect(f.fill).toBeGreaterThan(0);
      expect(f.fill).toBeLessThanOrEqual(1);
      expect(f.fromU).toBeGreaterThanOrEqual(0);
      expect(f.toU).toBeLessThanOrEqual(1);
      expect(f.toU).toBeGreaterThan(f.fromU);
      // Brought in by her own spots' broken glass.
      expect(f.spots.length).toBeGreaterThan(0);
      for (const id of f.spots)
        expect(wave.spots.map((sp) => sp.id)).toContain(id);
    }
  });

  it("keeps her stated air leaks in range (R8: 0.001–0.05 m²)", () => {
    for (const v of Object.values(poseidon.trappedAir!.leakM2)) {
      expect(v).toBeGreaterThanOrEqual(0.001);
      expect(v).toBeLessThanOrEqual(0.05);
    }
  });

  it("has 24 boats, 12 a side, in the recess (R16)", () => {
    expect(POSEIDON_BOATS).toHaveLength(24);
    for (const side of ["port", "starboard"] as const)
      expect(POSEIDON_BOATS.filter((b) => b.side === side)).toHaveLength(12);
    POSEIDON_BOATS.forEach((b, i) => {
      expect(b.index).toBe(i);
      expect(Math.abs(b.x)).toBeLessThan(poseidon.lbp / 2);
    });
  });

  it("has one real paint for now (Task 6 fills it)", () => {
    const real = (poseidon.liveries ?? []).filter((l) => !l.fun);
    expect(real).toHaveLength(1);
    expect(real[0].default).toBe(true);
  });
});
