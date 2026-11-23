import {
  BRITANNIC_BOATS,
  BRITANNIC_DECKS,
  SHIP_IDS,
  SHIPS,
  britannic,
  getShip,
  titanic,
} from "../../ships";
import {
  BRITANNIC_BH,
  BRITANNIC_GANTRY_SETS,
  BRITANNIC_RAISED_BULKHEADS,
} from "../../ships/britannic";
import { RHO } from "../constants";
import { buildHull, hullHalfBreadth, hullSlice } from "../geometry";
import {
  R_CHT,
  R_MX,
  R_MZ,
  R_SIZE,
  R_VOL,
  integrateSlice,
} from "../hydrostatics";
import { simulate } from "../run";

/**
 * HMHS Britannic's data: the Titanic's length and lines 94 ft wide, her
 * deck heights, the six raised bulkheads, the inner skin, four funnels
 * (the fourth a dummy), 48 boats, the doors and her open portholes.
 */

const DEG = Math.PI / 180;
const FT = 0.3048;

function upright(draught: number) {
  const hull = buildHull(britannic);
  const slice = hullSlice(hull, hull.xMin, hull.xMax);
  const out = new Float64Array(R_SIZE);
  integrateSlice(slice, 0, 0, 1, -draught, out);
  const v = out[R_VOL];
  return {
    tonnes: (v * RHO) / 1000,
    km: (out[R_MZ] + out[R_CHT]) / v,
    lcb: out[R_MX] / v,
  };
}

describe("the Britannic's data", () => {
  it("is in the registry, last, a mine in the morning in 120 m", () => {
    expect(getShip("britannic")).toBe(britannic);
    // After the Carpathia; the Concordia (1.9) follows her.
    expect(SHIP_IDS.indexOf("britannic")).toBe(4);
    expect(SHIP_IDS.indexOf("carpathia")).toBe(3);
    expect(SHIP_IDS.indexOf("fitzgerald")).toBe(2);
    expect(SHIPS.britannic).toBe(britannic);
    expect(britannic.cause).toBe("mine");
    expect(britannic.clockStartS).toBe(8 * 3600 + 12 * 60);
    expect(britannic.seaDepthM).toBe(120);
    expect(britannic.wreck?.restDeg).toBeGreaterThanOrEqual(60);
  });

  it("is the Titanic's length, 94 ft wide, her lines widened", () => {
    expect(Math.abs(britannic.loa - 269.1)).toBeLessThan(0.3);
    expect(Math.abs(britannic.lbp - titanic.lbp)).toBeLessThan(0.01);
    expect(Math.abs(britannic.beam - 94 * FT)).toBeLessThan(0.05);
    expect(Math.abs(britannic.beam - 28.65)).toBeLessThan(0.05);
    const ratio = britannic.beam / titanic.beam;
    const st = britannic.stations;
    expect(st.length).toBeGreaterThanOrEqual(41);
    expect(st).toHaveLength(titanic.stations.length);
    for (let i = 1; i < st.length; i += 1)
      expect(st[i].x).toBeGreaterThan(st[i - 1].x);
    st.forEach((s, i) => {
      const t = titanic.stations[i];
      expect(s.x).toBe(t.x);
      s.offsets.forEach(([z, hb], k) => {
        expect(z).toBe(t.offsets[k][0]);
        const want = t.offsets[k][1] * ratio;
        expect(Math.abs(hb - want)).toBeLessThanOrEqual(
          Math.max(0.01 * want, 0.002)
        );
      });
    });
    // Copied, never shared: the Titanic's arrays are hers.
    expect(st[30].offsets).not.toBe(titanic.stations[30].offsets);
    // Widest at 94 ft.
    const widest = Math.max(
      ...st.flatMap((s) => s.offsets.map(([, hb]) => hb))
    );
    expect(Math.abs(2 * widest - britannic.beam)).toBeLessThan(0.05);
  });

  it("displaces her weight at her draught, with a plausible GM", () => {
    const now = upright(britannic.draught);
    expect(
      Math.abs(now.tonnes - britannic.displacementT) / britannic.displacementT
    ).toBeLessThan(0.02);
    const gm = now.km - britannic.kg;
    expect(gm).toBeGreaterThan(0.5);
    expect(gm).toBeLessThan(3);
    expect(Math.abs(now.lcb - britannic.lcg)).toBeLessThan(0.2);
    // Lighter than her 53,200-ton load condition at 34 ft 7 in [WP].
    expect(britannic.draught).toBeLessThan(34.58 * FT);
    expect(britannic.displacementT).toBeLessThan(53200 * 1.016);
  });

  it("floats on an even keel and dry with her portholes open", () => {
    const track = simulate(britannic, [], { endT: 600 });
    const last = track.frames[track.frames.length - 1];
    expect(Math.abs(-last.bodies[0].z - britannic.draught)).toBeLessThan(0.1);
    expect(Math.abs(last.trimDeg)).toBeLessThan(0.2);
    // A little to starboard from her TCG (coal drawn unevenly), as the
    // Titanic's 1.4° to port: under 1.5°.
    expect(last.listDeg).toBeGreaterThan(0);
    expect(last.listDeg).toBeLessThan(1.5);
    expect(last.waterAboardT).toBe(0);
    expect(Math.abs(last.bodies[0].pitch / DEG)).toBeLessThan(0.2);
  });

  it("has the Titanic's deck heights", () => {
    expect(BRITANNIC_DECKS).toEqual(titanic.decks);
    expect(britannic.decks).toBe(BRITANNIC_DECKS);
    expect(BRITANNIC_DECKS).not.toBe(titanic.decks);
    for (const x of [-100, 0, 100])
      expect(britannic.sheerZ(x)).toBe(titanic.sheerZ(x));
  });

  it("has six bulkheads raised to B deck (R3)", () => {
    expect(BRITANNIC_RAISED_BULKHEADS).toHaveLength(6);
    const B = BRITANNIC_DECKS.find((d) => d.name === "B")!.z;
    const C = BRITANNIC_DECKS.find((d) => d.name === "C")!.z;
    const main = britannic.compartments.filter(
      (c) => !c.span || c.span.side === "centre"
    );
    expect(main).toHaveLength(16);
    for (let i = 1; i < main.length; i += 1)
      expect(main[i].fromX).toBeCloseTo(main[i - 1].toX, 6);
    for (const name of BRITANNIC_RAISED_BULKHEADS) {
      const x = BRITANNIC_BH[name as keyof typeof BRITANNIC_BH];
      const bDeck = britannic.sheerZ(x) + B - C;
      const tops = britannic.compartments.flatMap((c) => [
        ...(Math.abs(c.fromX - x) < 1e-6 ? [c.aftBulkheadTopZ] : []),
        ...(Math.abs(c.toX - x) < 1e-6 ? [c.fwdBulkheadTopZ] : []),
      ]);
      expect(tops.length).toBeGreaterThanOrEqual(2);
      for (const top of tops) expect(Math.abs(top - bDeck)).toBeLessThan(0.02);
    }
    // The ones the Titanic's flooding went over (E deck, boiler room 6/5
    // and 5/4) are among them.
    expect(BRITANNIC_RAISED_BULKHEADS).toEqual(
      expect.arrayContaining(["D", "E", "F"])
    );
  });

  it("has an inner skin along the boiler and engine rooms, both sides alike", () => {
    const comps = britannic.compartments;
    const skinned = comps.filter((c) => c.span?.side === "centre");
    expect(skinned.map((c) => c.id).sort()).toEqual(
      ["br1", "br2", "br3", "br4", "br5", "br6", "engine", "turbine"].sort()
    );
    const hull = buildHull(britannic);
    for (const room of skinned) {
      const beside = (side: "port" | "starboard") =>
        comps.filter(
          (c) =>
            c.span?.side === side &&
            c.fromX === room.fromX &&
            c.toX === room.toX &&
            c.span.y === room.span?.y
        );
      const port = beside("port");
      const stbd = beside("starboard");
      expect(port).toHaveLength(1);
      expect(stbd).toHaveLength(1);
      const { id: pid, label: pl, span: ps, ...p } = port[0];
      const { id: sid, label: sl, span: ss, ...s } = stbd[0];
      expect(s).toEqual(p);
      expect(ss?.y).toBe(ps?.y);
      expect(pid).not.toBe(sid);
      expect(pl).not.toBe(sl);
      // Narrow: under a metre at her waterline, never empty.
      const x = (room.fromX + room.toX) / 2;
      const gap = hullHalfBreadth(hull, x, britannic.draught) - room.span!.y;
      expect(gap).toBeGreaterThan(0.5);
      expect(gap).toBeLessThan(1.2);
      expect(room.crossFlowM2 ?? 0).toBe(0);
      expect(port[0].crossFlowM2 ?? 0).toBe(0);
    }
    // No double skin at the holds.
    for (const id of ["hold1", "hold2", "hold3", "fore-peak"])
      expect(comps.find((c) => c.id === id)!.span).toBeUndefined();
  });

  it("has four funnels, the fourth a dummy", () => {
    expect(britannic.funnels).toHaveLength(4);
    britannic.funnels.forEach((f, i) => {
      expect(f.dummy).toBe(i === 3);
      expect(f.topZ).toBeGreaterThan(f.baseZ);
      expect(f.falls).toBeUndefined();
      if (i > 0) expect(f.x).toBeLessThan(britannic.funnels[i - 1].x);
    });
  });

  it("has 48 boats, gantry boats only at the five sets (R5)", () => {
    expect(BRITANNIC_BOATS).toHaveLength(48);
    BRITANNIC_BOATS.forEach((b, i) => expect(b.index).toBe(i));
    expect(BRITANNIC_GANTRY_SETS).toHaveLength(5);
    // One forward to starboard, four aft (two a side).
    const fwd = BRITANNIC_GANTRY_SETS.filter((s) => s.x > 0);
    expect(fwd).toEqual([expect.objectContaining({ side: "starboard" })]);
    const aft = BRITANNIC_GANTRY_SETS.filter((s) => s.x < 0);
    expect(aft.filter((s) => s.side === "port")).toHaveLength(2);
    expect(aft.filter((s) => s.side === "starboard")).toHaveLength(2);
    const gantry = BRITANNIC_BOATS.filter((b) => b.kind === "gantry");
    expect(gantry).toHaveLength(30); // six a set
    for (const b of gantry)
      expect(
        BRITANNIC_GANTRY_SETS.some(
          (s) => s.side === b.side && Math.abs(s.x - b.x) <= 6
        )
      ).toBe(true);
    for (const b of BRITANNIC_BOATS.filter((k) => k.kind === "welin"))
      expect(
        BRITANNIC_GANTRY_SETS.some(
          (s) => s.side === b.side && Math.abs(s.x - b.x) <= 6
        )
      ).toBe(false);
    // On the boat deck, between the bridge and the stern.
    for (const b of BRITANNIC_BOATS) {
      expect(b.x).toBeLessThan(75);
      expect(b.x).toBeGreaterThan(-85);
    }
  });

  it("has porthole rows inside the hull at deck heights", () => {
    const rows = britannic.portholes ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const hull = buildHull(britannic);
    const deckZs = BRITANNIC_DECKS.map((d) => d.z);
    for (const row of rows) {
      expect(row.fromX).toBeLessThan(row.toX);
      expect(row.openM2PerM).toBeGreaterThan(0);
      expect(row.openM2PerM).toBeLessThanOrEqual(0.07);
      const mid = (row.fromX + row.toX) / 2;
      // 1 m over a deck at the row's middle (the deck there, with sheer).
      const over = deckZs.map(
        (d) => row.z - (d + britannic.sheerZ(mid) - britannic.sheerZ(0))
      );
      expect(over.some((h) => h > 0.5 && h < 1.6)).toBe(true);
      for (let x = row.fromX; x <= row.toX; x += 5) {
        const z = row.followsSheer
          ? row.z + britannic.sheerZ(x) - britannic.sheerZ(mid)
          : row.z;
        expect(z).toBeLessThan(britannic.sheerZ(x));
        expect(z).toBeGreaterThan(britannic.draught);
        expect(hullHalfBreadth(hull, x, z)).toBeGreaterThan(2);
      }
    }
    // Both sides alike.
    const port = rows.filter((r) => r.side === "port");
    const stbd = rows.filter((r) => r.side === "starboard");
    expect(port.map((r) => ({ ...r, side: "starboard" }))).toEqual(stbd);
  });

  it("has doors between neighbours, on a bulkhead", () => {
    const doors = britannic.doors ?? [];
    expect(doors.filter((d) => d.kind === "door")).toHaveLength(1);
    expect(doors.some((d) => d.kind === "damage")).toBe(true);
    const comps = britannic.compartments;
    const bulkheads = Object.values(BRITANNIC_BH);
    for (const d of doors) {
      expect(bulkheads.some((x) => Math.abs(x - d.x) < 1e-6)).toBe(true);
      const aft = comps.find((c) => c.id === d.aftId)!;
      const fwd = comps.find((c) => c.id === d.fwdId)!;
      expect(aft).toBeDefined();
      expect(fwd).toBeDefined();
      expect(Math.abs(aft.toX - d.x)).toBeLessThan(1e-6);
      expect(Math.abs(fwd.fromX - d.x)).toBeLessThan(1e-6);
      expect(d.zHigh).toBeGreaterThan(d.zLow);
      expect(d.areaM2).toBeGreaterThan(0);
    }
    // The watertight door is boiler room 6's into 5 [WP].
    const door = doors.find((d) => d.kind === "door")!;
    expect([door.aftId, door.fwdId]).toEqual(["br5", "br6"]);
  });

  it("has the mine's hole low on her starboard side by the hold 2/3 bulkhead", () => {
    expect(britannic.realNight).toHaveLength(1);
    const [hole] = britannic.realNight;
    expect(hole.side).toBe("starboard");
    expect(hole.zHigh).toBeLessThan(britannic.draught);
    expect(hole.t ?? 0).toBe(0);
    expect(Math.abs(hole.x - BRITANNIC_BH.C)).toBeLessThan(5);
    expect(["hold2", "hold3"]).toContain(hole.compartmentId);
    expect(britannic.scripted[0]).toEqual({ t: 0, kind: "explosion" });
  });

  it("has her way: a profile, a turn to starboard and a ram head forward", () => {
    const h = britannic.headway!;
    expect(h.profile![0][0]).toBe(0);
    // About 20 knots at the mine (R9).
    expect(h.profile![0][1] / 0.514444).toBeGreaterThan(19);
    expect(h.profile![0][1] / 0.514444).toBeLessThan(21.5);
    for (let i = 1; i < h.profile!.length; i += 1)
      expect(h.profile![i][0]).toBeGreaterThan(h.profile![i - 1][0]);
    // Stopped for good after 9:00.
    expect(h.profile![h.profile!.length - 1][1]).toBe(0);
    const turn = h.turn!;
    expect(turn[turn.length - 1][1]).toBeLessThan(0); // to starboard
    expect(h.ram!.cp).toBeGreaterThan(0);
    expect(h.ram!.cp).toBeLessThanOrEqual(1);
  });
});
