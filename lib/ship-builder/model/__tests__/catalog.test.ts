import {
  CATALOG,
  CATEGORIES,
  getPartDef,
  partsInCategory,
  visibleParts,
} from "../catalog";
import { SHIP_KINDS } from "../kinds";
import { newId } from "../ids";
import { PART_TYPES, type PartType } from "../types";

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

  it("lists Propulsion, holding the propeller", () => {
    expect(CATEGORIES).toContainEqual({
      id: "propulsion",
      name: "Propulsion",
    });
    expect(partsInCategory("propulsion").map((d) => d.type)).toEqual([
      "propeller",
      "rudder",
      "azipod",
    ]);
  });

  it("gives funnels power and the new parts their stats", () => {
    expect(CATALOG.funnel.power).toBe(1);
    expect(CATALOG["funnel-large"].power).toBe(2);
    expect(CATALOG["funnel-large"].stokers).toBe(75);
    expect(CATALOG["lifeboat-large"].seats).toBe(150);
  });

  it("calls both funnels smokestacks", () => {
    expect(CATALOG.funnel.description).toBe(
      "Smokestack · sits on a deck block · 40 stokers"
    );
    expect(CATALOG["funnel-large"].description).toBe(
      "Big smokestack · sits on a 2×2 of deck blocks · 75 stokers"
    );
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

describe("visibleParts", () => {
  const LINER_ONLY: PartType[] = [
    "funnel",
    "funnel-large",
    "lifeboat-collapsible",
    "lifeboat-large",
  ];
  const types = (kind: Parameters<typeof visibleParts>[0], showAll: boolean) =>
    visibleParts(kind, showAll).map((d) => d.type);

  it("marks only the four liner parts as liner-only", () => {
    const restricted = PART_TYPES.filter((t) =>
      CATALOG[t].kinds?.every((kind) => kind === "liner")
    );
    expect(restricted).toEqual(expect.arrayContaining(LINER_ONLY));
    expect(restricted).toHaveLength(LINER_ONLY.length);
    for (const type of LINER_ONLY)
      expect(CATALOG[type].kinds).toEqual(["liner"]);
  });

  it("lists every part for a liner", () => {
    const listed = PART_TYPES.filter((t) => {
      const kinds = CATALOG[t].kinds;
      return kinds === undefined || kinds.includes("liner");
    });
    expect(types("liner", false)).toEqual(listed);
  });

  it.each(["cruise", "navy", "cargo"] as const)(
    "hides the liner parts for a %s ship",
    (kind) => {
      const listed = types(kind, false);
      for (const type of LINER_ONLY) expect(listed).not.toContain(type);
      expect(listed).toEqual(
        expect.arrayContaining(["deck-1x1", "mast", "propeller", "rudder"])
      );
    }
  );

  it("lists every part for every kind when showAll is set", () => {
    for (const kind of SHIP_KINDS) {
      expect(types(kind, true)).toEqual([...PART_TYPES]);
    }
  });

  it("gives every ship kind an engine, a propeller and lifeboats", () => {
    for (const kind of SHIP_KINDS) {
      const defs = types(kind, false).map((type) => CATALOG[type]);
      expect(defs.some((def) => (def.power ?? 0) > 0)).toBe(true);
      expect(
        defs.some(
          (def) => def.placement === "attach" && def.attachTo === "prop-mount"
        )
      ).toBe(true);
      expect(defs.some((def) => (def.seats ?? 0) > 0)).toBe(true);
    }
  });
});
