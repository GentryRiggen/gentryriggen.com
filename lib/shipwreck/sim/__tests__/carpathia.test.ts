import {
  CARPATHIA_AFTER_DECK,
  CARPATHIA_BOAT_DECK,
  CARPATHIA_BOAT_PLATFORM,
  CARPATHIA_BOATS,
  CARPATHIA_BRIDGE_DECK,
  CARPATHIA_BRIDGE_HOUSE,
  CARPATHIA_DECKS,
  CARPATHIA_FUNNEL_PAINT,
  CARPATHIA_FUNNEL_PAINTS,
  CARPATHIA_HIT_T,
  CARPATHIA_MASTS,
  CARPATHIA_LIVERIES,
  CARPATHIA_STERN_HOUSE,
  CARPATHIA_SUPERSTRUCTURE,
  CARPATHIA_WELLS,
  SHIP_IDS,
  SHIPS,
  carpathia,
  getShip,
} from "../../ships";
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
import {
  FINISHER_SPOT,
  whatIfOpenings,
  whatIfRealIds,
  whatIfSpots,
} from "../run";

const FT = 0.3048;

function upright(draught: number) {
  const hull = buildHull(carpathia);
  const slice = hullSlice(hull, hull.xMin, hull.xMax);
  const out = new Float64Array(R_SIZE);
  integrateSlice(slice, 0, 0, 1, -draught, out);
  const v = out[R_VOL];
  return {
    tonnes: (v * RHO) / 1000,
    cb: v / (carpathia.lbp * carpathia.beam * draught),
    km: (out[R_MZ] + out[R_CHT]) / v,
    lcb: out[R_MX] / v,
  };
}

/** The main spaces along her length (no side bunkers). */
const main = carpathia.compartments.filter(
  (c) => !c.span || c.span.side === "centre"
);

describe("the Carpathia's data", () => {
  it("is in the registry, after the Fitzgerald", () => {
    expect(getShip("carpathia")).toBe(carpathia);
    expect(SHIPS.carpathia).toBe(carpathia);
    expect(SHIP_IDS).toEqual([
      "titanic",
      "lusitania",
      "fitzgerald",
      "carpathia",
      "britannic",
    ]);
    expect(carpathia.cause).toBe("torpedo");
    expect(carpathia.clockStartS).toBe(9 * 3600 + 15 * 60); // 9:15 AM
    expect(carpathia.seaDepthM).toBe(150);
  });

  it("has her length, breadth and a full hull aft to forward", () => {
    expect(Math.abs(carpathia.loa - 170.1)).toBeLessThanOrEqual(0.5); // 558 ft
    expect(Math.abs(carpathia.lbp - 164.6)).toBeLessThanOrEqual(1.0); // 540 ft
    expect(Math.abs(carpathia.beam - 19.66)).toBeLessThanOrEqual(0.1); // 64½ ft
    const st = carpathia.stations;
    expect(st.length).toBeGreaterThanOrEqual(41);
    for (let i = 1; i < st.length; i += 1)
      expect(st[i].x).toBeGreaterThan(st[i - 1].x);
    expect(st[st.length - 1].x - st[0].x).toBeCloseTo(carpathia.loa, 1);
  });

  it("displaces her weight at her ballast draught; an intermediate liner's hull at load", () => {
    const now = upright(carpathia.draught);
    expect(
      Math.abs(now.tonnes - carpathia.displacementT) / carpathia.displacementT
    ).toBeLessThan(0.02);
    // Her ballast draught is under her 34 ft 7 in load draught.
    const load = upright(34 * FT + (7 * FT) / 12);
    expect(carpathia.draught).toBeLessThan(34 * FT + (7 * FT) / 12);
    // A 14-knot ship's fullness; about 12,000 tons dead weight over her
    // lightship (The Engineer), so the load displacement is more than that.
    expect(load.cb).toBeGreaterThan(0.68);
    expect(load.cb).toBeLessThan(0.74);
    expect(load.tonnes).toBeGreaterThan(12000 * 1.016 + 10000);
  });

  it("has a liner's small positive GM (0.3–1.5 m) and floats on an even keel", () => {
    const now = upright(carpathia.draught);
    const gm = now.km - carpathia.kg;
    expect(gm).toBeGreaterThan(0.3);
    expect(gm).toBeLessThan(1.5);
    expect(Math.abs(now.lcb - carpathia.lcg)).toBeLessThan(0.2);
  });

  it("has one working funnel", () => {
    expect(carpathia.funnels).toHaveLength(1);
    const [f] = carpathia.funnels;
    expect(f.dummy).toBe(false);
    expect(f.topZ).toBeGreaterThan(f.baseZ);
    // The liners' stays rule (no `falls: false`).
    expect(f.falls).toBeUndefined();
  });

  it("has nine compartments end to end and bunkers either side of the boiler room", () => {
    expect(main).toHaveLength(9);
    expect(main.map((c) => c.id)).toEqual([
      "aft-peak",
      "hold5",
      "hold4",
      "engine",
      "boiler",
      "hold3",
      "hold2",
      "hold1",
      "fore-peak",
    ]);
    expect(main[0].fromX).toBeCloseTo(carpathia.stations[0].x, 1);
    expect(main[8].toX).toBeCloseTo(
      carpathia.stations[carpathia.stations.length - 1].x,
      1
    );
    for (let i = 1; i < main.length; i += 1)
      expect(main[i].fromX).toBeCloseTo(main[i - 1].toX, 6);
    const room = main.find((c) => c.id === "boiler")!;
    const wing = (side: "port" | "starboard") =>
      carpathia.compartments.filter(
        (c) =>
          c.span?.side === side &&
          c.fromX === room.fromX &&
          c.toX === room.toX &&
          c.span.y === room.span?.y
      );
    expect(wing("port")).toHaveLength(1);
    expect(wing("starboard")).toHaveLength(1);
    const { id: pid, label: pl, span: ps, ...p } = wing("port")[0];
    const { id: sid, label: sl, span: ss, ...s } = wing("starboard")[0];
    expect(s).toEqual(p);
    expect(ss?.y).toBe(ps?.y);
    expect(pid).not.toBe(sid);
    expect(pl).not.toBe(sl);
  });

  it("takes her torpedoes on the port side, and her real ids are her real morning", () => {
    const torpedo = carpathia.torpedo!;
    expect(torpedo.side).toBe("port");
    expect(torpedo.order).toBe("fwd-first");
    expect(torpedo.staggerS).toBe(CARPATHIA_HIT_T.second);
    expect(torpedo.finisher).toEqual({
      spotId: "hold5",
      t: CARPATHIA_HIT_T.third,
    });
    expect(torpedo.realSpots).toEqual(["boiler", "engine", FINISHER_SPOT]);
    expect(whatIfRealIds(carpathia)).toEqual([...torpedo.realSpots]);
    expect(whatIfOpenings(carpathia, torpedo.realSpots)).toEqual(
      carpathia.realNight
    );
    for (const o of carpathia.realNight) {
      expect(o.side).toBe("port");
      expect(o.zHigh).toBeLessThan(carpathia.draught);
    }
    // Nine spots and the U-boat's return.
    expect(whatIfSpots(carpathia)).toEqual([
      ...main.map((c) => c.id),
      FINISHER_SPOT,
    ]);
    // A 1918 torpedo's hole: about 5–8 m long, 15–25 m², about a U-boat's
    // running depth (3 m) under her waterline.
    const { hole } = torpedo;
    expect(hole.lengthM).toBeGreaterThanOrEqual(5);
    expect(hole.lengthM).toBeLessThanOrEqual(8);
    expect(hole.areaM2).toBeGreaterThanOrEqual(15);
    expect(hole.areaM2).toBeLessThanOrEqual(25);
    expect(carpathia.draught - (hole.zLow + hole.zHigh) / 2).toBeCloseTo(3, 6);
    // The first at the boiler room's forward bulkhead: No. 3 hold and the
    // port bunker both opened.
    const boiler = main.find((c) => c.id === "boiler")!;
    expect(torpedo.hitX?.boiler).toBe(boiler.toX);
    const first = carpathia.realNight.filter((o) => (o.t ?? 0) === 0);
    expect(first.map((o) => o.compartmentId).sort()).toEqual([
      "boiler-port",
      "hold3",
    ]);
    const second = carpathia.realNight.filter(
      (o) => o.t === CARPATHIA_HIT_T.second
    );
    expect(second.map((o) => o.compartmentId)).toEqual(["engine"]);
    const third = carpathia.realNight.filter(
      (o) => o.t === CARPATHIA_HIT_T.third
    );
    expect(third.map((o) => o.compartmentId)).toEqual(["hold5"]);
  });

  it("has no portholes to open (a darkened ship in convoy, R10)", () => {
    expect(carpathia.portholes).toBeUndefined();
  });

  it("carries her way from about 10 knots, lost in a couple of minutes", () => {
    expect(carpathia.headway).toEqual({
      startMs: 10 * 0.514444,
      halfLifeS: 60,
    });
  });

  it("rests listed a little to port", () => {
    expect(carpathia.wreck!.restDeg).toBeLessThan(0);
    expect(carpathia.wreck!.restDeg).toBeGreaterThanOrEqual(-15);
  });

  it("names her decks, superstructure, wells, masts and boats", () => {
    const names = CARPATHIA_DECKS.map((d) => d.name);
    for (const n of [
      "Boat",
      "Bridge",
      "Forecastle",
      "Upper",
      "Main",
      "Lower",
      "Fourth",
      "Orlop",
      "Tank top",
    ])
      expect(names).toContain(n);
    const z = (n: string) => CARPATHIA_DECKS.find((d) => d.name === n)!.z;
    expect(z("Upper")).toBe(carpathia.depth);
    expect(z("Main")).toBeCloseTo(41 * FT, 1); // her 41 ft moulded depth
    expect(carpathia.decks).toBe(CARPATHIA_DECKS);
    // The boxes, aft to forward, do not overlap.
    const ss = carpathia.superstructure;
    for (let i = 1; i < ss.length; i += 1)
      expect(ss[i].fromX).toBeGreaterThanOrEqual(ss[i - 1].toX - 1e-9);
    expect(names).not.toContain("Poop");
    const { forecastle, bridgeDeck, boatDeckHouse, sternHouse } =
      CARPATHIA_SUPERSTRUCTURE;
    expect(ss[forecastle].toX).toBeCloseTo(
      carpathia.stations[carpathia.stations.length - 1].x,
      1
    );
    expect(ss[sternHouse].fromX).toBe(CARPATHIA_STERN_HOUSE.fromX);
    expect(ss[sternHouse].toX).toBe(CARPATHIA_STERN_HOUSE.toX);
    expect(ss[boatDeckHouse].fromX).toBe(CARPATHIA_BRIDGE_DECK.fromX);
    expect(ss[bridgeDeck].toX).toBe(CARPATHIA_BRIDGE_DECK.toX);
    expect(ss[boatDeckHouse].toX).toBe(ss[bridgeDeck].fromX);
    // The bridge deck house is 290 ft long (The Engineer).
    expect(CARPATHIA_BRIDGE_DECK.toX - CARPATHIA_BRIDGE_DECK.fromX).toBeCloseTo(
      290 * FT,
      1
    );
    expect(CARPATHIA_BOAT_DECK.fromX).toBe(CARPATHIA_BRIDGE_DECK.fromX);
    expect(CARPATHIA_BOAT_DECK.toX).toBe(ss[boatDeckHouse].toX);
    // The forward well between the forecastle and the house; the open
    // after deck from the stern to the house.
    expect(CARPATHIA_WELLS.forward.fromX).toBe(CARPATHIA_BRIDGE_DECK.toX);
    expect(CARPATHIA_WELLS.forward.toX).toBe(ss[forecastle].fromX);
    expect(CARPATHIA_AFTER_DECK.fromX).toBeCloseTo(carpathia.stations[0].x, 1);
    expect(CARPATHIA_AFTER_DECK.toX).toBe(CARPATHIA_BRIDGE_DECK.fromX);
    // Four masts, forward to aft: the foremast in the forward well, two on
    // the house, the jigger on the after deck.
    expect(CARPATHIA_MASTS).toHaveLength(4);
    for (let i = 1; i < 4; i += 1)
      expect(CARPATHIA_MASTS[i]).toBeLessThan(CARPATHIA_MASTS[i - 1]);
    const inside = (x: number, r: { fromX: number; toX: number }) =>
      x > r.fromX && x < r.toX;
    expect(inside(CARPATHIA_MASTS[0], CARPATHIA_WELLS.forward)).toBe(true);
    expect(inside(CARPATHIA_MASTS[1], CARPATHIA_BRIDGE_DECK)).toBe(true);
    expect(inside(CARPATHIA_MASTS[2], CARPATHIA_BRIDGE_DECK)).toBe(true);
    expect(inside(CARPATHIA_MASTS[3], CARPATHIA_AFTER_DECK)).toBe(true);
    // The funnel on the boat deck.
    expect(inside(carpathia.funnels[0].x, CARPATHIA_BOAT_DECK)).toBe(true);
    // Twenty boats, ten a side, odd numbers to starboard.
    expect(CARPATHIA_BOATS).toHaveLength(20);
    CARPATHIA_BOATS.forEach((b, i) => expect(b.index).toBe(i));
    expect(CARPATHIA_BOATS.filter((b) => b.side === "port")).toHaveLength(10);
    for (const b of CARPATHIA_BOATS) {
      expect(Number(b.label) % 2 === 1).toBe(b.side === "starboard");
      expect(b.z).toBeGreaterThan(carpathia.depth);
      expect(b.x).toBeGreaterThan(carpathia.stations[0].x);
      expect(b.x).toBeLessThan(
        carpathia.stations[carpathia.stations.length - 1].x
      );
    }
  });

  // Ruling R21 (three photographs: the 1912 starboard view, the Malta view
  // from aft, the 2017 drawing): no raised poop.
  describe("her after deck, bridge and forecastle (R21)", () => {
    const fromStem = (ft: number) =>
      carpathia.stations[carpathia.stations.length - 1].x - ft * FT;
    const ss = carpathia.superstructure;

    it("has no raised poop: abaft the house only the stern deckhouse, inboard of a walkway", () => {
      const aft = ss.filter((b) => b.toX <= CARPATHIA_BRIDGE_DECK.fromX + 1e-9);
      expect(aft).toHaveLength(1);
      const [house] = aft;
      expect(house).toBe(ss[CARPATHIA_SUPERSTRUCTURE.sternHouse]);
      // Not full breadth: the house's own walls, well inside her sides
      // (the model's deck edge leaves a walkway of a metre or more; the
      // sim's finer counter clips the box where it is narrower: README).
      expect(house.halfBreadthM).toBe(CARPATHIA_STERN_HOUSE.halfBreadth);
      expect(house.halfBreadthM as number).toBeLessThanOrEqual(
        carpathia.beam / 2 - 2
      );
      // One tier over the upper deck, not at the stern itself.
      expect(house.fromX).toBeGreaterThan(carpathia.stations[0].x + 3);
      expect(house.topZ - carpathia.sheerZ(house.fromX)).toBeLessThan(3.2);
      // Every other box keeps its full breadth (the 1.0 boxes).
      for (const b of ss)
        if (b !== house) expect(b.halfBreadthM).toBeUndefined();
    });

    it("stands her jigger about 493 ft from the stem, a boat platform just forward of it", () => {
      const jigger = CARPATHIA_MASTS[3];
      expect(Math.abs(jigger - fromStem(493))).toBeLessThanOrEqual(2);
      expect(CARPATHIA_BOAT_PLATFORM.toX).toBeGreaterThan(jigger);
      expect(CARPATHIA_BOAT_PLATFORM.fromX).toBeGreaterThan(jigger + 1);
      expect(CARPATHIA_BOAT_PLATFORM.fromX).toBeLessThan(jigger + 3);
      expect(CARPATHIA_BOAT_PLATFORM.z).toBe(
        CARPATHIA_DECKS.find((d) => d.name === "Bridge")!.z
      );
      // The deckhouse abaft the jigger, the platform clear of No. 5 hatch.
      expect(CARPATHIA_STERN_HOUSE.toX).toBeLessThan(jigger - 3);
      expect(CARPATHIA_BOAT_PLATFORM.toX).toBeLessThan(
        carpathia.torpedo!.hitX!.hold5 - 1.5
      );
    });

    it("puts her bridge house about 217–262 ft from the stem, the forecastle about 42 ft long", () => {
      expect(CARPATHIA_BRIDGE_HOUSE.toX).toBeCloseTo(fromStem(217), 1);
      expect(CARPATHIA_BRIDGE_HOUSE.toX).toBe(CARPATHIA_BOAT_DECK.toX);
      const long =
        (CARPATHIA_BRIDGE_HOUSE.toX - CARPATHIA_BRIDGE_HOUSE.fromX) / FT;
      expect(long).toBeGreaterThanOrEqual(42);
      expect(long).toBeLessThanOrEqual(50);
      // Its front about 17–20 ft abaft the mainmast; a gap before the funnel.
      const abaft = (CARPATHIA_MASTS[1] - CARPATHIA_BRIDGE_HOUSE.toX) / FT;
      expect(abaft).toBeGreaterThan(12);
      expect(abaft).toBeLessThan(25);
      expect(
        CARPATHIA_BRIDGE_HOUSE.fromX - carpathia.funnels[0].x
      ).toBeGreaterThan(6);
      const fc = ss[CARPATHIA_SUPERSTRUCTURE.forecastle];
      expect(Math.abs((fc.toX - fc.fromX) / FT - 42)).toBeLessThanOrEqual(5);
    });

    it("carries a pair of boats on the platform and marks the two the second torpedo wrecked", () => {
      const onPlatform = CARPATHIA_BOATS.filter(
        (b) =>
          b.x > CARPATHIA_BOAT_PLATFORM.fromX &&
          b.x < CARPATHIA_BOAT_PLATFORM.toX
      );
      expect(onPlatform).toHaveLength(2);
      const wrecked = CARPATHIA_BOATS.filter((b) => b.wreckedAtT !== undefined);
      expect(wrecked.map((b) => b.label)).toEqual(["8", "10"]);
      for (const b of wrecked) {
        expect(b.side).toBe("port");
        expect(b.wreckedAtT).toBe(CARPATHIA_HIT_T.second);
        // Abreast the engine room, and never lowered.
        const engine = carpathia.compartments.find((c) => c.id === "engine")!;
        expect(Math.abs(b.x - (engine.fromX + engine.toX) / 2)).toBeLessThan(
          10
        );
        expect(
          carpathia.scripted.some(
            (e) => e.kind === "boat-lowered" && e.index === b.index
          )
        ).toBe(false);
      }
    });
  });

  it("wears dazzle with a grey funnel by default; her 1912 livery keeps her Cunard colours", () => {
    expect(CARPATHIA_LIVERIES.filter((l) => !l.fun).map((l) => l.id)).toEqual([
      "dazzle-1918",
      "cunard-1912",
    ]);
    expect(CARPATHIA_LIVERIES.filter((l) => l.default)).toHaveLength(1);
    expect(CARPATHIA_LIVERIES[0].default).toBe(true);
    expect(carpathia.liveries).toBe(CARPATHIA_LIVERIES);
    expect(CARPATHIA_FUNNEL_PAINT).toEqual(CARPATHIA_FUNNEL_PAINTS.dazzle);
    // Dazzle: a darker battle grey than plain grey (the 1918 photograph's
    // dark funnel).
    const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
    expect(lum(CARPATHIA_FUNNEL_PAINTS.dazzle.funnel)).toBeLessThan(
      lum(CARPATHIA_FUNNEL_PAINTS.grey.funnel) - 60
    );
    // Cunard red: Layton's hue (TRMA, R234 G114 B48), a shade deeper.
    expect(CARPATHIA_FUNNEL_PAINTS.cunard).toEqual({
      funnel: 0xcc5a28,
      top: 0x141416,
    });
    expect(CARPATHIA_LIVERIES[1].funnelPaint).toEqual(
      CARPATHIA_FUNNEL_PAINTS.cunard
    );
    expect(carpathia.funnelPaint).toEqual(CARPATHIA_FUNNEL_PAINT);
  });

  it("scripts the rockets, the steam and the eleven boats, but no wireless", () => {
    const kinds = (k: string) => carpathia.scripted.filter((e) => e.kind === k);
    expect(kinds("radio")).toHaveLength(0);
    const rockets = kinds("rocket");
    expect(rockets.length).toBeGreaterThanOrEqual(3);
    expect(rockets.length).toBeLessThanOrEqual(6);
    for (const r of rockets) expect(r.t).toBeLessThanOrEqual(20 * 60);
    const [on] = kinds("steam-start");
    const [off] = kinds("steam-stop");
    expect(on.t).toBeGreaterThan(CARPATHIA_HIT_T.second);
    expect(on.t).toBeLessThan(CARPATHIA_HIT_T.second + 30);
    expect(off.t).toBeGreaterThan(on.t + 60);
    const boats = kinds("boat-lowered");
    expect(boats).toHaveLength(11);
    expect(new Set(boats.map((b) => b.index)).size).toBe(11);
    // About 9:25 to 9:55 AM.
    for (const b of boats) {
      expect(b.t).toBeGreaterThanOrEqual(9 * 60);
      expect(b.t).toBeLessThanOrEqual(41 * 60);
    }
    const sides = boats.map((b) => CARPATHIA_BOATS[b.index as number].side);
    expect(sides).toContain("port");
    expect(sides).toContain("starboard");
    // The first boat away is not a port boat by the hits.
    const first = CARPATHIA_BOATS[boats[0].index as number];
    expect(first.side === "port" && Math.abs(first.x) < 30).toBe(false);
    for (let i = 1; i < carpathia.scripted.length; i += 1)
      expect(carpathia.scripted[i].t).toBeGreaterThanOrEqual(
        carpathia.scripted[i - 1].t
      );
  });
});
