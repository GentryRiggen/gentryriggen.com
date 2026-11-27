import { act, render } from "@testing-library/react";
import { Vector3, Group, Mesh, NoBlending, type Material } from "three";
import { lightSegments, TITANIC_INTERIOR } from "@/lib/shipwreck/interior";
import { floorZ, walkMapFor } from "@/lib/shipwreck/walk";
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
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockCamera = new (require("three").PerspectiveCamera)();
jest.mock("@react-three/fiber", () => ({
  useFrame: (fn: FrameFn) => {
    mockFrames.push(fn);
  },
  useThree: (sel: (s: unknown) => unknown) =>
    sel({ gl: { compile: mockCompile }, scene: mockScene, camera: mockCamera }),
}));

let track: SimTrack;
beforeAll(() => {
  track = simulate(titanic, titanic.realNight);
});
let errors: jest.SpyInstance;
beforeEach(() => {
  mockFrames.length = 0;
  mockScene.add.mockClear();
  errors = jest.spyOn(console, "error");
});
afterEach(() => {
  // Interior renders nothing to the DOM: React has nothing to warn about.
  // Restore first, so a failing assert never leaks the spy.
  const calls = errors.mock.calls.slice();
  jest.restoreAllMocks();
  expect(calls).toEqual([]);
});

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

/**
 * Two layers keep a change of ship clean, both intended: this render test
 * covers Interior's own reset (it forgets its build when the ship
 * changes, even without a key), and NightScene's key
 * (`interior-${spec.id}`) remounts it outright.
 */
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

  it("draws the rooms after every exterior piece: the clear and the rooms in the transparent pass", () => {
    const { store } = setup();
    act(() => store.getState().startWalk());
    const group = mockScene.add.mock.calls[
      mockScene.add.mock.calls.length - 1
    ][0] as Group;
    const meshes = group.children.filter((c): c is Mesh => c instanceof Mesh);
    const rooms = meshes.filter((m) =>
      /^interior-gs-(shell|wood|metal|glass)$/.test(m.name)
    );
    expect(rooms.map((m) => m.name).sort()).toEqual([
      "interior-gs-glass",
      "interior-gs-metal",
      "interior-gs-shell",
      "interior-gs-wood",
    ]);
    for (const m of rooms) {
      const mat = m.material as Material;
      expect([
        m.name,
        mat.transparent,
        mat.blending,
        mat.depthWrite,
        m.renderOrder,
      ]).toEqual([m.name, true, NoBlending, true, 10]);
    }
    const clear = meshes.find((m) => m.name === "interior-depth-clear")!;
    expect((clear.material as Material).transparent).toBe(true);
    expect(clear.renderOrder).toBe(9);
  });

  it("sets each drawn room's lamps from the water over it, and the torch comes on in the dark", () => {
    const { store, runtime } = setup();
    act(() => store.getState().startWalk());
    // Before the iceberg's water reaches her rooms: full power.
    act(() => store.getState().seek(10 * 60));
    runtime.frame = sampleTrack(track, store.getState().t);
    const whole = new Group();
    runtime.whole = { whole } as unknown as typeof runtime.whole;
    runtime.walkRoom = "third-cabin";
    const frame = mockFrames[mockFrames.length - 1];
    frame({ clock: { elapsedTime: 1 } }, 1 / 60);
    const lv = runtime.interiorLevels!;
    const k = lv.slot.get("third-cabin")!;
    const group = mockScene.add.mock.calls[
      mockScene.add.mock.calls.length - 1
    ][0] as Group;
    const shell = group.children.find(
      (c) => c.name === "interior-e-deck-shell"
    ) as Mesh;
    const mat = shell.material as import("three").ShaderMaterial;
    const power = mat.uniforms.uRoomPower.value as Float32Array;
    expect(power[k]).toBe(1);
    expect(mat.uniforms.uTorchOn.value).toBe(0);
    // The water over its floor past 0.6 m: its own lamps are out. A
    // moment's dark (a flicker) does not blink the torch; held dark, it
    // comes on (after half a second, eased over a quarter), aimed from
    // the eyes.
    const deep = () => {
      lv.shown[k] = 50;
    };
    for (let i = 0; i < 10; i += 1) {
      deep();
      frame({ clock: { elapsedTime: 2 + i / 60 } }, 1 / 60);
    }
    expect(mat.uniforms.uTorchOn.value).toBe(0);
    for (let i = 10; i < 60; i += 1) {
      deep();
      frame({ clock: { elapsedTime: 2 + i / 60 } }, 1 / 60);
    }
    // Out, but for a little spill from the lit stairs beside it.
    expect(power[k]).toBeGreaterThan(0);
    expect(power[k]).toBeLessThan(0.35);
    expect(mat.uniforms.uTorchOn.value).toBeCloseTo(1, 5);
    const dir = mat.uniforms.uTorchDir.value as import("three").Vector3;
    expect(dir.length()).toBeCloseTo(1, 5);
  });

  it("puts Scotland Road's lamps out part by part as the water creeps aft", () => {
    const { store, runtime } = setup();
    act(() => store.getState().startWalk());
    act(() => store.getState().seek(110 * 60));
    runtime.frame = sampleTrack(track, store.getState().t);
    const whole = new Group();
    // Bow down 3°: the hall's forward end lower in the water.
    whole.rotation.z = -0.05;
    runtime.whole = { whole } as unknown as typeof runtime.whole;
    runtime.walkRoom = "scotland-road";
    const frame = mockFrames[mockFrames.length - 1];
    const lv = runtime.interiorLevels!;
    const sr = lv.slot.get("scotland-road")!;
    const room = TITANIC_INTERIOR.rooms.find((r) => r.id === "scotland-road")!;
    const parts = lightSegments(room);
    // Parts' slots follow the rooms', in room order.
    let first = TITANIC_INTERIOR.rooms.length;
    for (const r of TITANIC_INTERIOR.rooms) {
      if (r === room) break;
      first += lightSegments(r).length;
    }
    // Its floor at the hall's middle, in the world: the water 0.3 m under it.
    whole.updateMatrixWorld(true);
    const mid = new Vector3(
      27,
      floorZ(walkMapFor("titanic")!, "scotland-road", 27, titanic, 4.3),
      -4.3
    ).applyMatrix4(whole.matrixWorld);
    const level = mid.y - 0.3;
    const group = mockScene.add.mock.calls[
      mockScene.add.mock.calls.length - 1
    ][0] as Group;
    const shell = group.children.find(
      (c) => c.name === "interior-e-deck-shell"
    ) as Mesh;
    const mat = shell.material as import("three").ShaderMaterial;
    const power = mat.uniforms.uRoomPower.value as Float32Array;
    const levels = mat.uniforms.uLevel.value as Float32Array;
    const at = (x: number) => {
      runtime.walkInfo = {
        phase: "deck",
        part: "whole",
        x,
        y: 4.3,
        slopeDeg: 0,
        depthM: -1,
        area: "scotland-road",
        inside: true,
      };
      for (let i = 0; i < 80; i += 1) {
        lv.shown[sr] = level;
        frame({ clock: { elapsedTime: 5 + i / 60 } }, 1 / 60);
      }
    };
    at(-10);
    const lit = parts.map((_, i) => power[first + i] > 0.5);
    // Forward parts out, after parts lit, one change between them.
    expect(lit[0]).toBe(false);
    expect(lit[lit.length - 1]).toBe(true);
    let changes = 0;
    for (let i = 1; i < lit.length; i += 1)
      if (lit[i] !== lit[i - 1]) changes += 1;
    expect(changes).toBe(1);
    // Each part sees the hall's level.
    for (let i = 0; i < parts.length; i += 1)
      expect(levels[first + i]).toBeCloseTo(levels[sr], 6);
    // Standing in the lit after end: no torch. Up in the dark forward end:
    // the torch comes on.
    expect(mat.uniforms.uTorchOn.value).toBe(0);
    at(64);
    expect(mat.uniforms.uTorchOn.value).toBeGreaterThan(0.5);
  });
});
