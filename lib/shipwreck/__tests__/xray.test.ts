import {
  CARPATHIA_PLACE_IDS,
  FITZGERALD_PLACE_IDS,
  LUSITANIA_PLACE_IDS,
  PLACE_IDS,
  PLACES,
  PLACES_BY_SHIP,
  placeFor,
  waterHereText,
} from "../places";
import { CARPATHIA_BOATS, carpathia } from "../ships/carpathia";
import { fitzgerald } from "../ships/fitzgerald";
import { lusitania } from "../ships/lusitania";
import { titanic } from "../ships/titanic";
import { buildHull, hullHalfBreadth } from "../sim/geometry";
import type { BodyPose } from "../sim/track";
import {
  compartmentSamples,
  depthOver,
  earthZ,
  partAt,
  partCompartments,
  spanRange,
  waterLevel,
} from "../xray";

const hull = buildHull(titanic);
const level = (p: Partial<BodyPose> = {}): BodyPose => ({
  part: "whole",
  x: 0,
  y: 0,
  z: -10,
  pitch: 0,
  roll: 0,
  yaw: 0,
  ...p,
});
const br6 = titanic.compartments.find((c) => c.id === "br6")!;

describe("waterLevel", () => {
  const s = compartmentSamples(hull, br6);

  it("is dry at 0 and full at 1", () => {
    expect(waterLevel(s, level(), 0)).toBe(-Infinity);
    expect(waterLevel(s, level(), 1)).toBe(Infinity);
  });

  it("rises with the fill, from the keel to the bulkhead tops", () => {
    const keel = -10;
    const top = -10 + Math.min(br6.aftBulkheadTopZ, br6.fwdBulkheadTopZ);
    let last = -Infinity;
    for (const f of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      const l = waterLevel(s, level(), f);
      expect(l).toBeGreaterThan(last);
      expect(l).toBeGreaterThan(keel);
      expect(l).toBeLessThan(top + 1);
      last = l;
    }
  });

  it("stays level with the earth when she trims (same volume, same level)", () => {
    // A level ship sunk deeper by Δ: the level moves by Δ.
    const a = waterLevel(s, level({ z: -10 }), 0.4);
    const b = waterLevel(s, level({ z: -14 }), 0.4);
    expect(a - b).toBeCloseTo(4, 1);
    // Trimmed: the level is still a single earth height between the
    // compartment's lowest and highest points.
    const pose = level({ pitch: 0.2 });
    const l = waterLevel(s, pose, 0.5);
    const lo = earthZ(pose, br6.toX, 0, 0);
    const hi = earthZ(pose, br6.fromX, 0, 15);
    expect(l).toBeGreaterThan(lo);
    expect(l).toBeLessThan(hi);
  });

  it("a half-full box-ish compartment stands about half way up", () => {
    const l = waterLevel(s, level({ z: 0 }), 0.5);
    expect(l).toBeGreaterThan(5);
    expect(l).toBeLessThan(10);
  });
});

describe("depthOver", () => {
  it("measures water over a floor point", () => {
    expect(depthOver(level({ z: 0 }), [60, 0, 1.6], 4.1)).toBeCloseTo(2.5);
    expect(depthOver(level({ z: 0 }), [60, 0, 1.6], 1)).toBe(0);
    expect(depthOver(level(), [60, 0, 1.6], -Infinity)).toBe(0);
  });
});

describe("parts", () => {
  it("splits compartments at the break", () => {
    const bow = partCompartments(titanic, "bow", -27.1);
    const stern = partCompartments(titanic, "stern", -27.1);
    const whole = partCompartments(titanic, "whole", null);
    expect(whole).toHaveLength(16);
    expect(bow.length + stern.length).toBe(16);
    expect(bow.every((p) => p.fromX >= -27.1)).toBe(true);
    expect(stern.every((p) => p.toX <= -27.1)).toBe(true);
    // A break inside a compartment gives a piece to each half.
    const b2 = partCompartments(titanic, "bow", -40);
    const s2 = partCompartments(titanic, "stern", -40);
    expect(b2.length + s2.length).toBe(17);
  });

  it("partAt picks the half by x", () => {
    expect(partAt(-27.1, true, 60)).toBe("bow");
    expect(partAt(-27.1, true, -60)).toBe("stern");
    expect(partAt(-27.1, false, -60)).toBe("whole");
    expect(partAt(null, true, 0)).toBe("whole");
  });
});

describe("places", () => {
  it("each place sits in its compartment and inside the ship", () => {
    for (const id of PLACE_IDS) {
      const p = PLACES[id];
      expect(p.id).toBe(id);
      expect(p.fact.length).toBeGreaterThan(30);
      expect(p.at[0]).toBeGreaterThan(-138);
      expect(p.at[0]).toBeLessThan(130);
      expect(p.floorZ).toBeLessThanOrEqual(p.at[2]);
      if (p.compartmentId) {
        const c = titanic.compartments.find((k) => k.id === p.compartmentId);
        expect(c).toBeDefined();
        expect(p.at[0]).toBeGreaterThanOrEqual(c!.fromX);
        expect(p.at[0]).toBeLessThanOrEqual(c!.toX);
      }
    }
  });

  it("matches the plans: the bridge forward of the staircase, boiler room 6 between E and F, the engines aft", () => {
    expect(PLACES.bridge.at[0]).toBeGreaterThan(
      PLACES["grand-staircase"].at[0]
    );
    expect(PLACES["engine-room"].at[0]).toBeLessThan(0);
    expect(PLACES.bridge.floorZ).toBeGreaterThan(27);
  });

  it("says the water depth plainly", () => {
    expect(waterHereText(0)).toBe("Dry here");
    expect(waterHereText(2.13)).toBe("Water here: 2.1 m deep");
    expect(waterHereText(14.6)).toBe("Water here: 15 m deep");
  });
});

describe("the Lusitania's places", () => {
  const lHull = buildHull(lusitania);
  const places = PLACES_BY_SHIP.lusitania;
  const comp = (id: string | null) =>
    lusitania.compartments.find((c) => c.id === id);

  it("are her bridge, dining saloon, the torpedo's boiler room, a starboard bunker and the turbines", () => {
    expect(places.map((p) => p.id)).toEqual([...LUSITANIA_PLACE_IDS]);
    expect(placeFor("lusitania", "boiler-room-1")?.compartmentId).toBe("br1");
    expect(placeFor("lusitania", "turbine-room")?.compartmentId).toBe(
      "turbine"
    );
    // The torpedo hit there: her real damage opens that boiler room.
    expect(lusitania.realNight.map((o) => o.compartmentId)).toContain("br1");
    expect(
      comp(placeFor("lusitania", "starboard-bunker")!.compartmentId)?.span?.side
    ).toBe("starboard");
    expect(placeFor("lusitania", "grand-staircase")).toBeNull();
    expect(placeFor("titanic", "grand-staircase")).toBe(
      PLACES["grand-staircase"]
    );
  });

  it("each sits inside her hull, in a compartment she has", () => {
    for (const p of places) {
      const [x, y, z] = p.at;
      expect(p.fact.length).toBeGreaterThan(30);
      expect(p.interior).toBe(true);
      expect(p.floorZ).toBeLessThanOrEqual(z);
      expect(x).toBeGreaterThan(lHull.xMin);
      expect(x).toBeLessThan(lHull.xMax);
      if (p.compartmentId) {
        const c = comp(p.compartmentId);
        expect(c).toBeDefined();
        expect(x).toBeGreaterThanOrEqual(c!.fromX);
        expect(x).toBeLessThanOrEqual(c!.toX);
        // Below the deck edge, inside the shell and her share of it.
        expect(z).toBeLessThan(lusitania.sheerZ(x));
        const [lo, hi] = spanRange(c!, hullHalfBreadth(lHull, x, z));
        expect(y).toBeGreaterThan(lo);
        expect(y).toBeLessThan(hi);
      } else {
        // Over the decks (the bridge, the saloon): within her breadth.
        expect(Math.abs(y)).toBeLessThan(lusitania.beam / 2);
      }
    }
  });

  it("the Titanic's are 1.0's", () => {
    expect(PLACES_BY_SHIP.titanic.map((p) => p.id)).toEqual([...PLACE_IDS]);
  });
});

describe("side bunkers in the X-ray", () => {
  const lHull = buildHull(lusitania);
  const stbd = lusitania.compartments.find((c) => c.id === "br2-stbd")!;
  const centre = lusitania.compartments.find((c) => c.id === "br2")!;

  it("samples only the bunker's wing, and the room between the walls", () => {
    const s = compartmentSamples(lHull, stbd);
    const c = compartmentSamples(lHull, centre);
    for (let i = 0; i < s.weights.length; i += 1) {
      if (s.weights[i] > 0) expect(s.points[i * 3 + 1]).toBeLessThan(-9.4);
      expect(Math.abs(c.points[i * 3 + 1])).toBeLessThan(9.6);
    }
    // The wing is a narrow share of the section.
    expect(s.total).toBeGreaterThan(0);
    expect(s.total).toBeLessThan(c.total / 2);
  });

  it("the water in a listed bunker stands level with the sea", () => {
    const s = compartmentSamples(lHull, stbd);
    const pose = level({ z: -9, roll: (15 * Math.PI) / 180 });
    const a = waterLevel(s, pose, 0.3);
    const b = waterLevel(s, pose, 0.7);
    expect(b).toBeGreaterThan(a);
    expect(Number.isFinite(a)).toBe(true);
  });

  it("splits a section by the bulkheads, or not at all", () => {
    expect(spanRange({}, 12)).toEqual([-12, 12]);
    expect(spanRange(centre, 12)).toEqual([-9.5, 9.5]);
    expect(spanRange(stbd, 12)).toEqual([-12, -9.5]);
    // Narrower than the bulkhead is out: no wing there.
    expect(spanRange(stbd, 8)).toEqual([-8, -8]);
  });
});

describe("the Fitzgerald's places", () => {
  const fHull = buildHull(fitzgerald);
  const places = PLACES_BY_SHIP.fitzgerald;
  const comp = (id: string | null) =>
    fitzgerald.compartments.find((c) => c.id === id);

  it("are her pilothouse, bell, a cargo hold, a ballast tank, the engine room and the hatch crane", () => {
    expect(places.map((p) => p.id)).toEqual([...FITZGERALD_PLACE_IDS]);
    expect(placeFor("fitzgerald", "cargo-hold-1")?.compartmentId).toBe("hold1");
    expect(placeFor("fitzgerald", "engine-room")?.compartmentId).toBe("engine");
    // The tank where her vents broke: starboard, beside No. 1 hold.
    const tank = comp(placeFor("fitzgerald", "ballast-tank")!.compartmentId);
    expect(tank?.span?.side).toBe("starboard");
    expect(
      fitzgerald
        .deckOpenings!.filter((d) => d.kind === "vent")
        .map((d) => d.compartmentId)
    ).toContain(tank!.id);
    expect(placeFor("fitzgerald", "bridge")).toBeNull();
    // The Titanic's engine room is still hers.
    expect(placeFor("titanic", "engine-room")).toBe(PLACES["engine-room"]);
  });

  it("each sits inside her hull or on her decks, in a compartment she has", () => {
    for (const p of places) {
      const [x, y, z] = p.at;
      expect(p.fact.length).toBeGreaterThan(30);
      expect(p.floorZ).toBeLessThanOrEqual(z);
      expect(x).toBeGreaterThan(fHull.xMin);
      expect(x).toBeLessThan(fHull.xMax);
      if (p.compartmentId) {
        const c = comp(p.compartmentId);
        expect(c).toBeDefined();
        expect(p.interior).toBe(true);
        expect(x).toBeGreaterThanOrEqual(c!.fromX);
        expect(x).toBeLessThanOrEqual(c!.toX);
        expect(z).toBeLessThan(fitzgerald.sheerZ(x));
        const [lo, hi] = spanRange(c!, hullHalfBreadth(fHull, x, z));
        expect(y).toBeGreaterThan(lo);
        expect(y).toBeLessThan(hi);
        // Its floor is inside the hull too.
        expect(Math.abs(y)).toBeLessThan(
          hullHalfBreadth(fHull, x, Math.max(p.floorZ, 0.05)) + 1e-6
        );
      } else {
        // On her decks: within her breadth, over her spar deck, under the
        // top of her houses and the crane (a few metres up).
        expect(Math.abs(y)).toBeLessThan(fitzgerald.beam / 2);
        expect(z).toBeGreaterThan(fitzgerald.sheerZ(x));
        expect(z).toBeLessThan(fitzgerald.sheerZ(x) + 12);
      }
    }
  });
});

describe("the Carpathia's places", () => {
  const cHull = buildHull(carpathia);
  const places = PLACES_BY_SHIP.carpathia;
  const comp = (id: string | null) =>
    carpathia.compartments.find((c) => c.id === id);

  it("are her bridge, the torpedoes' rooms, the dining saloon and the wireless room", () => {
    expect(places.map((p) => p.id)).toEqual([...CARPATHIA_PLACE_IDS]);
    expect(placeFor("carpathia", "boiler-room")?.compartmentId).toBe("boiler");
    expect(placeFor("carpathia", "engine-room")?.compartmentId).toBe("engine");
    expect(placeFor("carpathia", "hold-5")?.compartmentId).toBe("hold5");
    // Each torpedo's room is opened by her real run.
    const hit = new Set(carpathia.realNight.map((o) => o.compartmentId));
    for (const id of ["boiler-port", "engine", "hold5"])
      expect(hit).toContain(id);
    // The first torpedo struck at the boiler room's forward end, the last
    // at No. 5 hatch.
    const boiler = comp("boiler")!;
    expect(placeFor("carpathia", "boiler-room")!.at[0]).toBeGreaterThan(
      (boiler.fromX + boiler.toX) / 2
    );
    expect(placeFor("carpathia", "hold-5")!.at[0]).toBe(
      carpathia.torpedo!.hitX!.hold5
    );
    expect(placeFor("carpathia", "grand-staircase")).toBeNull();
  });

  it("each sits inside her hull or her houses, in a compartment she has", () => {
    for (const p of places) {
      const [x, y, z] = p.at;
      expect(p.fact.length).toBeGreaterThan(30);
      expect(p.interior).toBe(true);
      expect(p.floorZ).toBeLessThanOrEqual(z);
      expect(x).toBeGreaterThan(cHull.xMin);
      expect(x).toBeLessThan(cHull.xMax);
      if (p.compartmentId) {
        const c = comp(p.compartmentId);
        expect(c).toBeDefined();
        expect(x).toBeGreaterThanOrEqual(c!.fromX);
        expect(x).toBeLessThanOrEqual(c!.toX);
        expect(z).toBeLessThan(carpathia.sheerZ(x));
        const [lo, hi] = spanRange(c!, hullHalfBreadth(cHull, x, z));
        expect(y).toBeGreaterThan(lo);
        expect(y).toBeLessThan(hi);
      } else {
        // In her houses: within her breadth, over her upper deck, under
        // the navigating bridge's top.
        expect(Math.abs(y)).toBeLessThan(carpathia.beam / 2);
        expect(z).toBeGreaterThan(carpathia.sheerZ(x));
        expect(z).toBeLessThan(carpathia.sheerZ(x) + 12);
      }
    }
  });

  it("keeps clear of boats 1 and 2 on the forward house roof", () => {
    const fwd = CARPATHIA_BOATS.filter(
      (b) => b.label === "1" || b.label === "2"
    );
    expect(fwd).toHaveLength(2);
    for (const p of places)
      for (const b of fwd)
        expect(Math.hypot(p.at[0] - b.x, p.at[2] - b.z)).toBeGreaterThan(5);
  });
});
