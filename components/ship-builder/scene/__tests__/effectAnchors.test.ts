import { HULL_ID } from "@/lib/ship-builder/model/types";
import { attachPart, gridPart, testShip } from "@/lib/ship-builder/testing";
import { collectEffectAnchors } from "../effectAnchors";

describe("collectEffectAnchors", () => {
  it("makes smoke for a modern funnel like a classic funnel", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 4, 1),
      attachPart("f", "funnel-modern", "a", "funnel"),
    ]);
    const anchors = collectEffectAnchors(ship);
    expect(anchors.smallFunnels).toHaveLength(3);
    expect(anchors.largeFunnels).toHaveLength(0);
  });

  it("emits bubbles from an azipod's propeller spot", () => {
    const ship = testShip([attachPart("z", "azipod", HULL_ID, "prop:0")]);
    expect(collectEffectAnchors(ship).propellers).toHaveLength(3);
  });
});
