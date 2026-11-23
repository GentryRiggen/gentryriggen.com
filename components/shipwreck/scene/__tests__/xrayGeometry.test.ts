import {
  BRITANNIC_PLACE_IDS,
  CARPATHIA_PLACE_IDS,
  FITZGERALD_PLACE_IDS,
} from "@/lib/shipwreck/places";
import { SHIP_IDS, SHIPS } from "@/lib/shipwreck/ships";
import { carpathia } from "@/lib/shipwreck/ships/carpathia";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { buildHull } from "@/lib/shipwreck/sim/geometry";
import {
  CARGO_BULK_T_M3,
  cargoLayer,
  partCompartments,
} from "@/lib/shipwreck/xray";
import {
  XRAY_SLOTS,
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
