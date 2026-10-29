import { KIT_NAMES } from "@/components/ship-builder/scene/kitFiles";
import { kitStandIn } from "../kitStandIns";

describe("kitStandIn", () => {
  it.each(KIT_NAMES)("builds the stand-in for %s", (name) => {
    const geometry = kitStandIn(name);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.isEmpty()).toBe(false);
  });
});
