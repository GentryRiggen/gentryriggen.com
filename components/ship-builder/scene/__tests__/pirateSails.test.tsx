import { render } from "@testing-library/react";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { SAIL_MESHES } from "../pirate/sails";

jest.mock("@react-three/fiber", () => ({ useFrame: () => undefined }));

const TYPES = Object.keys(SAIL_MESHES) as (keyof typeof SAIL_MESHES)[];

describe("pirate sail meshes", () => {
  it("gives every one of the nine parts its own mesh", () => {
    expect(TYPES).toHaveLength(9);
    expect(new Set(TYPES.map((type) => SAIL_MESHES[type])).size).toBe(9);
  });

  it.each(TYPES)("renders %s, real and ghost, without throwing", (type) => {
    const Mesh = SAIL_MESHES[type];
    // Three.js tags are not DOM elements, so React warns about them here.
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Mesh tint={null} emphasis={null} />)).not.toThrow();
    expect(() =>
      render(<Mesh tint="ghost-ok" emphasis={null} painted="#111111" />)
    ).not.toThrow();
    errors.mockRestore();
  });

  it("draws masts at the catalog height", () => {
    expect(getPartDef("mast-wood-short")).toMatchObject({ height: 5 });
    expect(getPartDef("mast-wood-tall")).toMatchObject({ height: 7 });
    expect(getPartDef("mast-wood-main")).toMatchObject({ height: 9 });
  });
});
