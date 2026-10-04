import { CATALOG, CATEGORIES, getPartDef, partsInCategory } from "../catalog";
import { newId } from "../ids";
import { PART_TYPES } from "../types";

describe("catalog", () => {
  it("has a def for every part type, keyed by its own type", () => {
    for (const type of PART_TYPES) {
      expect(CATALOG[type].type).toBe(type);
      expect(getPartDef(type)).toBe(CATALOG[type]);
    }
  });

  it("puts at least one part in every category", () => {
    for (const category of CATEGORIES) {
      expect(partsInCategory(category.id).length).toBeGreaterThan(0);
    }
  });

  it("lists Propulsion last, holding the propeller", () => {
    expect(CATEGORIES[CATEGORIES.length - 1]).toEqual({
      id: "propulsion",
      name: "Propulsion",
    });
    expect(partsInCategory("propulsion").map((d) => d.type)).toEqual([
      "propeller",
    ]);
  });

  it("gives funnels power and the new parts their stats", () => {
    expect(CATALOG.funnel.power).toBe(1);
    expect(CATALOG["funnel-large"].power).toBe(2);
    expect(CATALOG["funnel-large"].stokers).toBe(75);
    expect(CATALOG["lifeboat-large"].seats).toBe(150);
  });

  it("gives grid parts positive footprints and attach parts a target", () => {
    for (const type of PART_TYPES) {
      const def = CATALOG[type];
      if (def.placement === "grid") {
        expect(def.footprint.x).toBeGreaterThan(0);
        expect(def.footprint.z).toBeGreaterThan(0);
      } else {
        expect(def.attachTo).toBeTruthy();
        expect(def.emptyHint).toBeTruthy();
      }
    }
  });
});

describe("newId", () => {
  it("prefixes ids and does not repeat", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId("p")));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id.startsWith("p-")).toBe(true);
  });
});
