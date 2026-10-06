import { render } from "@testing-library/react";
import {
  BufferGeometry,
  Euler,
  PlaneGeometry,
  Vector3,
  type BufferAttribute,
} from "three";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import {
  ShipAnimationContext,
  type ShipAnimationValue,
} from "../ShipAnimationContext";
import { flagRipple, SAIL_MESHES } from "../pirate/sails";

type FrameCallback = (state: { clock: { elapsedTime: number } }) => void;

const mockFrames: { latest: FrameCallback | null } = { latest: null };

jest.mock("@react-three/fiber", () => ({
  useFrame: (callback: FrameCallback) => {
    mockFrames.latest = callback;
  },
}));

const TYPES = Object.keys(SAIL_MESHES) as (keyof typeof SAIL_MESHES)[];

const MOVING: ShipAnimationValue = {
  topSpeedKnots: 0,
  stabilityRatio: 0,
  reducedMotion: false,
  seaState: "calm",
  listAngle: 0,
};

/** r3f elements are unknown tags to the DOM renderer; swallow only those. */
const R3F_TAG_WARNING =
  /is unrecognized in this browser|incorrect casing|React does not recognize/;
let errorSpy: jest.SpyInstance;
beforeEach(() => {
  mockFrames.latest = null;
  const real = console.error.bind(console);
  errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!R3F_TAG_WARNING.test(String(args[0]))) real(...args);
  });
});
afterEach(() => errorSpy.mockRestore());

/** The DOM stands in for the scene; give the element real three.js parts. */
function withThree<T extends object>(element: Element, parts: T): void {
  Object.assign(element, parts);
}

function positionsOf(geometry: BufferGeometry): number[] {
  return Array.from((geometry.attributes.position as BufferAttribute).array);
}

function frame(elapsedTime: number): void {
  if (!mockFrames.latest) throw new Error("no useFrame callback was captured");
  mockFrames.latest({ clock: { elapsedTime } });
}

function drawSail(
  tint: "ghost-ok" | null,
  reducedMotion: boolean,
  width: number,
  height: number
) {
  const Mesh = SAIL_MESHES["sail-square"];
  const { container } = render(
    <ShipAnimationContext.Provider value={{ ...MOVING, reducedMotion }}>
      <Mesh tint={tint} emphasis={null} />
    </ShipAnimationContext.Provider>
  );
  const geometry = new PlaneGeometry(width, height, 8, 6);
  geometry.rotateY(Math.PI / 2);
  geometry.translate(0, -height / 2, 0);
  withThree(container.querySelectorAll("mesh")[1], { geometry });
  return geometry;
}

function drawFlag(tint: "ghost-ok" | null, reducedMotion: boolean) {
  const Mesh = SAIL_MESHES["flag-jolly-roger"];
  const { container } = render(
    <ShipAnimationContext.Provider value={{ ...MOVING, reducedMotion }}>
      <Mesh tint={tint} emphasis={null} />
    </ShipAnimationContext.Provider>
  );
  const geometry = new PlaneGeometry(0.9, 0.55, 8, 2);
  geometry.translate(-0.45, 0.3, 0);
  const skull = { position: new Vector3(-0.36, 0.3, 0), rotation: new Euler() };
  withThree(container.querySelectorAll("mesh")[1], { geometry });
  withThree(container.querySelectorAll("group")[1], skull);
  return { geometry, skull };
}

describe("pirate sail meshes", () => {
  it("gives every one of the nine parts its own mesh", () => {
    expect(TYPES).toHaveLength(9);
    expect(new Set(TYPES.map((type) => SAIL_MESHES[type])).size).toBe(9);
  });

  it.each(TYPES)("renders %s, real and ghost, without throwing", (type) => {
    const Mesh = SAIL_MESHES[type];
    expect(() => render(<Mesh tint={null} emphasis={null} />)).not.toThrow();
    expect(() =>
      render(<Mesh tint="ghost-ok" emphasis={null} painted="#111111" />)
    ).not.toThrow();
  });

  it("draws masts at the catalog height", () => {
    expect(getPartDef("mast-wood-short")).toMatchObject({ height: 5 });
    expect(getPartDef("mast-wood-tall")).toMatchObject({ height: 7 });
    expect(getPartDef("mast-wood-main")).toMatchObject({ height: 9 });
  });
});

describe("square sail billow", () => {
  it("bellies and wobbles the cloth, keeping normals and bounds fresh", () => {
    const geometry = drawSail(null, false, 1.6, 1.6);
    const before = positionsOf(geometry);
    frame(1.2);
    const after = positionsOf(geometry);
    expect(after).not.toEqual(before);
    expect(after.every(Number.isFinite)).toBe(true);
    // The middle of the sail bellies forward (+X); the yard edge stays put.
    expect(Math.max(...after.filter((_, i) => i % 3 === 0))).toBeGreaterThan(
      0.2
    );
    const normals = geometry.attributes.normal as BufferAttribute;
    expect(normals.count).toBe(geometry.attributes.position.count);
    expect(Array.from(normals.array).every(Number.isFinite)).toBe(true);
    expect(geometry.boundingSphere?.radius).toBeGreaterThan(0);
  });

  it("moves between frames", () => {
    const geometry = drawSail(null, false, 1.6, 1.6);
    frame(0.5);
    const first = positionsOf(geometry);
    frame(2.5);
    expect(positionsOf(geometry)).not.toEqual(first);
  });

  it.each([
    ["a ghost", "ghost-ok", false],
    ["reduced motion", null, true],
  ] as const)("leaves the cloth alone for %s", (_name, tint, reduced) => {
    const geometry = drawSail(tint, reduced, 1.6, 1.6);
    const before = positionsOf(geometry);
    frame(1.2);
    expect(positionsOf(geometry)).toEqual(before);
  });
});

describe("Jolly Roger", () => {
  it("ripples the cloth and carries the skull on it", () => {
    const { geometry, skull } = drawFlag(null, false);
    const before = positionsOf(geometry);
    frame(0.7);
    const after = positionsOf(geometry);
    expect(after).not.toEqual(before);
    expect(after.every(Number.isFinite)).toBe(true);
    // Skull sits on the cloth's own ripple at its place along the flag.
    expect(skull.position.z).toBeCloseTo(flagRipple(0.4, 0.7 * 4));
    expect(skull.position.z).not.toBe(0);
    expect(Number.isFinite(skull.rotation.y)).toBe(true);
  });

  it("keeps the flag and skull still in ghost and reduced-motion modes", () => {
    for (const [tint, reduced] of [
      ["ghost-ok", false],
      [null, true],
    ] as const) {
      mockFrames.latest = null;
      const { geometry, skull } = drawFlag(tint, reduced);
      const before = positionsOf(geometry);
      frame(0.7);
      expect(positionsOf(geometry)).toEqual(before);
      expect(skull.position.z).toBe(0);
      expect(skull.rotation.y).toBe(0);
    }
  });
});
