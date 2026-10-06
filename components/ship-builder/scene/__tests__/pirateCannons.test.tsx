import { createEvent, fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { Vector3 } from "three";
import {
  ShipAnimationContext,
  type ShipAnimationValue,
} from "../ShipAnimationContext";
import {
  advanceShot,
  CANNON_MESHES,
  puffScale,
  recoilOffset,
  SHOT_SECONDS,
} from "../pirate/cannons";
import { PIRATE_ICONS } from "../../ui/icons/pirateIcons";

type FrameCallback = (state: unknown, delta: number) => void;

const mockFrames: { latest: FrameCallback | null } = { latest: null };

jest.mock("@react-three/fiber", () => ({
  useFrame: (callback: FrameCallback) => {
    mockFrames.latest = callback;
  },
}));

function frame(delta: number): void {
  if (!mockFrames.latest) throw new Error("no useFrame callback was captured");
  mockFrames.latest({}, delta);
}

const MOVING: ShipAnimationValue = {
  topSpeedKnots: 0,
  stabilityRatio: 0,
  reducedMotion: false,
  seaState: "calm",
  listAngle: 0,
};

const R3F_TAG_WARNING =
  /is unrecognized in this browser|incorrect casing|React does not recognize|non-boolean attribute/;

const TYPES = ["cannon-deck", "cannon-swivel", "cannon-chaser"] as const;

function draw(
  type: (typeof TYPES)[number],
  options: { tint?: "ghost-ok" | null; reducedMotion?: boolean } = {}
): ReactNode {
  const Mesh = CANNON_MESHES[type];
  return (
    <ShipAnimationContext.Provider
      value={{ ...MOVING, reducedMotion: options.reducedMotion ?? false }}
    >
      <div data-testid="parent">
        <Mesh tint={options.tint ?? null} emphasis={null} side="starboard" />
      </div>
    </ShipAnimationContext.Provider>
  );
}

interface ScenePart {
  position: Vector3;
  scale: Vector3;
  visible: boolean;
}

/**
 * The DOM stands in for the scene, so give the gun's refs real three.js
 * vectors. The barrel group is the gun's only nested group; the smoke puff is
 * its last mesh, and exists only for a gun that can fire.
 */
function wireGun(container: HTMLElement) {
  const [gun, barrelGroup] = Array.from(container.querySelectorAll("group"));
  const barrel = Object.assign(barrelGroup, {
    position: new Vector3(),
  }) as unknown as ScenePart & Element;
  const hasPuff = barrelGroup.querySelectorAll(":scope > mesh").length > 3;
  const puff = hasPuff
    ? (Object.assign(barrelGroup.lastElementChild as Element, {
        scale: new Vector3(1, 1, 1),
        visible: false,
      }) as unknown as ScenePart)
    : null;
  return { gun, barrel, puff };
}

describe("shot helpers", () => {
  it("kicks back fast, then slides home", () => {
    expect(recoilOffset(0)).toBe(0);
    const peak = recoilOffset(0.12);
    expect(peak).toBeGreaterThan(0.1);
    expect(recoilOffset(0.5)).toBeLessThan(peak);
    expect(recoilOffset(0.5)).toBeGreaterThan(0);
    expect(recoilOffset(SHOT_SECONDS)).toBe(0);
    expect(recoilOffset(-1)).toBe(0);
  });

  it("puffs up and fades away", () => {
    expect(puffScale(-1)).toBe(0);
    expect(puffScale(SHOT_SECONDS / 2)).toBeGreaterThan(1);
    expect(puffScale(SHOT_SECONDS)).toBe(0);
  });

  it("advances a shot and returns to rest, capping long frames", () => {
    expect(advanceShot(null, 0.1)).toBeNull();
    expect(advanceShot(0, 0.05)).toBeCloseTo(0.05);
    expect(advanceShot(0, 5)).toBeCloseTo(0.1);
    expect(advanceShot(SHOT_SECONDS - 0.01, 0.05)).toBeNull();
  });
});

describe("cannon meshes", () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    mockFrames.latest = null;
    // r3f elements are unknown tags to the DOM renderer; swallow only those
    // warnings and let anything else through.
    const real = console.error.bind(console);
    errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
      if (!R3F_TAG_WARNING.test(String(args[0]))) real(...args);
    });
  });
  afterEach(() => errorSpy.mockRestore());

  it.each(TYPES)("draws %s", (type) => {
    const { container } = render(draw(type));
    expect(container.querySelectorAll("mesh").length).toBeGreaterThan(3);
  });

  it("draws the three guns differently", () => {
    const markup = TYPES.map((type) => render(draw(type)).container.innerHTML);
    expect(new Set(markup).size).toBe(TYPES.length);
  });

  it("aims deck guns the other way on the port side", () => {
    const Mesh = CANNON_MESHES["cannon-deck"];
    const starboard = render(
      <Mesh tint={null} emphasis={null} side="starboard" />
    ).container.innerHTML;
    const port = render(<Mesh tint={null} emphasis={null} side="port" />)
      .container.innerHTML;
    expect(starboard).not.toBe(port);
  });

  it("has no smoke puff for ghosts or under reduced motion", () => {
    const live = render(draw("cannon-deck")).container;
    const ghost = render(draw("cannon-deck", { tint: "ghost-ok" })).container;
    const still = render(
      draw("cannon-deck", { reducedMotion: true })
    ).container;
    expect(live.querySelectorAll("mesh").length).toBe(
      ghost.querySelectorAll("mesh").length + 1
    );
    expect(still.querySelectorAll("mesh").length).toBe(
      ghost.querySelectorAll("mesh").length
    );
  });
});

describe("firing a cannon", () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    mockFrames.latest = null;
    const real = console.error.bind(console);
    errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
      if (!R3F_TAG_WARNING.test(String(args[0]))) real(...args);
    });
  });
  afterEach(() => errorSpy.mockRestore());

  it("stays at rest, with the smoke hidden, until it is tapped", () => {
    const { container } = render(draw("cannon-deck"));
    const { barrel, puff } = wireGun(container);
    frame(0.1);
    frame(0.1);
    expect(barrel.position.x).toBe(0);
    expect(puff?.visible).toBe(false);
  });

  it("fires when the gun itself is tapped, and still lets the tap through", () => {
    const onParentClick = jest.fn();
    const { container } = render(
      <div onClick={onParentClick}>{draw("cannon-deck")}</div>
    );
    const { gun, barrel, puff } = wireGun(container);

    const tap = createEvent.click(gun);
    const stopPropagation = jest.spyOn(tap, "stopPropagation");
    fireEvent(gun, tap);
    expect(stopPropagation).not.toHaveBeenCalled();
    expect(onParentClick).toHaveBeenCalledTimes(1);

    frame(0.12);
    expect(barrel.position.x).toBeLessThan(-0.1);
    expect(Number.isFinite(barrel.position.x)).toBe(true);
    expect(puff?.visible).toBe(true);
    expect(puff?.scale.x).toBeGreaterThan(0);
    expect(Number.isFinite(puff?.scale.x)).toBe(true);
  });

  it("slides home and hides the smoke when the shot ends", () => {
    const { container } = render(draw("cannon-swivel"));
    const { gun, barrel, puff } = wireGun(container);
    fireEvent.click(gun);
    frame(0.12);
    expect(barrel.position.x).not.toBe(0);
    for (let elapsed = 0; elapsed < SHOT_SECONDS + 0.2; elapsed += 0.05) {
      frame(0.05);
    }
    expect(barrel.position.x).toBeCloseTo(0);
    expect(puff?.visible).toBe(false);
  });

  it.each([
    ["a ghost", { tint: "ghost-ok" as const }],
    ["reduced motion", { reducedMotion: true }],
  ])("does not fire for %s", (_name, options) => {
    const { container } = render(draw("cannon-deck", options));
    const { gun, barrel, puff } = wireGun(container);
    expect(puff).toBeNull();
    fireEvent.click(gun);
    frame(0.12);
    expect(barrel.position.x).toBe(0);
  });
});

describe("cannon icons", () => {
  it("has a distinct real drawing for each gun", () => {
    const markup = TYPES.map(
      (type) => render(<svg>{PIRATE_ICONS[type]()}</svg>).container.innerHTML
    );
    expect(new Set(markup).size).toBe(TYPES.length);
  });
});
