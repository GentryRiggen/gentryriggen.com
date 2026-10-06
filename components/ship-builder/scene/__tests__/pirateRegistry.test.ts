import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { PIRATE_PART_TYPES } from "@/lib/ship-builder/model/types";
import { PIRATE_ICONS } from "../../ui/icons/pirateIcons";
import { isPirateDecor, isPirateFitting } from "../pirate/registry";

describe("pirate mesh registry", () => {
  it("draws every pirate part exactly one way", () => {
    for (const type of PIRATE_PART_TYPES) {
      const def = getPartDef(type);
      const drawnBy = [
        isPirateFitting(type),
        isPirateDecor(type),
        def.placement === "grid" && def.role !== "decor",
      ].filter(Boolean);
      expect(drawnBy).toHaveLength(1);
      // Decor parts go through the decor registry; attach parts through
      // fittings.
      expect(isPirateDecor(type)).toBe(
        def.placement === "grid" && def.role === "decor"
      );
      expect(isPirateFitting(type)).toBe(def.placement === "attach");
    }
  });

  it("has an icon for every pirate part", () => {
    for (const type of PIRATE_PART_TYPES) {
      expect(PIRATE_ICONS[type]()).not.toBeNull();
    }
  });
});
