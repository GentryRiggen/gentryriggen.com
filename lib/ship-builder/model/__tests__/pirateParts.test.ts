import { CATALOG, CATEGORIES, getPartDef, visibleParts } from "../catalog";
import { attachPointsOf } from "../attach";
import { canPlace, emptyShip } from "../placement";
import { PIRATE_PART_TYPES, HULL_ID, type PartType } from "../types";
import { attachPart, gridPart } from "../../testing";

const pirate = () => emptyShip("pirate", "P", 8, 4);

describe("pirate catalog", () => {
  it("lists every pirate part for pirate ships only", () => {
    for (const type of PIRATE_PART_TYPES) {
      expect(CATALOG[type].kinds).toEqual(["pirate"]);
    }
    const listed = visibleParts("pirate", false).map((d) => d.type);
    for (const type of PIRATE_PART_TYPES) expect(listed).toContain(type);
    for (const gone of [
      "mast",
      "propeller",
      "bridge",
      "bridge-5",
    ] as PartType[]) {
      expect(listed).not.toContain(gone);
    }
    expect(visibleParts("liner", false).map((d) => d.type)).not.toContain(
      "sail-square"
    );
  });

  it("hides pirate-only gear from the other four kinds", () => {
    for (const kind of ["liner", "cruise", "navy", "cargo"] as const) {
      const listed = visibleParts(kind, false).map((d) => d.type);
      for (const type of PIRATE_PART_TYPES) expect(listed).not.toContain(type);
    }
  });

  it("gives a pirate ship something to steer, sit in and sail with", () => {
    const defs = visibleParts("pirate", false);
    expect(defs.some((def) => (def.sailArea ?? 0) > 0)).toBe(true);
    expect(defs.some((def) => (def.seats ?? 0) > 0)).toBe(true);
    expect(defs.some((def) => def.placement === "attach" && def.steers)).toBe(
      true
    );
  });

  it("has sail and cannon categories with parts", () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["sails", "weapons"]));
  });

  it("gives masts slots and sails an area", () => {
    expect(getPartDef("mast-wood-short")).toMatchObject({ sailSlots: 1 });
    expect(getPartDef("mast-wood-tall")).toMatchObject({ sailSlots: 2 });
    expect(getPartDef("mast-wood-main")).toMatchObject({ sailSlots: 3 });
    expect(getPartDef("sail-square").sailArea).toBe(3);
    expect(getPartDef("cannon-deck").cannons).toBe(1);
  });
});

describe("pirate attach points", () => {
  it("exposes bow spots on the hull", () => {
    const ids = attachPointsOf(pirate(), HULL_ID)
      .filter((p) => p.type === "bow-mount")
      .map((p) => p.id);
    expect(ids.sort()).toEqual(["bowgun", "figurehead", "jib"]);
  });

  it("exposes one sail spot per slot plus a masthead", () => {
    const ship = {
      ...pirate(),
      parts: [attachPart("m", "mast-wood-tall", HULL_ID, "mast-fore")],
    };
    const ids = attachPointsOf(ship, "m").map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(["sail:0", "sail:1", "masthead"])
    );
    expect(ids).not.toContain("sail:2");
  });

  it.each([
    ["mast-wood-short", 5],
    ["mast-wood-tall", 7],
    ["mast-wood-main", 9],
  ] as const)(
    "keeps stacked sails on %s clear of the deck, each other and the nest",
    (mast, height) => {
      const ship = {
        ...pirate(),
        parts: [attachPart("m", mast, HULL_ID, "mast-fore")],
      };
      const points = attachPointsOf(ship, "m");
      const base = points.find((p) => p.id === "masthead")!.position.y - height;
      const tallestSail = getPartDef("sail-square-large").height;
      const ys = points
        .filter((p) => p.type === "sail-mount")
        .map((p) => p.position.y - base)
        .sort((a, b) => a - b);
      expect(ys[0]).toBeGreaterThanOrEqual(tallestSail);
      for (let i = 1; i < ys.length; i++) {
        expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(tallestSail);
      }
      const nest = points.find((p) => p.id === "nest")!.position.y - base;
      expect(nest).toBeGreaterThan(ys[ys.length - 1]);
      expect(nest).toBeLessThan(height);
    }
  );

  it("lets a sail go on a free spot only", () => {
    const base = {
      ...pirate(),
      parts: [attachPart("m", "mast-wood-short", HULL_ID, "mast-fore")],
    };
    const sail = attachPart("s", "sail-square", "m", "sail:0");
    expect(canPlace(base, sail).ok).toBe(true);
    const full = { ...base, parts: [...base.parts, sail] };
    expect(
      canPlace(full, attachPart("s2", "sail-square-small", "m", "sail:0")).ok
    ).toBe(false);
    expect(
      canPlace(base, attachPart("s3", "sail-square", "m", "sail:1")).ok
    ).toBe(false);
  });

  it("keeps the jib on the jib spot and the lateen on the lowest spot", () => {
    const ship = pirate();
    expect(canPlace(ship, attachPart("j", "sail-jib", HULL_ID, "jib")).ok).toBe(
      true
    );
    expect(
      canPlace(ship, attachPart("j", "sail-jib", HULL_ID, "bowgun")).ok
    ).toBe(false);
    const masted = {
      ...ship,
      parts: [attachPart("m", "mast-wood-tall", HULL_ID, "mast-fore")],
    };
    expect(
      canPlace(masted, attachPart("l", "sail-lateen", "m", "sail:0")).ok
    ).toBe(true);
    expect(
      canPlace(masted, attachPart("l", "sail-lateen", "m", "sail:1")).ok
    ).toBe(false);
  });

  it("lets the helm go in the aft half", () => {
    const ship = {
      ...pirate(),
      parts: [
        gridPart("d1", "deck-1x1", 0, 20, 0),
        gridPart("d2", "deck-1x1", 0, 20, 1),
      ],
    };
    expect(canPlace(ship, gridPart("h", "helm-wheel", 1, 20, 0)).ok).toBe(true);
  });
});
