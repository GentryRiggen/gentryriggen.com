import { act, render } from "@testing-library/react";
import { Group } from "three";
import { TITANIC_INTERIOR } from "@/lib/shipwreck/interior";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { britannic } from "@/lib/shipwreck/ships/britannic";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { sampleTrack, simulate, type SimTrack } from "@/lib/shipwreck/sim";
import type { SimRunner } from "@/lib/shipwreck/sim/run";
import { createSceneRuntime } from "../../scene/runtime";
import Interior from "../Interior";

/**
 * Interior in the scene (react-three-fiber mocked): built only once walk
 * starts on the Titanic, gone with a change of ship (and not rebuilt on
 * coming back without walking), and each frame the drawn rooms' eased
 * water levels in `runtime.interiorLevels` and the shader's uniform.
 */

type FrameFn = (state: { clock: { elapsedTime: number } }, dt: number) => void;
const mockFrames: FrameFn[] = [];
const mockCompile = jest.fn();
const mockScene = { add: jest.fn(), remove: jest.fn() };
jest.mock("@react-three/fiber", () => ({
  useFrame: (fn: FrameFn) => {
    mockFrames.push(fn);
  },
  useThree: (sel: (s: unknown) => unknown) =>
    sel({ gl: { compile: mockCompile }, scene: mockScene, camera: {} }),
}));

let track: SimTrack;
beforeAll(() => {
  track = simulate(titanic, titanic.realNight);
});
beforeEach(() => {
  mockFrames.length = 0;
  // <primitive> is react-three-fiber's; react-dom only warns about it.
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function setup() {
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
  const view = (spec: ShipSpec) => (
    <Interior store={store} runtime={runtime} spec={spec} />
  );
  const r = render(view(titanic));
  return { store, runtime, rerender: (s: ShipSpec) => r.rerender(view(s)) };
}

describe("Interior", () => {
  it("builds on the first walk, goes with a change of ship, and is not rebuilt on coming back", () => {
    const { store, runtime, rerender } = setup();
    expect(runtime.interiorLevels).toBeNull();
    act(() => store.getState().startWalk());
    expect(runtime.interiorLevels).not.toBeNull();
    act(() => store.getState().setCamera("orbit"));
    // Kept while she is the ship.
    expect(runtime.interiorLevels).not.toBeNull();
    rerender(britannic);
    expect(runtime.interiorLevels).toBeNull();
    rerender(titanic);
    // Back on her, not walking: nothing built.
    expect(runtime.interiorLevels).toBeNull();
    act(() => store.getState().startWalk());
    expect(runtime.interiorLevels).not.toBeNull();
  });

  it("eases each drawn room's level and clears the rest", () => {
    const { store, runtime } = setup();
    act(() => store.getState().startWalk());
    act(() => store.getState().seek(80 * 60));
    runtime.frame = sampleTrack(track, store.getState().t);
    const whole = new Group();
    runtime.whole = { whole } as unknown as typeof runtime.whole;
    runtime.walkRoom = "scotland-road";
    const frame = mockFrames[mockFrames.length - 1];
    frame({ clock: { elapsedTime: 1 } }, 1 / 60);
    const lv = runtime.interiorLevels!;
    const sr = lv.slot.get("scotland-road")!;
    const foyer = lv.slot.get("gs-b")!;
    // Scotland Road's zone is drawn: the sea's level (flat 0).
    expect(lv.drawn[sr]).toBe(1);
    expect(lv.shown[sr]).toBe(0);
    expect(lv.drawn[foyer]).toBe(0);
    // A level the frame did not reach eases at 0.5 m/s, never pops.
    lv.shown[sr] = -1;
    frame({ clock: { elapsedTime: 2 } }, 0.5);
    expect(lv.shown[sr]).toBeCloseTo(-0.75);
    // Every room of a zone drawn with it eases (here: E deck's).
    const eDeck = TITANIC_INTERIOR.rooms.filter((r) => r.zone === "e-deck");
    for (const r of eDeck)
      expect([r.id, lv.drawn[lv.slot.get(r.id)!]]).toEqual([r.id, 1]);
    // Back on deck: nothing drawn, so nothing eased.
    runtime.walkRoom = "boat-deck";
    frame({ clock: { elapsedTime: 3 } }, 1 / 60);
    expect(Array.from(lv.drawn).every((d) => d === 0)).toBe(true);
  });
});
