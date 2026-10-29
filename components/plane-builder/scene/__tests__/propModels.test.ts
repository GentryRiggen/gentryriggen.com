import { existsSync } from "node:fs";
import { join } from "node:path";
import { PART_SPEC_LIST } from "@/assets/parts";
import { FIXED_SLOT_COLORS } from "../obstacleModels";
import { PROP_MODELS, PROP_MODEL_URLS, propUrl } from "../propModels";

const ROOT = join(__dirname, "..", "..", "..", "..");

interface Spec {
  id: string;
  game?: string;
  slots: string[];
  variants: { name: string }[];
}

const specs = PART_SPEC_LIST as Spec[];
const PALETTE_SLOTS = ["soft", "hard", "palette_trim", "palette_ground"];

describe("course prop models", () => {
  it("has a committed glb for every prop", () => {
    for (const url of PROP_MODEL_URLS) {
      expect(existsSync(join(ROOT, "public", url))).toBe(true);
    }
  });

  it.each(Object.entries(PROP_MODELS))(
    "%s names a plane spec and one of its variants",
    (_name, { spec, variant }) => {
      const found = specs.find((s) => s.id === spec);
      expect(found?.game).toBe("plane");
      expect(found?.variants.map((v) => v.name)).toContain(variant);
    }
  );

  it("colours every slot a prop spec uses", () => {
    for (const spec of specs.filter((s) => s.id.startsWith("prop-"))) {
      for (const slot of spec.slots) {
        expect(slot in FIXED_SLOT_COLORS || PALETTE_SLOTS.includes(slot)).toBe(
          true
        );
      }
    }
  });

  it("builds urls under the plane models directory", () => {
    expect(propUrl("coin")).toBe("/plane-builder/models/prop-coin/coin.glb");
  });
});
