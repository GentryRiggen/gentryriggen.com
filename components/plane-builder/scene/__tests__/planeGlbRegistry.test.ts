import { existsSync } from "node:fs";
import { join } from "node:path";
import { PLANE_MODEL_URLS, PLANE_UNITS } from "../planeGlbRegistry";
import { FALLBACK_UNITS } from "../planeUnits";
import { planeParts } from "../planeParts";
import { fuselageUnit, finUnit, wingUnit } from "../planeUnits";
import { LEVEL_ORDER } from "@/lib/plane-builder/levels";
import { STARTER_TIERS } from "@/lib/plane-builder/plane/catalog";
import { PART_SPEC_LIST } from "@/assets/parts";

const ROOT = join(__dirname, "..", "..", "..", "..");

describe("plane glb registry", () => {
  it("has a procedural fallback for every unit, and no extras", () => {
    expect(Object.keys(PLANE_UNITS).sort()).toEqual([...FALLBACK_UNITS].sort());
  });

  it("has a committed glb for every unit", () => {
    for (const url of PLANE_MODEL_URLS) {
      expect(existsSync(join(ROOT, "public", url))).toBe(true);
    }
  });

  it("has a spec variant for every unit", () => {
    const list = PART_SPEC_LIST as {
      id: string;
      game?: string;
      variants: { name: string }[];
    }[];
    for (const unit of Object.values(PLANE_UNITS)) {
      const spec = list.find((s) => s.id === unit.model);
      expect(spec?.game).toBe("plane");
      expect(spec?.variants.map((v) => v.name)).toContain(unit.unit);
    }
  });

  it.each(LEVEL_ORDER)("%s picks units that exist", (level) => {
    const parts = planeParts(level, STARTER_TIERS);
    for (const unit of [fuselageUnit(parts), wingUnit(parts), finUnit(parts)]) {
      expect(PLANE_UNITS[unit]).toBeDefined();
    }
  });
});
