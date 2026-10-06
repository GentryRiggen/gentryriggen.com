import { computeStats } from "../../model/stats";
import { validateShip } from "../../model/placement";
import { MAX_PARTS } from "../../persist/schema";
import { buildShareUrl } from "../../persist/share";
import { TEMPLATES } from "..";

const count = (id: string, type: string) =>
  TEMPLATES.pirate
    .find((t) => t.id === id)!
    .build()
    .parts.filter((p) => p.type === type).length;

describe("pirate templates", () => {
  it("offers the four ships in order", () => {
    expect(TEMPLATES.pirate.map((t) => t.id)).toEqual([
      "small-sloop",
      "whydah-gally",
      "queen-annes-revenge",
      "black-pearl-galleon",
    ]);
  });

  it("dates the ships and keeps the blurbs short", () => {
    expect(TEMPLATES.pirate.map((t) => t.year)).toEqual([
      1700, 1717, 1718, 1720,
    ]);
    for (const template of TEMPLATES.pirate) {
      expect(template.blurb.length).toBeLessThan(80);
    }
    expect(TEMPLATES.pirate[3].blurb).toMatch(/made-up/);
  });

  it.each(TEMPLATES.pirate.map((t) => [t.id, t] as const))(
    "%s is valid, sails and has no warnings",
    (_id, template) => {
      const ship = template.build();
      expect(ship.kind).toBe("pirate");
      const result = validateShip(ship);
      expect(result).toEqual(expect.objectContaining({ ok: true }));
      expect(ship.parts.length).toBeLessThanOrEqual(MAX_PARTS);
      expect(new Set(ship.parts.map((p) => p.id)).size).toBe(ship.parts.length);
      const stats = computeStats(ship);
      expect(stats.warnings).toEqual([]);
      expect(stats.topSpeedKnots).toBeGreaterThanOrEqual(6);
      expect(stats.topSpeedKnots).toBeLessThanOrEqual(14);
      expect(buildShareUrl(ship, "https://example.com")).not.toBeNull();
    }
  );

  it("sizes the hulls and arms them as planned", () => {
    const hull = (id: string) =>
      TEMPLATES.pirate.find((t) => t.id === id)!.build().hull;
    expect(hull("small-sloop")).toMatchObject({ lengthSegments: 6, beam: 3 });
    expect(hull("whydah-gally")).toMatchObject({ lengthSegments: 10, beam: 4 });
    expect(hull("queen-annes-revenge")).toMatchObject({
      lengthSegments: 12,
      beam: 5,
    });
    expect(hull("black-pearl-galleon")).toMatchObject({
      lengthSegments: 14,
      beam: 5,
    });
    expect(
      count("small-sloop", "cannon-deck") +
        count("small-sloop", "cannon-chaser")
    ).toBe(4);
    expect(count("whydah-gally", "cannon-deck")).toBeGreaterThanOrEqual(20);
    expect(count("queen-annes-revenge", "cannon-deck")).toBeGreaterThanOrEqual(
      30
    );
    expect(count("black-pearl-galleon", "cannon-deck")).toBeGreaterThanOrEqual(
      28
    );
  });

  it("gives the big ships three masts and black sails on the galleon", () => {
    for (const id of ["queen-annes-revenge", "black-pearl-galleon"]) {
      const masts = [
        "mast-wood-short",
        "mast-wood-tall",
        "mast-wood-main",
      ].reduce((sum, type) => sum + count(id, type), 0);
      expect(masts).toBe(3);
    }
    const galleon = TEMPLATES.pirate
      .find((t) => t.id === "black-pearl-galleon")!
      .build();
    const sails = galleon.parts.filter((p) => p.type.startsWith("sail-square"));
    expect(sails.length).toBeGreaterThan(0);
    expect(sails.every((p) => p.color === "black")).toBe(true);
  });

  it("gives the sloop one tall mast and a bow mast", () => {
    expect(count("small-sloop", "mast-wood-tall")).toBe(1);
    expect(count("small-sloop", "mast-wood-short")).toBe(1);
  });
});
