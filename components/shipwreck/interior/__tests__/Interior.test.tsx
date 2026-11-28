import { act, render } from "@testing-library/react";
import { Vector3, Group, Mesh, NoBlending, type Material } from "three";
import { lightSegments, TITANIC_INTERIOR } from "@/lib/shipwreck/interior";
import { floorZ, walkMapFor } from "@/lib/shipwreck/walk";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { britannic } from "@/lib/shipwreck/ships/britannic";
import { concordia } from "@/lib/shipwreck/ships/concordia";
import { CONCORDIA_INTERIOR } from "@/lib/shipwreck/interior/concordia";
import type { SimFrame } from "@/lib/shipwreck/sim/track";
import toSea from "@/lib/shipwreck/sim/__tests__/fixtures/concordiaToSea.json";
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
  const view = (spec: ShipSpec, daylight?: boolean) => (
    <Interior store={store} runtime={runtime} spec={spec} daylight={daylight} />
  );
  const r = render(view(titanic));
  return {
    store,
    runtime,
    rerender: (s: ShipSpec, daylight?: boolean) =>
      r.rerender(view(s, daylight)),
  };
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
        heelDeg: 0,
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

  it("draws her pool hall whenever walking on her: before the clear from her deck, inside-wins in it, its pool at the low rim", () => {
    const { store, runtime, rerender } = setup();
    rerender(concordia);
    act(() => store.getState().startWalk());
    runtime.frame = toSea.night.frames[0] as unknown as SimFrame;
    const whole = new Group();
    // Her model's paint mesh, the block where the hall is its tail
    // (`Block.walkHidden`, the draw range stops before it).
    const block = new Mesh();
    block.userData.walkHiddenFrom = 30;
    whole.add(block);
    runtime.whole = { whole } as unknown as typeof runtime.whole;
    const group = mockScene.add.mock.calls[
      mockScene.add.mock.calls.length - 1
    ][0] as Group;
    const meshes = group.children.filter((c): c is Mesh => c instanceof Mesh);
    const hall = meshes.filter((m) => m.name.includes("pool-hall"));
    expect(hall.map((m) => m.name).sort()).toEqual([
      "interior-pool-hall-glass",
      "interior-pool-hall-metal",
      "interior-pool-hall-pane",
      "interior-pool-hall-shell",
      "interior-pool-pool-hall",
    ]);
    const clear = meshes.find((m) => m.name === "interior-depth-clear")!;
    const frame = mockFrames[mockFrames.length - 1];
    // On her lido: drawn, before the clear (her exterior's), no clear.
    runtime.walkRoom = "lido-aft";
    frame({ clock: { elapsedTime: 1 } }, 1 / 60);
    expect(group.visible).toBe(true);
    for (const m of hall) {
      expect([m.name, m.visible]).toEqual([m.name, true]);
      expect(m.renderOrder).toBeLessThan(9);
    }
    expect(clear.visible).toBe(false);
    // Her model's block there is hidden while the hall is drawn.
    expect(block.geometry.drawRange.count).toBe(30);
    // Its glass after its pool, after its surfaces.
    const order = (n: string) => hall.find((m) => m.name === n)!.renderOrder;
    expect(order("interior-pool-pool-hall")).toBeGreaterThan(
      order("interior-pool-hall-shell")
    );
    expect(order("interior-pool-hall-pane")).toBeGreaterThan(
      order("interior-pool-pool-hall")
    );
    // In the hall: inside wins (after the clear).
    runtime.walkRoom = "pool-hall";
    frame({ clock: { elapsedTime: 2 } }, 1 / 60);
    for (const m of hall) expect(m.renderOrder).toBeGreaterThanOrEqual(10);
    expect(clear.visible).toBe(true);
    // The pool's water: its low rim's height (a little under), level or
    // leaning (her roll: three x).
    const shell = hall.find((m) => m.name === "interior-pool-hall-shell")!;
    const levels = (shell.material as import("three").ShaderMaterial).uniforms
      .uLevel.value as Float32Array;
    // The pool's slot: after the rooms' and the long halls' parts.
    const slot = CONCORDIA_INTERIOR.rooms.reduce(
      (n, r) => n + lightSegments(r).length,
      CONCORDIA_INTERIOR.rooms.length
    );
    const rimY = () => {
      whole.updateMatrixWorld(true);
      let low = Infinity;
      for (const [x, y] of [
        [11.5, -2.25],
        [20.5, -2.25],
        [20.5, 2.25],
        [11.5, 2.25],
      ]) {
        const z = 44.98 + 0.02;
        low = Math.min(
          low,
          new Vector3(x, z, -y).applyMatrix4(whole.matrixWorld).y
        );
      }
      return low;
    };
    frame({ clock: { elapsedTime: 3 } }, 1 / 60);
    expect(levels[slot]).toBeCloseTo(rimY() - 0.01, 4);
    whole.rotation.x = 0.35;
    frame({ clock: { elapsedTime: 4 } }, 1 / 60);
    expect(levels[slot]).toBeCloseTo(rimY() - 0.01, 4);
    // Its lamps follow her power; the pool's too (or the day's).
    const power = (shell.material as import("three").ShaderMaterial).uniforms
      .uRoomPower.value as Float32Array;
    expect(power[0]).toBe(runtime.frame.power);
    expect(power[slot]).toBe(runtime.frame.power);
    // Her blackout (her emergency light): the hall dims with her.
    runtime.frame = { ...runtime.frame, power: 0.25 };
    frame({ clock: { elapsedTime: 4.5 } }, 1 / 60);
    expect(power[0]).toBeCloseTo(0.25, 6);
    expect(power[slot]).toBeCloseTo(0.25, 6);
    // By day: her shader and her glass catch the sky.
    rerender(concordia, true);
    const day = (shell.material as import("three").ShaderMaterial).uniforms
      .uDaylight.value;
    expect(day).toBe(1);
    const pane = hall.find((m) => m.name === "interior-pool-hall-pane")!;
    expect(
      (pane.material as import("three").ShaderMaterial).uniforms.uDaylight.value
    ).toBe(1);
    frame({ clock: { elapsedTime: 5 } }, 1 / 60);
    // The pool's water lit by the day; the hall's lamps still her power.
    expect(power[slot]).toBe(1);
    expect(power[0]).toBeCloseTo(0.25, 6);
    // Off the walk: her model's block shows again.
    act(() => store.getState().setCamera("orbit"));
    frame({ clock: { elapsedTime: 6 } }, 1 / 60);
    expect(group.visible).toBe(false);
    expect(block.geometry.drawRange.count).toBe(Infinity);
  });
});

describe("Interior inside her (the Concordia's rooms close, seep and flicker)", () => {
  /** A frame of her at heel `listDeg` with the origin at `z`, level pitch. */
  function herFrame(t: number, z: number, listDeg = 0, power = 1): SimFrame {
    return {
      t,
      realT: t,
      bodies: [
        {
          part: "whole",
          x: 0,
          y: 0,
          z,
          pitch: 0,
          roll: 0,
          yaw: 0,
        },
      ],
      water: concordia.compartments.map(() => 0),
      waterAboardT: 0,
      trimDeg: 0,
      listDeg,
      power,
      groundedParts: [],
    } as SimFrame;
  }

  function setupHer(frames: SimFrame[]) {
    const herTrack: SimTrack = {
      frames,
      events: [],
      outcome: "aground",
      sankAtT: null,
      brokeAtT: null,
      breakX: null,
      endT: frames[frames.length - 1].t,
    };
    const runner: SimRunner = {
      advance: () => true,
      done: true,
      progress: () => 1,
      track: () => herTrack,
    };
    const store = createPlaybackStore({ createRunner: () => runner });
    store.getState().start(concordia, concordia.realNight);
    store.getState().pump();
    const runtime = createSceneRuntime();
    render(<Interior store={store} runtime={runtime} spec={concordia} />);
    act(() => store.getState().startWalk());
    const whole = new Group();
    // Her piece posed as the sim has it (three y is earth z).
    whole.position.y = frames[0].bodies[0].z;
    runtime.whole = { whole } as unknown as typeof runtime.whole;
    const group = mockScene.add.mock.calls[
      mockScene.add.mock.calls.length - 1
    ][0] as Group;
    const frame = (f: SimFrame, elapsed = 1, dt = 1 / 60) => {
      runtime.frame = f;
      mockFrames[mockFrames.length - 1](
        { clock: { elapsedTime: elapsed } },
        dt
      );
    };
    return { store, runtime, group, frame };
  }

  const meshesOf = (group: Group, zone: string) =>
    group.children.filter(
      (c): c is Mesh =>
        c instanceof Mesh && c.name.startsWith(`interior-${zone}-`)
    );

  it("draws her low rooms until 30° and only her deck rooms from it, with the doors' glow gone", () => {
    const { runtime, group, frame } = setupHer([herFrame(0, -13.6)]);
    runtime.walkRoom = "lobby-1";
    frame(herFrame(0, -13.6, 29.9));
    const low = meshesOf(group, "low-cabins");
    expect(low.length).toBeGreaterThan(0);
    expect(low.every((m) => m.visible)).toBe(true);
    const lv = runtime.interiorLevels!;
    expect(lv.drawn[lv.slot.get("lobby-1")!]).toBe(1);
    frame(herFrame(0, -13.6, 30));
    expect(low.every((m) => !m.visible)).toBe(true);
    expect(lv.drawn[lv.slot.get("lobby-1")!]).toBe(0);
    expect(runtime.walkWet).toBe(0);
    // Her pool hall (a deck room) is still drawn, and the group with it.
    expect(group.visible).toBe(true);
    expect(meshesOf(group, "pool-hall").every((m) => m.visible)).toBe(true);
    const glow = group.children.find((c) => c.name === "interior-door-glow")!;
    expect(glow.visible).toBe(false);
  });

  it("shows the deck doors' glow from her pool hall too (the club's door), after the clear", () => {
    const { runtime, group, frame } = setupHer([herFrame(0, -13.6)]);
    const glow = group.children.find(
      (c) => c.name === "interior-door-glow"
    ) as Mesh;
    runtime.walkRoom = "lido-aft";
    frame(herFrame(0, -13.6, 5));
    expect(glow.visible).toBe(true);
    expect(glow.renderOrder).toBe(0);
    runtime.walkRoom = "pool-hall";
    frame(herFrame(0, -13.6, 5));
    expect(glow.visible).toBe(true);
    expect(glow.renderOrder).toBeGreaterThan(8);
    expect(glow.renderOrder).toBeLessThan(10);
    expect((glow.material as Material).transparent).toBe(true);
    runtime.walkRoom = "lobby-1";
    frame(herFrame(0, -13.6, 5));
    expect(glow.visible).toBe(false);
  });

  it("fills a seeping room by the seep table, not to the sea at once", () => {
    // The sea is 2 m over the lobby's floor all night; 100 s on, the seep
    // has put only half a metre in.
    const frames = [herFrame(0, -13.6), herFrame(100, -13.6)];
    const { store, runtime, frame } = setupHer(frames);
    runtime.walkRoom = "lobby-1";
    store.setState({ t: 100 });
    frame(frames[1], 1, 1);
    const lv = runtime.interiorLevels!;
    expect(lv.shown[lv.slot.get("lobby-1")!]).toBeCloseTo(-1.5, 6);
    // A room that does not seep (deck 7's) takes the sea's level.
    expect(CONCORDIA_INTERIOR.rooms.find((r) => r.id === "lobby-7")!.seep).toBe(
      undefined
    );
  });

  it("never flickers her lamps faster than 3 Hz, never black, and writes the dip for her emergency lamps", () => {
    const { runtime, frame } = setupHer([herFrame(0, -13.6)]);
    runtime.walkRoom = "lobby-7";
    expect(runtime.interiorEmergency).toBe(1);
    // On full power, or under 10°: no dip.
    for (let i = 0; i < 100; i += 1) {
      frame(herFrame(0, -13.6, 30, 1), i / 10);
      expect(runtime.interiorEmergency).toBe(1);
    }
    for (let i = 0; i < 100; i += 1) {
      frame(herFrame(0, -13.6, 5, 0.25), i / 10);
      expect(runtime.interiorEmergency).toBe(1);
    }
    // At emergency power, leaning 30°: dips, never under 0.1, all fine steps.
    let least = 1;
    let dips = 0;
    let was = false;
    for (let i = 0; i < 3000; i += 1) {
      frame(herFrame(0, -13.6, 30, 0.25), i / 100);
      const v = runtime.interiorEmergency;
      least = Math.min(least, v);
      const under = v < 0.95;
      if (under && !was) dips += 1;
      was = under;
    }
    expect(least).toBeGreaterThanOrEqual(0.1);
    expect(least).toBeLessThan(0.6);
    expect(dips / 30).toBeGreaterThan(0.8);
    expect(dips / 30).toBeLessThan(1.2);
  });

  it("softens the dips for reduced motion", () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes("reduce"),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      const { runtime, frame } = setupHer([herFrame(0, -13.6)]);
      runtime.walkRoom = "lobby-7";
      let least = 1;
      for (let i = 0; i < 2000; i += 1) {
        frame(herFrame(0, -13.6, 30, 0.25), i / 100);
        least = Math.min(least, runtime.interiorEmergency);
      }
      expect(least).toBeLessThan(0.9);
      expect(least).toBeGreaterThanOrEqual(1 - 0.9 * 0.35 - 1e-9);
    } finally {
      window.matchMedia = original;
    }
  });

  it("writes how wet it is around the walker, 0 dry to 1 at a metre", () => {
    const frames = [herFrame(0, -13.6), herFrame(100, -13.6)];
    const { store, runtime, frame } = setupHer(frames);
    runtime.walkRoom = "lobby-1";
    store.setState({ t: 0 });
    frame(frames[0], 1, 1);
    // Just wet at the first frame: nothing over the lowest point yet.
    expect(runtime.walkWet).toBeLessThan(0.05);
    store.setState({ t: 100 });
    frame(frames[1], 2, 1);
    expect(runtime.walkWet).toBeGreaterThan(0.4);
    expect(runtime.walkWet).toBeLessThanOrEqual(1);
    // In a dry room, and off the walk: 0.
    runtime.walkRoom = "lobby-7";
    frame(frames[1], 3, 1);
    expect(runtime.walkWet).toBeLessThan(1);
  });
});
