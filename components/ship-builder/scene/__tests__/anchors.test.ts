import { isTap, sameAnchor, TAP_SLOP_PX, TOUCH_TAP_SLOP_PX } from "../anchors";
import type { Anchor } from "@/lib/ship-builder/model/types";

const grid: Anchor = { kind: "grid", level: 1, x: 3, z: 2 };
const attach: Anchor = { kind: "attach", parentId: "p1", pointId: "top" };

describe("sameAnchor", () => {
  it("matches grid anchors field by field", () => {
    expect(sameAnchor(grid, { kind: "grid", level: 1, x: 3, z: 2 })).toBe(true);
    expect(sameAnchor(grid, { kind: "grid", level: 2, x: 3, z: 2 })).toBe(
      false
    );
    expect(sameAnchor(grid, { kind: "grid", level: 1, x: 4, z: 2 })).toBe(
      false
    );
    expect(sameAnchor(grid, { kind: "grid", level: 1, x: 3, z: 1 })).toBe(
      false
    );
  });

  it("matches attach anchors by parent and point", () => {
    expect(
      sameAnchor(attach, { kind: "attach", parentId: "p1", pointId: "top" })
    ).toBe(true);
    expect(
      sameAnchor(attach, { kind: "attach", parentId: "p2", pointId: "top" })
    ).toBe(false);
    expect(
      sameAnchor(attach, { kind: "attach", parentId: "p1", pointId: "bow" })
    ).toBe(false);
  });

  it("never matches across kinds or against nothing", () => {
    expect(sameAnchor(grid, attach)).toBe(false);
    expect(sameAnchor(grid, null)).toBe(false);
    expect(sameAnchor(undefined, attach)).toBe(false);
  });
});

describe("isTap", () => {
  it("allows a few pixels of mouse movement but not a drag", () => {
    expect(isTap({ delta: TAP_SLOP_PX })).toBe(true);
    expect(isTap({ delta: TAP_SLOP_PX + 1 })).toBe(false);
    expect(isTap({ delta: 6, pointerType: "mouse" })).toBe(false);
  });

  it("is more forgiving for touch", () => {
    expect(isTap({ delta: TOUCH_TAP_SLOP_PX, pointerType: "touch" })).toBe(
      true
    );
    expect(isTap({ delta: TOUCH_TAP_SLOP_PX + 1, pointerType: "touch" })).toBe(
      false
    );
  });

  it("reads the pointer type from the native event", () => {
    expect(isTap({ delta: 8, nativeEvent: { pointerType: "touch" } })).toBe(
      true
    );
    expect(isTap({ delta: 8, nativeEvent: { pointerType: "mouse" } })).toBe(
      false
    );
    expect(isTap({ delta: 8, nativeEvent: {} })).toBe(false);
  });
});
