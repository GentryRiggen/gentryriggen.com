import { act, render } from "@testing-library/react";
import { Group, type Mesh } from "three";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { britannic } from "@/lib/shipwreck/ships/britannic";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { simulate, type SimTrack } from "@/lib/shipwreck/sim";
import type { SimRunner } from "@/lib/shipwreck/sim/run";
import { floorZ, walkMapFor, type WalkMap } from "@/lib/shipwreck/walk";
import { createSceneRuntime } from "../../scene/runtime";
import DoorArrow, { ARROW_TIP_M, doorArrowGeometry } from "../DoorArrow";

/**
 * The way-in arrow (react-three-fiber mocked): not built until walking on
 * a ship with rooms, shown over WalkRunner's door (`walkArrow`) on her
 * deck only, still under reduced motion.
 */

type FrameState = {
  clock: { elapsedTime: number };
  camera: {
    getWorldPosition: (v: {
      set: (x: number, y: number, z: number) => unknown;
    }) => unknown;
  };
};
type FrameFn = (state: FrameState, dt: number) => void;
const mockFrames: FrameFn[] = [];
const mockScene = { add: jest.fn(), remove: jest.fn() };
jest.mock("@react-three/fiber", () => ({
  useFrame: (fn: FrameFn) => {
    mockFrames.push(fn);
  },
  useThree: (sel: (s: unknown) => unknown) => sel({ scene: mockScene }),
}));

let reducedMotion = false;
let track: SimTrack;
beforeAll(() => {
  track = simulate(titanic, titanic.realNight);
});
beforeEach(() => {
  mockFrames.length = 0;
  mockScene.add.mockClear();
  mockScene.remove.mockClear();
  reducedMotion = false;
  window.matchMedia = ((q: string) => ({
    matches: q.includes("reduce") && reducedMotion,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});

const map = walkMapFor("titanic") as WalkMap;
const doorIndex = (id: string) => map.stairs.findIndex((s) => s.id === id);

function setup(spec: ShipSpec = titanic) {
  const runner: SimRunner = {
    advance: () => true,
    done: true,
    progress: () => 1,
    track: () => track,
  };
  const store = createPlaybackStore({ createRunner: () => runner });
  store.getState().start(titanic, titanic.realNight);
  store.getState().pump();
  const runtime = createSceneRuntime();
  // Her whole piece at the origin, unturned: ship frame = three.js axes.
  const whole = new Group();
  runtime.part = (name) => (name === "whole" ? whole : null);
  runtime.walker = { pos: [0, 0, 0], yaw: 0, pitch: 0 };
  render(<DoorArrow store={store} runtime={runtime} spec={spec} />);
  const mesh = () =>
    (mockScene.add.mock.calls.at(-1)?.[0] as Mesh | undefined) ?? null;
  const frame = (t = 0) =>
    mockFrames.at(-1)!(
      {
        clock: { elapsedTime: t },
        camera: { getWorldPosition: (v) => v.set(0, 20, 0) },
      },
      1 / 60
    );
  return { store, runtime, mesh, frame };
}

describe("the way-in arrow", () => {
  it("is one arrow shape with a rim, its tip at the origin", () => {
    const g = doorArrowGeometry();
    const pos = g.getAttribute("position");
    expect(pos.count).toBe(18); // 2 layers × 3 triangles
    let minY = Infinity;
    for (let i = 0; i < pos.count; i += 1) minY = Math.min(minY, pos.getY(i));
    expect(minY).toBeLessThan(0); // the rim, just under the tip
    expect(g.getAttribute("color").count).toBe(18);
    g.dispose();
  });

  it("is not built until walking, and never on a ship without rooms", () => {
    const { store, mesh } = setup();
    expect(mesh()).toBeNull();
    act(() => store.getState().startWalk());
    expect(mesh()?.name).toBe("walk-door-arrow");
    act(() => store.getState().leaveWalk());
    expect(mockScene.remove).toHaveBeenCalled();

    mockScene.add.mockClear();
    const other = setup(britannic);
    act(() => other.store.getState().startWalk());
    expect(other.mesh()).toBeNull();
  });

  it("stands over WalkRunner's door on her deck, hidden otherwise", () => {
    const { store, runtime, mesh, frame } = setup();
    act(() => store.getState().startWalk());
    frame();
    expect(mesh()!.visible).toBe(false); // walkArrow −1
    const i = doorIndex("gs-door-starboard");
    runtime.walkArrow = i;
    frame();
    const m = mesh()!;
    expect(m.visible).toBe(true);
    const [dx, dy] = map.stairs[i].from.at;
    expect(m.position.x).toBeCloseTo(dx, 6);
    expect(m.position.z).toBeCloseTo(-dy, 6);
    const tip = floorZ(map, "boat-deck", dx, titanic, dy) + ARROW_TIP_M;
    expect(m.position.y).toBeGreaterThanOrEqual(tip - 1e-6);
    // Grown with distance from the eyes (about 30 m off).
    expect(m.scale.x).toBeGreaterThan(0.8);

    runtime.walkInside = true;
    frame();
    expect(m.visible).toBe(false);
    runtime.walkInside = false;
    runtime.broken = true;
    frame();
    expect(m.visible).toBe(false);
    runtime.broken = false;
    runtime.walker = null;
    frame();
    expect(m.visible).toBe(false);
  });

  it("bobs, but not with reduced motion", () => {
    const run = () => {
      const { store, runtime, mesh, frame } = setup();
      act(() => store.getState().startWalk());
      runtime.walkArrow = doorIndex("gs-door-port");
      frame(0);
      const y0 = mesh()!.position.y;
      frame(0.3);
      return mesh()!.position.y - y0;
    };
    expect(Math.abs(run())).toBeGreaterThan(0.05);
    reducedMotion = true;
    expect(run()).toBe(0);
  });
});
