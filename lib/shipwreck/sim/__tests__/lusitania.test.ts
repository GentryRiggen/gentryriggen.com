import {
  LUSITANIA_BOATS,
  SHIP_IDS,
  SHIPS,
  getShip,
  lusitania,
} from "../../ships";
import { RHO } from "../constants";
import { buildHull, hullSlice } from "../geometry";
import {
  R_CH,
  R_CHT,
  R_MX,
  R_MZ,
  R_SIZE,
  R_VOL,
  integrateSlice,
} from "../hydrostatics";
import { simulate } from "../run";

const DEG = Math.PI / 180;
const FT = 0.3048;
const LONG_TON = 1.016;

function upright(draught: number) {
  const hull = buildHull(lusitania);
  const slice = hullSlice(hull, hull.xMin, hull.xMax);
  const out = new Float64Array(R_SIZE);
  integrateSlice(slice, 0, 0, 1, -draught, out);
  const v = out[R_VOL];
  return {
    tonnes: (v * RHO) / 1000,
    cb: v / (lusitania.lbp * lusitania.beam * draught),
    km: (out[R_MZ] + out[R_CHT]) / v,
    lcb: out[R_MX] / v,
    waterplane: out[R_CH],
  };
}

describe("the Lusitania's data", () => {
  it("is in the registry", () => {
    expect(getShip("lusitania")).toBe(lusitania);
    expect(SHIP_IDS).toEqual([
      "titanic",
      "lusitania",
      "fitzgerald",
      "carpathia",
      "britannic",
    ]);
    expect(Object.keys(SHIPS).sort()).toEqual([
      "britannic",
      "carpathia",
      "fitzgerald",
      "lusitania",
      "titanic",
    ]);
    expect(lusitania.cause).toBe("torpedo");
    expect(lusitania.clockStartS).toBe(14 * 3600 + 10 * 60);
    expect(lusitania.seaDepthM).toBe(93);
  });

  it("has her length, breadth and a full hull aft to forward", () => {
    expect(Math.abs(lusitania.loa - 787 * FT)).toBeLessThan(0.5); // 239.9 m
    expect(Math.abs(lusitania.lbp - 760 * FT)).toBeLessThan(0.5); // 231.6 m
    expect(Math.abs(lusitania.beam - 26.7)).toBeLessThan(0.1);
    const st = lusitania.stations;
    expect(st.length).toBeGreaterThanOrEqual(41);
    for (let i = 1; i < st.length; i += 1)
      expect(st[i].x).toBeGreaterThan(st[i - 1].x);
    expect(st[st.length - 1].x - st[0].x).toBeCloseTo(lusitania.loa, 1);
  });

  it("displaces her weight at her draught, and a fine hull at load", () => {
    const now = upright(lusitania.draught);
    expect(
      Math.abs(now.tonnes - lusitania.displacementT) / lusitania.displacementT
    ).toBeLessThan(0.02);
    // At her 33 ft 6 in load draught: between the 38,000 and 41,440 tons
    // the sources give, with a 25-knot ship's block coefficient.
    const load = upright(33.5 * FT);
    expect(load.tonnes).toBeGreaterThan(38000 * LONG_TON);
    expect(load.tonnes).toBeLessThan(41440 * LONG_TON);
    expect(load.cb).toBeGreaterThan(0.58);
    expect(load.cb).toBeLessThan(0.64);
  });

  it("has a small positive GM (0.5–1.2 m) and floats level", () => {
    const now = upright(lusitania.draught);
    const gm = now.km - lusitania.kg;
    expect(gm).toBeGreaterThan(0.5);
    expect(gm).toBeLessThan(1.2);
    expect(Math.abs(now.lcb - lusitania.lcg)).toBeLessThan(0.2);
    const track = simulate(lusitania, [], { endT: 600 });
    const last = track.frames[track.frames.length - 1];
    expect(Math.abs(-last.bodies[0].z - lusitania.draught)).toBeLessThan(0.1);
    expect(Math.abs(last.trimDeg)).toBeLessThan(0.2);
    expect(Math.abs(last.listDeg)).toBeLessThan(0.2);
    // Her portholes are open, but all of them are above the sea.
    expect(last.waterAboardT).toBe(0);
    expect(track.outcome).toBe("floated");
    expect(Math.abs(last.bodies[0].pitch / DEG)).toBeLessThan(0.2);
  });

  it("has four working funnels", () => {
    expect(lusitania.funnels).toHaveLength(4);
    for (const f of lusitania.funnels) {
      expect(f.dummy).toBe(false);
      expect(f.topZ).toBeGreaterThan(f.baseZ);
    }
    for (let i = 1; i < 4; i += 1)
      expect(lusitania.funnels[i].x).toBeLessThan(lusitania.funnels[i - 1].x);
  });

  it("has twelve sections end to end and side bunkers at every boiler room", () => {
    const comps = lusitania.compartments;
    const main = comps.filter((c) => !c.span || c.span.side === "centre");
    // Eleven principal bulkheads, twelve sections (Mersey).
    expect(main).toHaveLength(12);
    expect(main[0].fromX).toBeCloseTo(lusitania.stations[0].x, 1);
    for (let i = 1; i < main.length; i += 1)
      expect(main[i].fromX).toBeCloseTo(main[i - 1].toX, 6);
    const rooms = comps.filter((c) => c.kind === "boiler" && !c.span?.side);
    expect(rooms).toHaveLength(0); // every boiler room is a centre cell
    const centres = comps.filter(
      (c) => c.kind === "boiler" && c.span?.side === "centre"
    );
    expect(centres).toHaveLength(4);
    for (const room of centres) {
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
      // The two sides mirror each other.
      const { id: pid, label: pl, span: ps, ...p } = port[0];
      const { id: sid, label: sl, span: ss, ...s } = stbd[0];
      expect(s).toEqual(p);
      expect(ss?.y).toBe(ps?.y);
      expect(pid).not.toBe(sid);
      expect(pl).not.toBe(sl);
    }
  });

  it("has the real hit on the starboard side, below the waterline", () => {
    const real = lusitania.realNight;
    expect(real.length).toBeGreaterThan(0);
    for (const o of real) {
      expect(o.side).toBe("starboard");
      expect(o.zHigh).toBeLessThan(lusitania.draught);
      expect(lusitania.compartments.some((c) => c.id === o.compartmentId)).toBe(
        true
      );
    }
    // The torpedo at once, the second explosion a few seconds later.
    expect(real.some((o) => (o.t ?? 0) === 0)).toBe(true);
    const later = real.filter((o) => (o.t ?? 0) > 0);
    expect(later.length).toBeGreaterThan(0);
    for (const o of later) expect(o.t).toBeLessThan(30);
    const explosion = lusitania.scripted.find((e) => e.kind === "explosion");
    expect(explosion?.t).toBe(later[0].t);
    // Under the bridge (the forward end of the long house), forward of the
    // first funnel.
    const bridge = Math.max(
      ...lusitania.superstructure
        .filter((b) => b.toX < lusitania.lbp / 2 - 20)
        .map((b) => b.toX)
    );
    const torpedo = real.filter((o) => (o.t ?? 0) === 0);
    for (const o of torpedo) {
      expect(Math.abs(o.x - bridge)).toBeLessThan(10);
      expect(o.x).toBeGreaterThan(lusitania.funnels[0].x);
    }
  });

  it("has portholes on the lower decks, both sides, above the water", () => {
    const rows = lusitania.portholes ?? [];
    expect(rows.some((r) => r.side === "port")).toBe(true);
    expect(rows.some((r) => r.side === "starboard")).toBe(true);
    for (const r of rows) {
      expect(r.z).toBeGreaterThan(lusitania.draught);
      expect(r.z).toBeLessThan(lusitania.depth);
      expect(r.toX).toBeGreaterThan(r.fromX);
      expect(r.openM2PerM).toBeGreaterThan(0);
    }
  });

  it("has 48 boats: 22 wooden on davits, 26 collapsibles", () => {
    expect(LUSITANIA_BOATS).toHaveLength(48);
    const wooden = LUSITANIA_BOATS.filter((b) => b.kind === "wooden");
    expect(wooden).toHaveLength(22);
    expect(wooden.filter((b) => b.side === "starboard")).toHaveLength(11);
    expect(
      LUSITANIA_BOATS.filter((b) => b.kind === "collapsible")
    ).toHaveLength(26);
    LUSITANIA_BOATS.forEach((b, i) => expect(b.index).toBe(i));
    expect(new Set(LUSITANIA_BOATS.map((b) => b.label)).size).toBe(48);
    // Odd numbers to starboard, even to port.
    for (const b of wooden)
      expect(Number(b.label) % 2 === 1).toBe(b.side === "starboard");
  });

  it("lowers the six boats that got away, all to starboard", () => {
    const boats = lusitania.scripted.filter((e) => e.kind === "boat-lowered");
    expect(boats.map((b) => LUSITANIA_BOATS[b.index as number].label)).toEqual([
      "1",
      "9",
      "11",
      "13",
      "15",
      "21",
    ]);
    for (const b of boats)
      expect(LUSITANIA_BOATS[b.index as number].side).toBe("starboard");
    expect(boats[boats.length - 1].t).toBeLessThan(18 * 60);
  });

  it("carries her way from 18 knots", () => {
    expect(lusitania.headway?.startMs).toBeCloseTo(18 * 0.514444, 3);
    expect(lusitania.headway?.halfLifeS).toBeGreaterThan(0);
  });
});
