import { sameAnchor } from "../anchors";
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
