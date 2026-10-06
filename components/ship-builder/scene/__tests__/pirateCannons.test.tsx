import { fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
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

jest.mock("@react-three/fiber", () => ({ useFrame: jest.fn() }));

const MOVING: ShipAnimationValue = {
  topSpeedKnots: 0,
  stabilityRatio: 0,
  reducedMotion: false,
  seaState: "calm",
  listAngle: 0,
};

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
    // r3f elements are unknown tags to the DOM renderer; ignore its warnings.
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
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

  it("lets a tap bubble so the part is still selected", () => {
    const onParentClick = jest.fn();
    const { container } = render(
      <div onClick={onParentClick}>{draw("cannon-deck")}</div>
    );
    fireEvent.click(container.querySelector("group") as Element);
    expect(onParentClick).toHaveBeenCalledTimes(1);
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

describe("cannon icons", () => {
  it("has a distinct real drawing for each gun", () => {
    const markup = TYPES.map(
      (type) => render(<svg>{PIRATE_ICONS[type]()}</svg>).container.innerHTML
    );
    expect(new Set(markup).size).toBe(TYPES.length);
    for (const html of markup) expect(html).not.toContain("data-placeholder");
  });
});
