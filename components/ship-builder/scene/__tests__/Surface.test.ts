import { DoubleSide, FrontSide } from "three";
import { FINISHES, surfaceMaterial } from "../Surface";

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
  });
});
