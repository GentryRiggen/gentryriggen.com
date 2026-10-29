import { DoubleSide, FrontSide } from "three";
import { FINISHES, surfaceLook, surfaceMaterial } from "../Surface";

const BASE = {
  color: "#112233",
  finish: "paint",
  emphasis: null,
  opacity: 1,
  doubleSided: false,
} as const;

describe("surfaceMaterial", () => {
  it("shares one material between identical looks", () => {
    expect(surfaceMaterial(BASE)).toBe(surfaceMaterial({ ...BASE }));
  });

  it.each([
    ["colour", { color: "#445566" }],
    ["finish", { finish: "metal" }],
    ["emphasis", { emphasis: "hover" }],
    ["opacity", { opacity: 0.55 }],
    ["sidedness", { doubleSided: true }],
    ["vertex colours", { vertexColors: true }],
  ] as const)("gives a different look its own material (%s)", (_, change) => {
    expect(surfaceMaterial({ ...BASE, ...change })).not.toBe(
      surfaceMaterial(BASE)
    );
  });

  it("builds the material from the finish, emphasis and opacity", () => {
    const ghost = surfaceMaterial({ ...BASE, opacity: 0.55 });
    expect(ghost.transparent).toBe(true);
    expect(ghost.opacity).toBe(0.55);

    const solid = surfaceMaterial(BASE);
    expect(solid.transparent).toBe(false);
    expect(solid.side).toBe(FrontSide);
    expect(solid.roughness).toBe(FINISHES.paint.roughness);
    expect(solid.emissiveIntensity).toBe(0);

    const metal = surfaceMaterial({ ...BASE, finish: "metal" });
    expect(metal.metalness).toBe(FINISHES.metal.metalness);

    const hovered = surfaceMaterial({ ...BASE, emphasis: "hover" });
    expect(hovered.emissiveIntensity).toBe(0.4);

    expect(surfaceMaterial({ ...BASE, doubleSided: true }).side).toBe(
      DoubleSide
    );

    expect(solid.vertexColors).toBe(false);
    expect(surfaceMaterial({ ...BASE, vertexColors: true }).vertexColors).toBe(
      true
    );
  });
});

describe("surfaceLook", () => {
  const props = { color: "#112233", emphasis: null, vertexColors: true };

  it("keeps baked vertex shading on painted and highlighted parts", () => {
    expect(surfaceLook({ ...props, tint: null }).vertexColors).toBe(true);
    expect(
      surfaceLook({ ...props, tint: null, emphasis: "hover" }).vertexColors
    ).toBe(true);
  });

  it.each(["ghost-ok", "ghost-bad", "removal"] as const)(
    "draws the %s tint flat",
    (tint) => {
      const look = surfaceLook({ ...props, tint });
      expect(look.vertexColors).toBe(false);
      expect(look.color).not.toBe(props.color);
    }
  );

  it("is flat unless asked", () => {
    expect(
      surfaceLook({ color: "#112233", tint: null, emphasis: null }).vertexColors
    ).toBe(false);
  });
});
