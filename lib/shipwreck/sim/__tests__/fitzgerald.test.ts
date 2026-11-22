import {
  FITZGERALD_BOATS,
  FITZGERALD_CARGO_T,
  FITZGERALD_DECKS,
  FITZGERALD_HATCHES,
  SHIPS,
  SHIP_IDS,
  fitzgerald,
  getShip,
} from "../../ships";
import { type DeckOpening, isDeckOpening } from "../../ships/types";
import { buildHull, hullHalfBreadth, hullSlice } from "../geometry";
import {
  R_CHT,
  R_MX,
  R_MZ,
  R_SIZE,
  R_VOL,
  integrateSlice,
} from "../hydrostatics";
import {
  VENTS_SPOT,
  shoalSpot,
  simulate,
  whatIfOpenings,
  whatIfRealIds,
  whatIfSpots,
} from "../run";

const FT = 0.3048;
const DEG = Math.PI / 180;
const LONG_TON = 1.0160469;
/** Her holds' moulded volume: 860,950 ft³ (USCG). */
const HOLDS_M3 = 860950 * FT ** 3;

const hull = buildHull(fitzgerald);

function upright(draught: number) {
  const slice = hullSlice(hull, hull.xMin, hull.xMax);
  const out = new Float64Array(R_SIZE);
  integrateSlice(slice, 0, 0, 1, -draught, out);
  const v = out[R_VOL];
  return {
    // Fresh water: a cubic metre is a tonne.
    tonnes: v * ((fitzgerald.waterDensity ?? 1025) / 1000),
    cb: v / (fitzgerald.lbp * fitzgerald.beam * draught),
    km: (out[R_MZ] + out[R_CHT]) / v,
    lcb: out[R_MX] / v,
  };
}

const comp = (id: string) => {
  const c = fitzgerald.compartments.find((k) => k.id === id);
  if (!c) throw new Error(id);
  return c;
};
const capacity = (id: string) => {
  const c = comp(id);
  return hullSlice(hull, c.fromX, c.toX, c.span).capacity;
};
const hatches = (fitzgerald.deckOpenings ?? []).filter(
  (d) => d.kind === "hatch"
);
const vents = (fitzgerald.deckOpenings ?? []).filter((d) => d.kind === "vent");
const splits = (fitzgerald.deckOpenings ?? []).filter(
  (d) => d.kind === "split"
);

describe("the Edmund Fitzgerald's data", () => {
  it("is in the registry, last", () => {
    expect(getShip("fitzgerald")).toBe(fitzgerald);
    expect(SHIP_IDS[SHIP_IDS.length - 1]).toBe("fitzgerald");
    expect(fitzgerald.cause).toBe("storm");
    expect(fitzgerald.clockStartS).toBe(15 * 3600 + 30 * 60); // 3:30 PM
    expect(fitzgerald.seaDepthM).toBe(162); // 530 ft
    expect(fitzgerald.waterDensity).toBe(1000); // fresh, about 4–6 °C
  });

  it("has her length, breadth, depth and a full hull aft to forward", () => {
    expect(Math.abs(fitzgerald.loa - 222.2)).toBeLessThan(0.5); // 729 ft
    expect(Math.abs(fitzgerald.lbp - 711 * FT)).toBeLessThan(0.1);
    expect(Math.abs(fitzgerald.beam - 22.9)).toBeLessThan(0.1); // 75 ft
    expect(Math.abs(fitzgerald.depth - 11.9)).toBeLessThan(0.1); // 39 ft
    const st = fitzgerald.stations;
    expect(st.length).toBeGreaterThanOrEqual(41);
    for (let i = 1; i < st.length; i += 1)
      expect(st[i].x).toBeGreaterThan(st[i - 1].x);
    expect(st[st.length - 1].x - st[0].x).toBeCloseTo(fitzgerald.loa, 1);
  });

  it("displaces her weight at her draught in fresh water", () => {
    const now = upright(fitzgerald.draught);
    expect(
      Math.abs(now.tonnes - fitzgerald.displacementT) / fitzgerald.displacementT
    ).toBeLessThan(0.02);
    // A straight-decker's full hull; floats about level.
    expect(now.cb).toBeGreaterThan(0.8);
    expect(now.cb).toBeLessThan(0.9);
    expect(Math.abs(now.lcb - fitzgerald.lcg)).toBeLessThan(0.5);
    // Her lightship and stores are what the cargo leaves: a laker's.
    const rest = fitzgerald.displacementT - FITZGERALD_CARGO_T;
    expect(rest).toBeGreaterThan(6500);
    expect(rest).toBeLessThan(10500);
  });

  it("is stiff, as a laden ore carrier is (GM 2.5–5 m)", () => {
    const gm = upright(fitzgerald.draught).km - fitzgerald.kg;
    expect(gm).toBeGreaterThan(2.5);
    expect(gm).toBeLessThan(5);
  });

  it("rides with her winter freeboard at midships", () => {
    // 11 ft 6 in minimum (1973 winter load line); 27 ft 2 in / 27 ft 6 in.
    const freeboard = fitzgerald.sheerZ(0) - fitzgerald.draught;
    expect(freeboard).toBeGreaterThanOrEqual(3.2);
    expect(freeboard).toBeLessThanOrEqual(3.8);
  });

  it("has 21 hatches, No. 1 forward, between her houses", () => {
    expect(FITZGERALD_HATCHES).toHaveLength(21);
    expect(hatches).toHaveLength(21);
    const forecastle = Math.min(
      ...fitzgerald.superstructure
        .filter((s) => s.fromX > 0)
        .map((s) => s.fromX)
    );
    const afterHouse = Math.max(
      ...fitzgerald.superstructure.filter((s) => s.toX < 0).map((s) => s.toX)
    );
    const half = (11 * FT) / 2;
    FITZGERALD_HATCHES.forEach((h, i) => {
      expect(h.number).toBe(i + 1);
      expect(h.id).toBe(hatches[i].id);
      expect(hatches[i].x).toBe(h.x);
      expect(h.x + half).toBeLessThan(forecastle);
      expect(h.x - half).toBeGreaterThan(afterHouse);
      // 24 ft centres.
      if (i > 0)
        expect(FITZGERALD_HATCHES[i - 1].x - h.x).toBeCloseTo(24 * FT, 1);
      // The coaming's top 3 ft 6 in over the deck at side.
      expect(hatches[i].z - fitzgerald.sheerZ(h.x)).toBeCloseTo(3.5 * FT, 1);
      expect(hatches[i].y).toBe(0);
      // Into the hold under it: Nos. 1–7, 8–13, 14–21 (the screens).
      const into = comp(hatches[i].compartmentId);
      expect(h.x).toBeGreaterThan(into.fromX);
      expect(h.x).toBeLessThan(into.toX);
      expect(into.id).toBe(
        h.number <= 7 ? "hold1" : h.number <= 13 ? "hold2" : "hold3"
      );
    });
  });

  it("has her holds, ballast tanks port and starboard, peaks and engine room", () => {
    const ids = fitzgerald.compartments.map((c) => c.id);
    expect(ids).toEqual([
      "aft-peak",
      "engine",
      "hold3",
      "tank3-p",
      "tank3-s",
      "hold2",
      "tank2-p",
      "tank2-s",
      "hold1",
      "tank1-p",
      "tank1-s",
      "fore-peak",
    ]);
    // Holds 198, 144 and 177 ft long.
    for (const [id, ft] of [
      ["hold3", 198],
      ["hold2", 144],
      ["hold1", 177],
    ] as const) {
      const c = comp(id);
      expect(c.toX - c.fromX).toBeCloseTo(ft * FT, 1);
      expect(c.pumped).toBe(false);
    }
    // The tanks mirror each other.
    for (const n of [1, 2, 3]) {
      const p = comp(`tank${n}-p`);
      const s = comp(`tank${n}-s`);
      expect(p.span).toEqual({ side: "port", y: s.span?.y });
      expect(s.span?.side).toBe("starboard");
      expect([p.fromX, p.toX, p.permeability, p.burstM2]).toEqual([
        s.fromX,
        s.toX,
        s.permeability,
        s.burstM2,
      ]);
      expect(capacity(`tank${n}-p`)).toBeCloseTo(capacity(`tank${n}-s`), 6);
    }
    // The holds' cells hold her holds and the double bottom under them.
    const cells = ["hold1", "hold2", "hold3"].reduce(
      (a, id) => a + capacity(id),
      0
    );
    expect(cells / HOLDS_M3).toBeGreaterThan(1.05);
    expect(cells / HOLDS_M3).toBeLessThan(1.25);
  });

  it("carries 26,116 long tons of taconite, the pellets' voids open to water", () => {
    const cargo = fitzgerald.compartments.reduce(
      (a, c) => a + (c.cargoT ?? 0),
      0
    );
    expect(
      Math.abs(cargo - 26116 * LONG_TON) / (26116 * LONG_TON)
    ).toBeLessThan(0.005);
    expect(FITZGERALD_CARGO_T).toBeCloseTo(26535.5, 0);
    // Permeability: the hold (its share of 860,950 ft³) less the pellets'
    // solid volume (130 lb/ft³ in bulk, 27.5 lb of water in a cubic foot's
    // voids), over the cell.
    const bulk = (130 * 0.45359237) / FT ** 3 / 1000;
    const voids = 27.5 / 62.43;
    const cells = ["hold1", "hold2", "hold3"].reduce(
      (a, id) => a + capacity(id),
      0
    );
    for (const id of ["hold1", "hold2", "hold3"]) {
      const c = comp(id);
      const cell = capacity(id);
      const solids = ((c.cargoT ?? 0) / bulk) * (1 - voids);
      const perm = (cell * (HOLDS_M3 / cells) - solids) / cell;
      expect(c.permeability).toBeCloseTo(perm, 2);
    }
  });

  it("has one funnel, two lifeboats aft and two rafts", () => {
    expect(fitzgerald.funnels).toHaveLength(1);
    expect(fitzgerald.funnels[0].x).toBeLessThan(0);
    expect(FITZGERALD_BOATS.filter((b) => b.kind === "lifeboat")).toHaveLength(
      2
    );
    expect(FITZGERALD_BOATS.filter((b) => b.kind === "raft")).toHaveLength(2);
    for (const b of FITZGERALD_BOATS.filter((k) => k.kind === "lifeboat"))
      expect(b.x).toBeLessThan(-70);
    expect(FITZGERALD_DECKS.map((d) => d.name)).toEqual(
      expect.arrayContaining([
        "Spar",
        "Forecastle",
        "Texas",
        "Pilothouse",
        "Poop",
        "Tank top",
      ])
    );
  });

  it("has a nearly upright stem with a small rake (her photographs)", () => {
    // The forward end of the hull at a height: the stem's x there.
    const stemAt = (z: number) => {
      let x = hull.xMax;
      while (x > 0 && hullHalfBreadth(hull, x, z) <= 0.01) x -= 0.05;
      return x;
    };
    const fp = fitzgerald.lbp / 2;
    // At the waterline the stem is at the forward perpendicular (within
    // the 3.7 m between stations' reading of it).
    expect(Math.abs(stemAt(fitzgerald.draught) - fp)).toBeLessThan(1);
    // From the forefoot (2 m up) to the waterline it rakes a little: the
    // data's stem is 6° from upright, which the stations (3.7 m apart, the
    // last at the stem with no breadth) read as under 20°; a liner's raked,
    // cut-away bow (her first data) read 34°.
    const rake = stemAt(fitzgerald.draught) - stemAt(2);
    expect(rake).toBeGreaterThan(0);
    expect(Math.atan2(rake, fitzgerald.draught - 2)).toBeLessThan(20 * DEG);
    // LOA 729 ft is kept: the overhang is mostly her round stern's.
    expect(fp - hull.xMin - fitzgerald.lbp).toBeGreaterThan(4);
  });

  it("has her pilothouse one tier on the texas deck", () => {
    const z = (name: string) =>
      FITZGERALD_DECKS.find((d) => d.name === name)!.z;
    // The 1971 bow slide: the pilothouse about as tall as the forecastle
    // tier, standing on the texas deck (its floor a step up, not a tier).
    expect(z("Pilothouse") - z("Texas")).toBeGreaterThan(0);
    expect(z("Pilothouse") - z("Texas")).toBeLessThan(1.2);
  });

  it("keeps her funnel and plays her dive in real time", () => {
    // A welded stack: no `funnel-falls` (the liners' stays rule).
    expect(fitzgerald.funnels.every((f) => f.falls === false)).toBe(true);
    expect(fitzgerald.descentTimeScale).toBe(1);
    // The liners keep theirs (their golden runs are unchanged).
    for (const id of SHIP_IDS.filter((k) => k !== "fitzgerald")) {
      expect(SHIPS[id].funnels.every((f) => f.falls === undefined)).toBe(true);
      expect(SHIPS[id].descentTimeScale).toBeUndefined();
    }
  });

  it("has her damage where the sources put it: topside, and the graze", () => {
    // Her hull damage is the graze on Six Fathom Shoal alone (R14): the
    // strips along her forward bottom, each a What-if spot.
    expect(fitzgerald.realNight).toEqual(fitzgerald.shoalOpenings);
    for (const o of fitzgerald.realNight) expect(o.zHigh).toBeLessThan(1);
    // The split along her starboard deck edge where the fence rail went,
    // beside the vents, into the same tanks.
    expect(splits.length).toBeGreaterThan(0);
    const xs = vents.map((v) => v.x);
    for (const s of splits) {
      expect(s.compartmentId).toBe("tank1-s");
      expect(s.y).toBeCloseTo(-fitzgerald.beam / 2, 1);
      const under = fitzgerald.sheerZ(s.x) - s.z;
      expect(under).toBeGreaterThan(0);
      expect(under).toBeLessThan(1);
      expect(s.x).toBeGreaterThan(Math.min(...xs) - 5);
      expect(s.x).toBeLessThan(Math.max(...xs) + 10);
    }
    // Every opening of hers is over the still water, well clear of it.
    for (const d of fitzgerald.deckOpenings ?? [])
      expect(d.z - fitzgerald.draught).toBeGreaterThan(2.5);
  });

  it("has her real afternoon's damage and her storm", () => {
    // Two broken vents into the starboard tanks by No. 1 hold, from 3:30.
    expect(vents).toHaveLength(2);
    for (const v of vents) {
      expect(v.compartmentId).toBe("tank1-s");
      expect(v.y).toBeLessThan(0);
      expect(v.t ?? 0).toBe(0);
    }
    // Every hatch cover leaks a little and gives way under a head of water.
    for (const h of hatches) {
      expect(h.areaM2).toBeGreaterThan(0);
      expect(h.failHeadM).toBeGreaterThan(4 * FT); // over the design head
      expect(h.failHeadM).toBeLessThanOrEqual(12.5 * FT); // NTSB: enough
      expect(h.failedAreaM2).toBeCloseTo(11 * 48 * FT * FT, 1);
    }
    // Two 7,000 gpm pumps.
    expect(fitzgerald.pumpsM3s).toBeCloseTo(
      (2 * 7000 * 3.785411784) / 60000,
      3
    );
    // The hindcast's sea: 7.6 m at its height, from astern.
    const storm = fitzgerald.storm;
    expect(storm?.hsM).toBe(7.6);
    expect(storm?.groups).toHaveLength(1);
    expect(storm?.groups?.[0].count).toBe(3);
    // The three sisters just after her last message at 7:10 PM.
    expect(storm?.groups?.[0].t).toBeGreaterThan(13200);
    expect(storm?.groups?.[0].t).toBeLessThan(13500);
    // She makes Whitefish Bay after 7:25 if she floats.
    expect(fitzgerald.shelter?.t).toBeGreaterThan(14100);
    expect(fitzgerald.wreckParts?.stern).toEqual({
      capsize: true,
      restDeg: 180,
      rollDegS: 50,
    });
  });
});

describe("the Fitzgerald's What if", () => {
  const spots = whatIfSpots(fitzgerald);

  it("offers each hatch, her vents and each shoal strip", () => {
    expect(spots).toEqual([
      ...FITZGERALD_HATCHES.map((h) => h.id),
      VENTS_SPOT,
      shoalSpot(1),
      shoalSpot(2),
      shoalSpot(3),
    ]);
    // Her real damage: every hatch (none was tight), her topside damage
    // and the graze's three strips (R14).
    expect(whatIfRealIds(fitzgerald)).toEqual([
      ...FITZGERALD_HATCHES.map((h) => h.id),
      VENTS_SPOT,
      shoalSpot(1),
      shoalSpot(2),
      shoalSpot(3),
    ]);
  });

  it("gives exactly the chosen openings, the other covers tight", () => {
    const real = whatIfOpenings(fitzgerald, whatIfRealIds(fitzgerald));
    expect(real.filter(isDeckOpening)).toEqual(fitzgerald.deckOpenings);
    expect(real.filter((o) => !isDeckOpening(o))).toEqual(fitzgerald.realNight);

    const none = whatIfOpenings(fitzgerald, []);
    expect(none).toHaveLength(21);
    for (const d of none as DeckOpening[]) {
      expect(d.kind).toBe("hatch");
      expect(d.tight).toBe(true);
    }

    const some = whatIfOpenings(fitzgerald, ["hatch-1", shoalSpot(2)]);
    const deck = some.filter(isDeckOpening);
    expect(deck.filter((d) => !d.tight).map((d) => d.id)).toEqual(["hatch-1"]);
    expect(deck.some((d) => d.kind === "vent")).toBe(false);
    expect(deck.some((d) => d.kind === "split")).toBe(false);
    expect(some.filter((o) => !isDeckOpening(o))).toEqual([
      fitzgerald.shoalOpenings?.[1],
    ]);
  });

  it("a tight cover is what `hatchesTight` makes of it", () => {
    // No leak and twice the head, cover by cover: the two forms run alike.
    const a = simulate(fitzgerald, whatIfOpenings(fitzgerald, []), {
      endT: 600,
    });
    const b = simulate(fitzgerald, [], {
      endT: 600,
      hatchesTight: true,
      topsideDamage: false,
    });
    expect(a).toEqual(b);
  });
});
