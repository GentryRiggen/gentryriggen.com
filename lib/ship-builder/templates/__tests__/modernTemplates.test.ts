import { computeStats } from "../../model/stats";
import { MAX_PARTS } from "../../persist/schema";
import { buildShareUrl } from "../../persist/share";
import { TEMPLATES } from "..";

const MODERN = [...TEMPLATES.cruise, ...TEMPLATES.navy, ...TEMPLATES.cargo];

describe("cruise, navy and cargo templates", () => {
  it("offers two of each kind", () => {
    expect(TEMPLATES.cruise).toHaveLength(2);
    expect(TEMPLATES.navy).toHaveLength(2);
    expect(TEMPLATES.cargo).toHaveLength(2);
  });

  it.each(MODERN.map((template) => [template.id, template] as const))(
    "%s stays within the part limit and shares as a link",
    (_id, template) => {
      const ship = template.build();
      expect(ship.parts.length).toBeLessThanOrEqual(MAX_PARTS);
      expect(buildShareUrl(ship, "https://example.com")).not.toBeNull();
    }
  );

  it.each(MODERN.map((template) => [template.id, template] as const))(
    "%s can move and has no warnings about missing essentials",
    (_id, template) => {
      const stats = computeStats(template.build());
      expect(stats.topSpeedKnots).toBeGreaterThan(0);
      expect(stats.warnings).toEqual([]);
    }
  );

  it("loads Ever Given with containers", () => {
    const ever = TEMPLATES.cargo.find((t) => t.id === "ever-given");
    expect(computeStats(ever!.build()).teu).toBeGreaterThan(500);
  });
});
