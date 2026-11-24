import {
  BRITANNIC_PLACE_IDS,
  CARPATHIA_PLACE_IDS,
  FITZGERALD_PLACE_IDS,
  POSEIDON_PLACES,
} from "@/lib/shipwreck/places";
import { SHIP_IDS, SHIPS } from "@/lib/shipwreck/ships";
import { carpathia } from "@/lib/shipwreck/ships/carpathia";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { poseidon } from "@/lib/shipwreck/ships/poseidon";
import type { BodyPose } from "@/lib/shipwreck/sim/track";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { buildHull } from "@/lib/shipwreck/sim/geometry";
import {
  CARGO_BULK_T_M3,
  boxDepthAt,
  boxExtent,
  boxSamples,
  cargoLayer,
  earthZ,
  partCompartments,
  waterLevel,
} from "@/lib/shipwreck/xray";
import {
  XRAY_SLOTS,
  boxWaterGeometry,
  cargoGeometry,
  doubleBottomLines,
  openingGeometry,
  placeGeometry,
} from "../xrayGeometry";

describe("the X-ray's water slots", () => {
  it("hold every compartment of every ship (the Britannic has 32)", () => {
    for (const id of SHIP_IDS)
      expect(SHIPS[id].compartments.length).toBeLessThanOrEqual(XRAY_SLOTS);
    expect(SHIPS.britannic.compartments.length).toBe(32);
  });
});

describe("the Fitzgerald's X-ray", () => {
  const hull = buildHull(fitzgerald);
  const holds = fitzgerald.compartments.filter((c) => (c.cargoT ?? 0) > 0);

  it("lays each hold's taconite as a level layer over her tank top", () => {
    expect(holds.map((c) => c.id)).toEqual(["hold3", "hold2", "hold1"]);
    for (const c of holds) {
      const layer = cargoLayer(fitzgerald, c)!;
      expect(layer.bottomZ).toBeCloseTo(1.52, 2);
      expect(layer.topZ).toBeGreaterThan(layer.bottomZ + 2);
      expect(layer.topZ).toBeLessThan(fitzgerald.depth);
      // Its volume is the cargo's bulk volume.
      const v =
        (layer.topZ - layer.bottomZ) * (c.toX - c.fromX) * 2 * c.span!.y;
      expect(v * CARGO_BULK_T_M3).toBeCloseTo(c.cargoT!, 3);
    }
    // No cargo, no layer: the tanks, the liners.
    expect(
      cargoLayer(
        fitzgerald,
        fitzgerald.compartments.find((c) => c.id === "tank1-s")!
      )
    ).toBeNull();
    expect(
      titanic.compartments.every((c) => cargoLayer(titanic, c) === null)
    ).toBe(true);
  });

  it("draws the cargo inside each hold, and the double bottom, per part", () => {
    const pieces = partCompartments(fitzgerald, "whole", null);
    const g = cargoGeometry(hull, fitzgerald, pieces)!;
    const pos = g.getAttribute("position");
    expect(pos.count).toBeGreaterThan(100);
    const xMin = Math.min(...holds.map((c) => c.fromX));
    const xMax = Math.max(...holds.map((c) => c.toX));
    for (let i = 0; i < pos.count; i += 1) {
      expect(pos.getX(i)).toBeGreaterThanOrEqual(xMin);
      expect(pos.getX(i)).toBeLessThanOrEqual(xMax);
      // three.y = ship z, three.z = -ship y: inside the hold's span.
      expect(pos.getY(i)).toBeGreaterThanOrEqual(1.5);
      expect(Math.abs(pos.getZ(i))).toBeLessThanOrEqual(7.43);
    }
    // After a break, the bow's part holds only the bow's cargo.
    const bow = cargoGeometry(
      hull,
      fitzgerald,
      partCompartments(fitzgerald, "bow", 17.9)
    )!;
    const bp = bow.getAttribute("position");
    for (let i = 0; i < bp.count; i += 1)
      expect(bp.getX(i)).toBeGreaterThanOrEqual(17.9);
    expect(doubleBottomLines(hull, fitzgerald, -200, 200)).not.toBeNull();
    // The liners have none.
    expect(
      cargoGeometry(
        buildHull(titanic),
        titanic,
        partCompartments(titanic, "whole", null)
      )
    ).toBeNull();
    expect(
      doubleBottomLines(buildHull(titanic), titanic, -200, 200)
    ).toBeNull();
  });

  it("has a blockout at each of her places but the crane (the model draws it)", () => {
    for (const id of FITZGERALD_PLACE_IDS) {
      const { solid, glow } = placeGeometry("fitzgerald", id);
      if (id === "hatch-crane") expect(solid).toBeNull();
      else expect(solid ?? glow).not.toBeNull();
    }
  });
});

describe("the Lusitania's X-ray holes", () => {
  it("each opens at its own time: the first pair at the hit, the second pair 8 s later", () => {
    const g = openingGeometry(buildHull(lusitania), lusitania.realNight);
    const openT = g.getAttribute("aOpenT");
    const times = new Set<number>();
    for (let i = 0; i < openT.count; i += 1) times.add(openT.getX(i));
    expect([...times].sort((a, b) => a - b)).toEqual([0, 8]);
    // Every vertex of a hole shares its opening's time (none open early).
    lusitania.realNight.forEach((o, k) => {
      for (let v = 0; v < 6; v += 1)
        expect(openT.getX(k * 6 + v)).toBe(o.t ?? 0);
    });
  });
});

describe("the Carpathia's X-ray", () => {
  const hull = buildHull(carpathia);

  it("shows her torpedo holes on her port side, each from when it opens", () => {
    const g = openingGeometry(hull, carpathia.realNight);
    const pos = g.getAttribute("position");
    const openT = g.getAttribute("aOpenT");
    expect(pos.count).toBe(carpathia.realNight.length * 6);
    // three.z = -ship y: port (y > 0) is three.z < 0.
    for (let i = 0; i < pos.count; i += 1) expect(pos.getZ(i)).toBeLessThan(0);
    const times = new Set<number>();
    for (let i = 0; i < openT.count; i += 1) times.add(openT.getX(i));
    expect([...times].sort((a, b) => a - b)).toEqual([0, 8, 5700]);
    // The Lusitania's stay on her starboard side, each from its own time.
    const l = openingGeometry(buildHull(lusitania), lusitania.realNight);
    for (let i = 0; i < l.getAttribute("position").count; i += 1) {
      expect(l.getAttribute("position").getZ(i)).toBeGreaterThan(0);
      expect(l.getAttribute("aOpenT").getX(i)).toBe(
        lusitania.realNight[Math.floor(i / 6)].t ?? 0
      );
    }
  });

  it("has a blockout at each of her places", () => {
    for (const id of CARPATHIA_PLACE_IDS) {
      const { solid, glow } = placeGeometry("carpathia", id);
      expect(solid).not.toBeNull();
      expect(solid ?? glow).not.toBeNull();
    }
  });
});

describe("the Britannic's X-ray (1.4)", () => {
  it("has a blockout at each of her six places", () => {
    for (const id of BRITANNIC_PLACE_IDS) {
      const { solid, glow } = placeGeometry("britannic", id);
      expect(solid ?? glow).not.toBeNull();
    }
  });
});

describe("the Poseidon's X-ray: her boxes' water (Task 9)", () => {
  const named = poseidon.superstructure
    .map((b, i) => (b.id ? i : -1))
    .filter((i) => i >= 0);
  const deg = Math.PI / 180;
  const pose = (rollDeg: number, z: number): BodyPose => ({
    part: "whole",
    x: 0,
    y: 0,
    z,
    roll: rollDeg * deg,
    pitch: 0.4 * deg,
    yaw: 0,
  });
  /** A box's lowest and highest earth heights (its eight corners). */
  const span = (i: number, p: BodyPose): [number, number] => {
    const e = boxExtent(poseidon, poseidon.superstructure[i]);
    const hs: number[] = [];
    for (const x of e.x)
      for (const y of e.y) for (const z of e.z) hs.push(earthZ(p, x, y, z));
    return [Math.min(...hs), Math.max(...hs)];
  };

  it("draws every named box (the ballroom as a drum) in the water slots", () => {
    expect(named.length).toBeGreaterThan(5);
    expect(named.length).toBeLessThanOrEqual(XRAY_SLOTS);
    const g = boxWaterGeometry(poseidon, named)!;
    const slots = new Set(
      Array.from(g.getAttribute("aComp").array as Float32Array)
    );
    expect(slots.size).toBe(named.length);
    const pos = g.getAttribute("position").array as Float32Array;
    for (const v of pos) expect(Number.isFinite(v)).toBe(true);
    expect(boxWaterGeometry(poseidon, [])).toBeNull();
    // Inside her boxes: three y is ship z (no water above her top box).
    let topY = -Infinity;
    for (let k = 1; k < pos.length; k += 3) topY = Math.max(topY, pos[k]);
    expect(topY).toBeLessThanOrEqual(
      Math.max(...poseidon.superstructure.map((b) => b.topZ))
    );
  });

  for (const roll of [0, 90, 180])
    it(`keeps each box's water level inside the box at ${roll}°`, () => {
      const p = pose(roll, roll === 180 ? 10 : -8);
      for (const i of named) {
        const s = boxSamples(poseidon, poseidon.superstructure[i]);
        const [lo, hi] = span(i, p);
        for (const fill of [0.1, 0.5, 0.9]) {
          const level = waterLevel(s, p, fill);
          expect(level).toBeGreaterThanOrEqual(lo - 1e-6);
          expect(level).toBeLessThanOrEqual(hi + 1e-6);
        }
        expect(waterLevel(s, p, 0)).toBe(-Infinity);
        expect(waterLevel(s, p, 1)).toBe(Infinity);
      }
    });

  it("reads water at her bridge, ballroom and lobby from their boxes, upside down too", () => {
    for (const id of ["bridge", "ballroom", "lobby"] as const) {
      const place = POSEIDON_PLACES[id];
      const i = poseidon.superstructure.findIndex((b) => b.id === place.boxId);
      expect(i).toBeGreaterThanOrEqual(0);
      const e = boxExtent(poseidon, poseidon.superstructure[i]);
      // The place stands in its box.
      expect(place.at[0]).toBeGreaterThan(e.x[0]);
      expect(place.at[0]).toBeLessThan(e.x[1]);
      expect(place.floorZ).toBeGreaterThanOrEqual(e.z[0] - 0.01);
      expect(place.floorZ).toBeLessThan(e.z[1]);
      for (const roll of [0, 180]) {
        const p = pose(roll, roll === 180 ? 10 : -8);
        const s = boxSamples(poseidon, poseidon.superstructure[i]);
        const top = poseidon.superstructure[i].topZ;
        const at = [place.at[0], place.at[1]] as const;
        expect(boxDepthAt(p, at, place.floorZ, top, -Infinity)).toBe(0);
        const most = boxDepthAt(
          p,
          at,
          place.floorZ,
          top,
          waterLevel(s, p, 0.9)
        );
        const full = boxDepthAt(p, at, place.floorZ, top, Infinity);
        expect(most).toBeGreaterThan(0);
        expect(full).toBeGreaterThanOrEqual(most);
        // Never more than the room is tall there.
        expect(full).toBeCloseTo(top - place.floorZ, 3);
      }
    }
  });

  it("has blockouts for her bridge, ballroom, lobby and engine room", () => {
    for (const id of ["bridge", "ballroom", "lobby", "engine-room"] as const)
      expect(placeGeometry("poseidon", id).solid).not.toBeNull();
  });
});
