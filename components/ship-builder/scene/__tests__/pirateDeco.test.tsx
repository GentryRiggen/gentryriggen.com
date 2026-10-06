import { render } from "@testing-library/react";
import { createElement } from "react";
// deco.tsx and deckDecor.tsx import each other through the registry, so enter
// the cycle at the registry, as the app does, not at deco.tsx.
import "../pirate/registry";
import {
  CaptainCabinTrim,
  DECO_DECOR,
  DECO_MESHES,
  HelmWheelMesh,
} from "../pirate/deco";

describe("pirate deco meshes", () => {
  it.each(Object.entries(DECO_MESHES))("draws %s", (_type, Mesh) => {
    expect(() =>
      render(createElement(Mesh, { tint: null, emphasis: null }))
    ).not.toThrow();
  });

  it.each(Object.entries(DECO_DECOR))("draws %s at every rotation", (_t, D) => {
    for (const rotation of [0, 90, 180, 270] as const) {
      expect(() =>
        render(
          createElement(D, {
            color: undefined,
            rotation,
            tint: null,
            emphasis: null,
          })
        )
      ).not.toThrow();
    }
  });

  it("draws the helm wheel and cabin trim", () => {
    expect(() =>
      render(<HelmWheelMesh tint={null} emphasis={null} />)
    ).not.toThrow();
    expect(() =>
      render(
        <CaptainCabinTrim size={{ x: 1, z: 1 }} tint={null} emphasis={null} />
      )
    ).not.toThrow();
  });
});
