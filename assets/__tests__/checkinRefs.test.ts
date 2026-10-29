import * as checkinRefs from "../../scripts/assets/checkinRefs.mjs";

interface Ref {
  file: string;
  view: string | null;
  mask: object | null;
  crop: number[] | null;
}
const pickFamilyRefs = (
  checkinRefs as unknown as {
    pickFamilyRefs: (e: Ref[], view: string, limit?: number) => Ref[];
  }
).pickFamilyRefs;

const ref = (file: string, view: string | null, masked: boolean): Ref => ({
  file,
  view,
  mask: masked ? { mode: "luma" } : null,
  crop: null,
});

describe("pickFamilyRefs", () => {
  it("keeps references that have no mask or no crop", () => {
    const entries = [ref("a.jpg", "side", false), ref("b.jpg", null, false)];
    expect(pickFamilyRefs(entries, "three-quarter").map((r) => r.file)).toEqual(
      ["b.jpg", "a.jpg"]
    );
  });

  it("puts the row's view first, then general, then other views, up to 3", () => {
    const entries = [
      ref("front.jpg", "front", true),
      ref("tq.jpg", "three-quarter", true),
      ref("any.jpg", null, false),
      ref("side.jpg", "side", true),
    ];
    expect(pickFamilyRefs(entries, "three-quarter").map((r) => r.file)).toEqual(
      ["tq.jpg", "any.jpg", "front.jpg"]
    );
  });

  it("is empty for a part with no references", () => {
    expect(pickFamilyRefs([], "side")).toEqual([]);
  });
});
