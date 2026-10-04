import { computeStats } from "../../model/stats";
import type { PartType } from "../../model/types";
import { findTemplate } from "..";
import { LINER_TEMPLATES } from "../liner";

function partCount(id: string, type: PartType): number {
  const ship = findTemplate(id)!.build();
  return ship.parts.filter((part) => part.type === type).length;
}

describe("liner templates", () => {
  it("offers the five famous liners", () => {
    expect(LINER_TEMPLATES.map((t) => t.id)).toEqual([
      "titanic",
      "olympic",
      "britannic",
      "carpathia",
      "lusitania",
    ]);
  });

  it("gives each a name, year and short blurb", () => {
    for (const template of LINER_TEMPLATES) {
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.year).toBeGreaterThan(1850);
      expect(template.blurb.length).toBeLessThan(80);
    }
  });

  it("uses unique part ids within each ship", () => {
    for (const template of LINER_TEMPLATES) {
      const ids = template.build().parts.map((part) => part.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("gives every ship but Carpathia four funnels", () => {
    for (const id of ["titanic", "olympic", "britannic", "lusitania"]) {
      expect(partCount(id, "funnel-large")).toBe(4);
    }
    expect(partCount("carpathia", "funnel")).toBe(1);
    expect(partCount("carpathia", "mast")).toBe(4);
  });

  it("sizes the hulls as planned", () => {
    const hulls = Object.fromEntries(
      LINER_TEMPLATES.map((t) => [t.id, t.build().hull])
    );
    expect(hulls.titanic).toMatchObject({ lengthSegments: 20, beam: 4 });
    expect(hulls.olympic).toMatchObject({ lengthSegments: 20, beam: 4 });
    expect(hulls.britannic).toMatchObject({ lengthSegments: 20, beam: 5 });
    expect(hulls.carpathia).toMatchObject({ lengthSegments: 12, beam: 3 });
    expect(hulls.lusitania).toMatchObject({ lengthSegments: 18, beam: 5 });
  });

  it("sails every ship", () => {
    for (const template of LINER_TEMPLATES) {
      expect(computeStats(template.build()).topSpeedKnots).toBeGreaterThan(0);
    }
  });

  it("leaves Titanic short of lifeboats, as the real ship was", () => {
    const stats = computeStats(findTemplate("titanic")!.build());
    expect(stats.coverage).toBeGreaterThan(0.4);
    expect(stats.coverage).toBeLessThan(0.6);
    expect(stats.warnings.map((w) => w.code)).toContain("lifeboats");
  });

  it("gives Britannic lifeboats for everyone", () => {
    const stats = computeStats(findTemplate("britannic")!.build());
    expect(stats.coverage).toBeGreaterThanOrEqual(1);
  });
});
