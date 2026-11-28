import { act, fireEvent, render } from "@testing-library/react";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { concordia } from "@/lib/shipwreck/ships/concordia";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { sampleTrack, simulate, type SimTrack } from "@/lib/shipwreck/sim";
import type { SimRunner } from "@/lib/shipwreck/sim/run";
import type { SimFrame } from "@/lib/shipwreck/sim/track";
import {
  earthToShip,
  floorZ,
  hullClearanceM,
  shipToEarth,
  resetWalkInput,
  walkInput,
  walkMapFor,
  type WalkMap,
} from "@/lib/shipwreck/walk";
import Hud from "@/components/shipwreck/ui/Hud";
import { shipToThree } from "../cameraMath";
import { createSceneRuntime, LIFT_DOWN, LIFT_UP } from "../runtime";
import { sceneHooks } from "../sceneHooks";
import WalkRunner from "../WalkRunner";

type FrameFn = (state: { clock: { elapsedTime: number } }, dt: number) => void;
const mockFrames: FrameFn[] = [];
jest.mock("@react-three/fiber", () => ({
  useFrame: (fn: FrameFn) => {
    mockFrames.push(fn);
  },
}));

let track: SimTrack;
beforeAll(() => {
  track = simulate(titanic, titanic.realNight);
});
beforeEach(() => {
  mockFrames.length = 0;
  resetWalkInput();
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
  render(<WalkRunner store={store} runtime={runtime} spec={titanic} />);
  const frame = (dt = 1 / 60) => {
    runtime.frame = sampleTrack(track, store.getState().t);
    const fn = mockFrames[mockFrames.length - 1];
    fn({ clock: { elapsedTime: 0 } }, dt);
  };
  const hooks = sceneHooks(store, runtime);
  return { store, runtime, frame, hooks };
}

describe("walking in the scene", () => {
  it("stands on the boat deck at the start and walks with the keys", () => {
    const { store, runtime, frame } = setup();
    act(() => store.getState().startWalk());
    frame();
    expect(runtime.walkInfo).toMatchObject({
      phase: "deck",
      part: "whole",
      area: "boat-deck",
    });
    expect(runtime.walker).not.toBeNull();
    const x0 = runtime.walkInfo!.x;
    fireEvent.keyDown(window, { key: "w" });
    expect(walkInput.forward).toBe(1);
    for (let i = 0; i < 60; i += 1) frame();
    fireEvent.keyUp(window, { key: "w" });
    expect(walkInput.forward).toBe(0);
    // Spawned facing aft or forward: a second of walking moves about 1.4 m.
    expect(Math.abs(runtime.walkInfo!.x - x0)).toBeGreaterThan(1);
  });

  it("floats when the boat deck is under and comes back on a seek", () => {
    const { store, runtime, frame } = setup();
    act(() => store.getState().startWalk());
    frame();
    act(() => store.getState().seek((track.sankAtT as number) + 60));
    frame();
    expect(store.getState().walk.phase).toBe("water");
    expect(runtime.walkInfo?.phase).toBe("water");
    // Floating on the swell, eyes just over the sea.
    expect(runtime.walker!.pos[1]).toBeGreaterThan(0);
    expect(runtime.walker!.pos[1]).toBeLessThan(0.6);

    act(() => store.getState().setLookUnder(true));
    frame();
    expect(runtime.walkLookUnder).toBe(true);
    expect(runtime.walker!.pos[1]).toBe(-1);

    act(() => store.getState().seek(0));
    frame();
    expect(store.getState().walk.phase).toBe("deck");
    expect(runtime.walkInfo?.phase).toBe("deck");
    expect(runtime.walkLookUnder).toBe(false);
  });

  it("the Hud's arrows walk instead of seeking while walking", () => {
    const { store } = setup();
    render(<Hud store={store} onBack={() => {}} runId={1} />);
    act(() => store.getState().seek(600));
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(store.getState().t).toBe(540);
    act(() => store.getState().startWalk());
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(store.getState().t).toBe(540);
    expect(walkInput.strafe).toBe(-1);
    fireEvent.keyUp(document.body, { key: "ArrowLeft" });
  });

  it("levels the look out after coming up from Look under", () => {
    const { store, runtime, frame } = setup();
    act(() => store.getState().startWalk());
    frame();
    act(() => store.getState().seek((track.sankAtT as number) - 30));
    frame();
    expect(store.getState().walk.phase).toBe("water");
    act(() => store.getState().setLookUnder(true));
    for (let i = 0; i < 120; i += 1) frame();
    expect(runtime.walker!.pitch).toBeLessThan(-0.1);
    act(() => store.getState().setLookUnder(false));
    for (let i = 0; i < 180; i += 1) frame();
    expect(Math.abs(runtime.walker!.pitch)).toBeLessThan(0.05);
  });

  it("keys on a focused button or a card do not walk", () => {
    const { store } = setup();
    act(() => store.getState().startWalk());
    const button = document.createElement("button");
    const card = document.createElement("div");
    card.setAttribute("role", "dialog");
    const inCard = document.createElement("span");
    card.appendChild(inCard);
    document.body.append(button, card);
    fireEvent.keyDown(button, { key: "ArrowUp" });
    fireEvent.keyDown(inCard, { key: "w" });
    expect(walkInput.forward).toBe(0);
    fireEvent.keyDown(document.body, { key: "w" });
    expect(walkInput.forward).toBe(1);
    fireEvent.keyUp(document.body, { key: "w" });
    button.remove();
    card.remove();
  });

  it("Back on deck with nowhere to stand keeps the speed", () => {
    const { store, runtime, frame } = setup();
    act(() => store.getState().startWalk());
    frame();
    // Long after she has gone: re-placing finds nowhere to stand.
    act(() => store.getState().seek((track.sankAtT as number) + 60));
    act(() => store.getState().setSpeed(100));
    frame();
    expect(store.getState().walk.phase).toBe("water");
    expect(store.getState().speed).toBe(100);
    act(() => store.getState().backOnDeck());
    frame();
    expect(store.getState().walk.phase).toBe("water");
    expect(runtime.walkInfo?.phase).toBe("water");
    expect(store.getState().speed).toBe(100);
  });

  it("stepping off her deck into the sea does change the speed", () => {
    const { store, runtime, frame } = setup();
    act(() => store.getState().startWalk());
    frame();
    act(() => store.getState().setSpeed(100));
    // Her boat deck goes under as the night plays on.
    act(() => store.getState().seek((track.sankAtT as number) - 600));
    frame();
    expect(store.getState().walk.phase).toBe("deck");
    let t = store.getState().t;
    while (store.getState().walk.phase === "deck" && t < track.sankAtT!) {
      t += 2;
      store.setState({ t });
      frame();
    }
    expect(store.getState().walk.phase).toBe("water");
    expect(runtime.walkSplash).toBeGreaterThan(0);
    expect(store.getState().speed).toBeLessThan(100);
  });

  it("keys and held input do not move the walker under the end card", () => {
    const { store, runtime, frame } = setup();
    act(() => store.getState().startWalk());
    frame();
    const x0 = runtime.walkInfo!.x;
    runtime.walkInputOff = true;
    fireEvent.keyDown(document.body, { key: "w" });
    expect(walkInput.forward).toBe(0);
    walkInput.forward = 1;
    for (let i = 0; i < 60; i += 1) frame();
    expect(walkInput.forward).toBe(0);
    expect(Math.abs(runtime.walkInfo!.x - x0)).toBeLessThan(0.05);
    runtime.walkInputOff = false;
    fireEvent.keyDown(document.body, { key: "w" });
    expect(walkInput.forward).toBe(1);
    fireEvent.keyUp(document.body, { key: "w" });
  });

  it("does nothing off the walk camera and ignores keys", () => {
    const { runtime, frame } = setup();
    frame();
    expect(runtime.walker).toBeNull();
    fireEvent.keyDown(window, { key: "w" });
    expect(walkInput.forward).toBe(0);
  });

  it("leaving the walk clears the walker", () => {
    const { store, runtime, frame } = setup();
    act(() => store.getState().startWalk());
    frame();
    act(() => store.getState().leaveWalk());
    frame();
    expect(runtime.walker).toBeNull();
    expect(runtime.walkInfo).toBeNull();
  });

  it("walks in through the starboard staircase door and out again", () => {
    const { store, runtime, frame, hooks } = setup();
    act(() => store.getState().startWalk());
    frame();
    expect(runtime.walkInside).toBe(false);
    expect(hooks.getWalk()).toMatchObject({ area: "boat-deck", inside: false });
    // On the boat deck just outboard of the door, facing her house (port).
    hooks.placeWalk("boat-deck", 35.5, -7, Math.PI / 2);
    frame();
    expect(runtime.walkInfo).toMatchObject({ area: "boat-deck", x: 35.5 });
    walkInput.forward = 1;
    for (let i = 0; i < 60 && !runtime.walkInside; i += 1) frame();
    walkInput.forward = 0;
    expect(runtime.walkInside).toBe(true);
    expect(runtime.walkRoom).toBe("gs-boat");
    expect(runtime.walkCameInBy).toBe("gs-door-starboard");
    expect(runtime.walkInfo).toMatchObject({ inside: true, area: "gs-boat" });
    expect(hooks.getWalk()).toMatchObject({ area: "gs-boat", inside: true });

    // Go outside: the door she came in by, on the deck, facing out.
    hooks.goOutside();
    frame();
    expect(runtime.walkInside).toBe(false);
    expect(runtime.walkRoom).toBe("boat-deck");
    expect(runtime.walkInfo).toMatchObject({ area: "boat-deck", x: 35.5 });
    expect(runtime.walkInfo!.y).toBeCloseTo(-5.45, 3);
    expect(walkInput.outside).toBeFalsy();
  });

  it("the door button takes you in from within reach, not from afar", () => {
    const { store, runtime, frame, hooks } = setup();
    act(() => store.getState().startWalk());
    frame();
    // The spawn is about 10 m from the nearest door.
    hooks.enterDoor();
    frame();
    expect(runtime.walkInside).toBe(false);
    expect(walkInput.door).toBeFalsy();
    hooks.placeWalk("boat-deck", 33, 6.5, 0);
    frame();
    hooks.enterDoor();
    frame();
    expect(runtime.walkInside).toBe(true);
    expect(runtime.walkRoom).toBe("gs-boat");
    expect(runtime.walkCameInBy).toBe("gs-door-port");
    // A named door from anywhere (the test hook).
    hooks.goOutside();
    frame();
    hooks.enterDoor("third-class-door");
    frame();
    expect(runtime.walkRoom).toBe("third-stairs-c");
    expect(runtime.walkCameInBy).toBe("third-class-door");
  });

  it("walkDoor is a door index in reach, and -1 inside or not walking", () => {
    const { store, runtime, frame, hooks } = setup();
    act(() => store.getState().startWalk());
    frame(0.3);
    expect(runtime.walkDoor).toBe(-1); // the spawn is far from every door
    hooks.placeWalk("boat-deck", 33, 6.5, 0);
    frame(0.3);
    frame(0.3);
    expect(runtime.walkDoor).toBeGreaterThanOrEqual(0);
    hooks.enterDoor();
    frame(0.3);
    expect(runtime.walkInside).toBe(true);
    frame(0.3);
    expect(runtime.walkDoor).toBe(-1);
    hooks.goOutside();
    frame(0.3);
    frame(0.3);
    expect(runtime.walkDoor).toBeGreaterThanOrEqual(0);
    act(() => store.getState().leaveWalk());
    frame(0.3);
    expect(runtime.walkDoor).toBe(-1);
  });

  it("the lift takes you from B deck to E deck and bumps the wipe", () => {
    const { store, runtime, frame, hooks } = setup();
    act(() => store.getState().startWalk());
    frame();
    hooks.placeWalk("lift-b", 41.75, -4.6, 0);
    frame();
    expect(runtime.walkRoom).toBe("lift-b");
    const lift0 = runtime.walkLift;
    walkInput.forward = 1;
    for (let i = 0; i < 30 && runtime.walkRoom === "lift-b"; i += 1) frame();
    walkInput.forward = 0;
    expect(runtime.walkRoom).toBe("lift-e");
    expect(runtime.walkLift).toBe(lift0 + 1);
    expect(runtime.walkInside).toBe(true);
  });

  it("ignores the stick through the lift's dark wipe, then walks again", () => {
    const { store, runtime, frame, hooks } = setup();
    act(() => store.getState().startWalk());
    frame();
    hooks.placeWalk("lift-b", 41.75, -4.6, 0);
    frame();
    walkInput.forward = 1;
    for (let i = 0; i < 30 && runtime.walkRoom === "lift-b"; i += 1) frame();
    expect(runtime.walkRoom).toBe("lift-e");
    // Still held forward: for most of a second nobody moves.
    const at = () => [runtime.walkInfo!.x, runtime.walkInfo!.y];
    const p0 = at();
    for (let i = 0; i < 40; i += 1) frame();
    expect(at()).toEqual(p0);
    // After the wipe the stick walks again (out of the car, into E deck).
    walkInput.forward = 0;
    walkInput.strafe = 1;
    for (let i = 0; i < 60; i += 1) frame();
    walkInput.strafe = 0;
    expect(at()).not.toEqual(p0);
  });

  it("inside when she breaks: a splash, floating in the sea beside her", () => {
    const { store, runtime, frame, hooks } = setup();
    act(() => store.getState().startWalk());
    frame();
    const broke = track.brokeAtT as number;
    store.setState({ t: broke - 30 });
    frame();
    hooks.placeWalk("gs-boat", 37, -4, 0);
    frame();
    expect(runtime.walkInside).toBe(true);
    const splashes = runtime.walkSplash;
    store.setState({ t: broke + 1 });
    frame();
    expect(store.getState().walk.phase).toBe("water");
    expect(runtime.walkSplash).toBe(splashes + 1);
    expect(runtime.walkInside).toBe(false);
    expect(runtime.walkRoom).toBeNull();
    expect(runtime.walkInfo?.phase).toBe("water");
  });

  it("inside at a 30° list she stays inside (only her break closes the Titanic's rooms)", () => {
    const { store, runtime, hooks } = setup();
    act(() => store.getState().startWalk());
    store.setState({ t: 100 });
    const leaning = () => ({
      ...sampleTrack(track, store.getState().t),
      listDeg: 30,
    });
    const step = () => {
      runtime.frame = leaning();
      mockFrames[mockFrames.length - 1]({ clock: { elapsedTime: 0 } }, 1 / 60);
    };
    step();
    hooks.placeWalk("gs-boat", 37, -4, 0);
    step();
    expect(runtime.walkInside).toBe(true);
    for (let i = 0; i < 30; i += 1) step();
    expect(runtime.walkInside).toBe(true);
    expect(runtime.walkRoom).toBe("gs-boat");
    expect(store.getState().walk.phase).toBe("deck");
  });

  it("washed out of a flooded room into the sea", () => {
    const { store, runtime, frame, hooks } = setup();
    act(() => store.getState().startWalk());
    frame();
    // 0:50 AM: the third-class cabin is over the waist.
    store.setState({ t: 70 * 60 });
    frame();
    hooks.placeWalk("third-cabin", 74.8, 7.0, 0);
    const splashes = runtime.walkSplash;
    frame();
    expect(store.getState().walk.phase).toBe("water");
    expect(runtime.walkSplash).toBe(splashes + 1);
    expect(runtime.walkInside).toBe(false);
  });

  it("reads a drawn room's eased water level, its target when not drawn", () => {
    const { store, runtime, frame, hooks } = setup();
    act(() => store.getState().startWalk());
    // 12:20 AM: Scotland Road at x 20 is still dry.
    store.setState({ t: 40 * 60 });
    frame();
    hooks.placeWalk("scotland-road", 20, 0, 0);
    frame();
    expect(runtime.walkInside).toBe(true);
    const atTarget = runtime.walkInfo!.depthM;
    expect(atTarget).toBeLessThan(0);
    // Interior's eased level for the room: the walker's depth follows it.
    const slot = new Map([["scotland-road", 0]]);
    const lv = {
      slot,
      shown: new Float64Array([-0.4]),
      drawn: new Uint8Array([1]),
    };
    runtime.interiorLevels = lv;
    frame(0);
    expect(runtime.walkInfo!.depthM).toBeCloseTo(atTarget - 0.4, 3);
    // Not drawn: the target (the sea), whatever was shown before.
    lv.drawn[0] = 0;
    frame(0);
    expect(runtime.walkInfo!.depthM).toBeCloseTo(atTarget, 3);
  });

  it("a deck door does not open after the break, nor the button", () => {
    const { store, runtime, frame, hooks } = setup();
    act(() => store.getState().startWalk());
    store.setState({ t: (track.brokeAtT as number) + 5 });
    frame();
    // Standing by the door on her deck (or already in the sea).
    hooks.placeWalk("boat-deck", 33, 6.5, 0);
    frame();
    hooks.enterDoor("gs-door-port");
    frame();
    expect(runtime.walkInside).toBe(false);
    expect(runtime.walkRoom).not.toBe("gs-boat");
  });
});

describe("walking the Concordia as she leans", () => {
  const DEG = Math.PI / 180;
  /** A frame of her listing `listDeg` (synthetic: keyed on her heel). */
  function herFrame(listDeg: number, t = 0): SimFrame {
    return {
      t,
      realT: t,
      bodies: [
        {
          part: "whole",
          x: 0,
          y: 0,
          z: -concordia.draught,
          pitch: 0,
          roll: listDeg * DEG,
          yaw: 0,
        },
      ],
      water: concordia.compartments.map(() => 0),
      waterAboardT: 0,
      trimDeg: 0,
      listDeg,
      power: 1,
      groundedParts: [],
    };
  }

  function setupHer() {
    const herTrack: SimTrack = {
      frames: [herFrame(0), herFrame(0, 5000)],
      events: [],
      outcome: "aground",
      sankAtT: null,
      brokeAtT: null,
      breakX: null,
      endT: 5000,
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
    render(<WalkRunner store={store} runtime={runtime} spec={concordia} />);
    const frame = (listDeg: number, dt = 1 / 60) => {
      runtime.frame = herFrame(listDeg, store.getState().t);
      const fn = mockFrames[mockFrames.length - 1];
      fn({ clock: { elapsedTime: 0 } }, dt);
    };
    return { store, runtime, frame };
  }

  it("at 39° she is still walked; past 40° the walker slides off into the sea on her low side", () => {
    const { store, runtime, frame } = setupHer();
    act(() => store.getState().startWalk());
    for (let i = 0; i < 30; i += 1) frame(39);
    expect(store.getState().walk.phase).toBe("deck");
    expect(runtime.walkInfo?.phase).toBe("deck");
    const splashes = runtime.walkSplash;
    frame(40.1);
    expect(store.getState().walk.phase).toBe("water");
    expect(runtime.walkInfo?.phase).toBe("water");
    expect(runtime.walkSplash).toBe(splashes + 1);
    // On her low (starboard) side, clear of her hull and superstructure.
    const pose = herFrame(40.1).bodies[0];
    const info = runtime.walkInfo!;
    const ship = earthToShip(pose, [info.x, info.y, 0]);
    expect(ship[1]).toBeLessThan(0);
    // Facing out to sea, away from her (starboard: −π/2 off her heading).
    expect(runtime.walker!.yaw).toBeCloseTo(pose.yaw - Math.PI / 2, 9);
    expect(
      hullClearanceM(info.x, info.y, [
        { pose, spec: concordia, superstructure: concordia.superstructure },
      ])
    ).toBeGreaterThan(0);
    // Back on deck cannot put them back on her.
    for (let i = 0; i < 30; i += 1) frame(40.1);
    expect(runtime.walkCanReboard).toBe(false);
    act(() => store.getState().backOnDeck());
    frame(40.1);
    expect(store.getState().walk.phase).toBe("water");
    // A seek to before 40° stands them on her spawn again.
    act(() => store.getState().seek(100));
    frame(39);
    expect(store.getState().walk.phase).toBe("deck");
    expect(runtime.walkInfo).toMatchObject({
      phase: "deck",
      area: "pool-hall",
    });
  });

  it("inside her at 30° the rooms close: walked out onto her deck at a door's outside end, not into the sea", () => {
    const { store, runtime, frame } = setupHer();
    const hooks = sceneHooks(store, runtime);
    act(() => store.getState().startWalk());
    frame(29.9);
    hooks.placeWalk("lobby-1", 59.5, -9.9, 0);
    frame(29.9);
    expect(runtime.walkInside).toBe(true);
    expect(runtime.walkRoom).toBe("lobby-1");
    // Still open at 29.9°: the walker stays put.
    for (let i = 0; i < 10; i += 1) frame(29.9);
    expect(runtime.walkRoom).toBe("lobby-1");
    const splashes = runtime.walkSplash;
    frame(30);
    expect(store.getState().walk.phase).toBe("deck");
    expect(runtime.walkInside).toBe(false);
    expect(runtime.walkSplash).toBe(splashes);
    const info = runtime.walkInfo!;
    expect(info.phase).toBe("deck");
    const map = walkMapFor("concordia") as WalkMap;
    const door = map.stairs.find(
      (st) =>
        st.kind === "door" &&
        st.from.area === info.area &&
        Math.hypot(st.from.at[0] - info.x, st.from.at[1] - info.y) < 0.05
    );
    expect(door).toBeDefined();
    // Her deck carries on: they can walk there, and the door stays shut.
    for (let i = 0; i < 30; i += 1) frame(30);
    expect(runtime.walkInside).toBe(false);
    expect(runtime.walkDoor).toBe(-1);
    hooks.enterDoor(door!.id);
    frame(30);
    expect(runtime.walkInside).toBe(false);
  });

  it("her lean slides the walker downhill, but not under the end card", () => {
    const { store, runtime, frame } = setupHer();
    act(() => store.getState().startWalk());
    frame(30);
    const y0 = runtime.walkInfo!.y;
    runtime.walkInputOff = true;
    for (let i = 0; i < 60; i += 1) frame(30);
    expect(runtime.walkInfo!.y).toBe(y0);
    runtime.walkInputOff = false;
    for (let i = 0; i < 60; i += 1) frame(30);
    // About 0.8 m to starboard (downhill) in a second.
    expect(runtime.walkInfo!.y).toBeLessThan(y0 - 0.5);
  });

  /** Stands the walker in lift-a's car at `deck`, facing aft. */
  function inCar(
    hooks: ReturnType<typeof sceneHooks>,
    frame: (listDeg: number, dt?: number) => void,
    deck: string,
    listDeg = 0
  ) {
    hooks.placeWalk(`lift-a@${deck}`, 63.1, 2.6, Math.PI);
    frame(listDeg);
  }

  /** The deck door whose outside end the walker stands on, if any. */
  function onDoorOutside(info: { area: string | null; x: number; y: number }) {
    const map = walkMapFor("concordia") as WalkMap;
    return map.stairs.find(
      (st) =>
        st.kind === "door" &&
        st.from.area === info.area &&
        Math.hypot(st.from.at[0] - info.x, st.from.at[1] - info.y) < 0.05
    );
  }

  it.each([30, -30])(
    "inside her at %s° the rooms close: walked out at a door's outside end, facing along her deck",
    (heel) => {
      const { store, runtime, frame } = setupHer();
      const hooks = sceneHooks(store, runtime);
      act(() => store.getState().startWalk());
      frame(0);
      hooks.placeWalk("atrium-4", 72, 7.5, 0);
      frame(heel * 0.99);
      expect(runtime.walkRoom).toBe("atrium-4");
      frame(heel);
      expect(runtime.walkInside).toBe(false);
      const info = runtime.walkInfo!;
      expect(onDoorOutside(info)).toBeDefined();
      // Not square into the lifeboat outside the door: along her deck.
      expect(Math.abs(Math.sin(runtime.walker!.yaw))).toBeLessThan(0.05);
    }
  );

  it("rides lift-a from deck 3 up to 4 with the buttons' input, then walks out", () => {
    const { store, runtime, frame } = setupHer();
    const hooks = sceneHooks(store, runtime);
    act(() => store.getState().startWalk());
    frame(0);
    inCar(hooks, frame, "3");
    expect(runtime.walkLiftDirs).toBe(LIFT_UP | LIFT_DOWN);
    hooks.rideLift("up");
    frame(0);
    expect(hooks.getWalk()!.ride).toBe("lift-a");
    expect(runtime.walkRide).toMatchObject({ lift: "lift-a", from: 1, to: 2 });
    expect(runtime.walkLiftDirs).toBe(0);
    // Without a wipe (the Titanic's): her ride is seen through the glass.
    const wipes = runtime.walkLift;
    let z = runtime.walkRide!.z;
    for (let i = 0; i < 600 && runtime.walkRide; i += 1) {
      frame(0);
      if (runtime.walkRide) {
        expect(runtime.walkRide.z).toBeGreaterThanOrEqual(z);
        z = runtime.walkRide.z;
      }
    }
    expect(runtime.walkRide).toBeNull();
    expect(hooks.getWalk()!.ride).toBeNull();
    expect(runtime.walkRoom).toBe("lift-a@4");
    expect(runtime.walkLift).toBe(wipes);
    // Out through the car's forward door onto the gallery.
    hooks.turnWalk(-Math.PI);
    hooks.setWalkInput(1, 0);
    for (let i = 0; i < 60 && runtime.walkRoom !== "atrium-4"; i += 1) frame(0);
    hooks.setWalkInput(0, 0);
    expect(runtime.walkRoom).toBe("atrium-4");
  });

  it("her drift and the stick do not move a rider", () => {
    const { store, runtime, frame } = setupHer();
    const hooks = sceneHooks(store, runtime);
    act(() => store.getState().startWalk());
    frame(20);
    inCar(hooks, frame, "0", 20);
    hooks.rideLift("up");
    frame(20);
    const { x, y } = runtime.walkInfo!;
    hooks.setWalkInput(1, 1);
    for (let i = 0; i < 90; i += 1) frame(20);
    hooks.setWalkInput(0, 0);
    expect(runtime.walkRide).not.toBeNull();
    expect([runtime.walkInfo!.x, runtime.walkInfo!.y]).toEqual([x, y]);
  });

  it("never rides to a flooded stop: ▼ hides and the button does nothing", () => {
    const { store, runtime, frame } = setupHer();
    const hooks = sceneHooks(store, runtime);
    act(() => store.getState().startWalk());
    frame(0);
    inCar(hooks, frame, "3");
    expect(runtime.walkLiftDirs & LIFT_DOWN).toBe(LIFT_DOWN);
    // The low lobby (and so its car) 0.6 m deep: over the knee.
    const map = walkMapFor("concordia") as WalkMap;
    const pose = herFrame(0).bodies[0];
    const floor = shipToEarth(pose, [
      63.1,
      2.6,
      floorZ(map, "lift-a@0", 63.1, concordia, 2.6),
    ])[2];
    runtime.interiorLevels = {
      slot: new Map([["lobby-1", 0]]),
      shown: new Float64Array([floor + 0.6]),
      drawn: new Uint8Array([1]),
    };
    frame(0);
    expect(runtime.walkLiftDirs).toBe(LIFT_UP);
    hooks.rideLift("down");
    frame(0);
    expect(runtime.walkRide).toBeNull();
    expect(runtime.walkRoom).toBe("lift-a@3");
    // Up still goes.
    hooks.rideLift("up");
    frame(0);
    expect(runtime.walkRide).not.toBeNull();
  });

  it("a seek mid-ride ends it: placed on her spawn, ride unset, eyes over its floor", () => {
    const { store, runtime, frame } = setupHer();
    const hooks = sceneHooks(store, runtime);
    act(() => store.getState().startWalk());
    frame(0);
    inCar(hooks, frame, "0");
    hooks.rideLift("up");
    for (let i = 0; i < 240; i += 1) frame(0);
    expect(runtime.walkRide).not.toBeNull();
    act(() => store.getState().seek(200));
    frame(0);
    expect(runtime.walkRide).toBeNull();
    expect(hooks.getWalk()).toMatchObject({ ride: null, area: "pool-hall" });
    const map = walkMapFor("concordia") as WalkMap;
    const info = runtime.walkInfo!;
    const pose = herFrame(0).bodies[0];
    const eyes = shipToThree(pose, [
      info.x,
      info.y,
      floorZ(map, "pool-hall", info.x, concordia, info.y) + 1.6,
    ]);
    expect(runtime.walker!.pos[1]).toBeCloseTo(eyes[1], 6);
    // Walking again (the stick moves them).
    const [x0, y0] = [info.x, info.y];
    hooks.setWalkInput(1, 0);
    for (let i = 0; i < 30; i += 1) frame(0);
    hooks.setWalkInput(0, 0);
    expect(
      Math.hypot(runtime.walkInfo!.x - x0, runtime.walkInfo!.y - y0)
    ).toBeGreaterThan(0.5);
  });

  it("Go outside mid-ride ends it: out at a deck door, ride unset", () => {
    const { store, runtime, frame } = setupHer();
    const hooks = sceneHooks(store, runtime);
    act(() => store.getState().startWalk());
    frame(0);
    inCar(hooks, frame, "7");
    hooks.rideLift("down");
    for (let i = 0; i < 120; i += 1) frame(0);
    expect(runtime.walkRide).not.toBeNull();
    hooks.goOutside();
    frame(0);
    expect(runtime.walkRide).toBeNull();
    expect(runtime.walkInside).toBe(false);
    expect(hooks.getWalk()!.ride).toBeNull();
    expect(onDoorOutside(runtime.walkInfo!)).toBeDefined();
  });

  it("the rooms closing at 30° mid-ride end it: out at a deck door, ride unset", () => {
    const { store, runtime, frame } = setupHer();
    const hooks = sceneHooks(store, runtime);
    act(() => store.getState().startWalk());
    frame(29);
    inCar(hooks, frame, "3", 29);
    hooks.rideLift("up");
    for (let i = 0; i < 60; i += 1) frame(29);
    expect(runtime.walkRide).not.toBeNull();
    const wipes = runtime.walkLift;
    frame(30);
    expect(runtime.walkRide).toBeNull();
    expect(runtime.walkInside).toBe(false);
    expect(runtime.walkLiftDirs).toBe(0);
    // Not a hard cut out of the moving car: the lift wipe, once.
    expect(runtime.walkLift).toBe(wipes + 1);
    for (let i = 0; i < 5; i += 1) frame(30);
    expect(runtime.walkLift).toBe(wipes + 1);
    const info = runtime.walkInfo!;
    expect(info.ride).toBeNull();
    expect(onDoorOutside(info)).toBeDefined();
    // The eyes stand over that deck's floor, not the car's ride height.
    const map = walkMapFor("concordia") as WalkMap;
    const pose = herFrame(30).bodies[0];
    const eyes = shipToThree(pose, [
      info.x,
      info.y,
      floorZ(map, info.area!, info.x, concordia, info.y) + 1.6,
    ]);
    for (let i = 0; i < 3; i += 1)
      expect(runtime.walker!.pos[i]).toBeCloseTo(eyes[i], 6);
  });

  it("the rooms closing mid-ride: the stick waits out the wipe, then walks", () => {
    const { store, runtime, frame } = setupHer();
    const hooks = sceneHooks(store, runtime);
    act(() => store.getState().startWalk());
    frame(29);
    inCar(hooks, frame, "3", 29);
    hooks.rideLift("up");
    for (let i = 0; i < 30; i += 1) frame(29);
    frame(30);
    const { x, y } = runtime.walkInfo!;
    hooks.setWalkInput(1, 0);
    // The wipe runs 0.9 s (frames are 1/60 s): still for its first half.
    for (let i = 0; i < 30; i += 1) frame(30);
    expect([runtime.walkInfo!.x, runtime.walkInfo!.y]).toEqual([x, y]);
    for (let i = 0; i < 60; i += 1) frame(30);
    hooks.setWalkInput(0, 0);
    expect(
      Math.hypot(runtime.walkInfo!.x - x, runtime.walkInfo!.y - y)
    ).toBeGreaterThan(0.3);
  });

  it("the rooms closing round a walker not riding: no wipe (as before)", () => {
    const { store, runtime, frame } = setupHer();
    const hooks = sceneHooks(store, runtime);
    act(() => store.getState().startWalk());
    frame(29);
    inCar(hooks, frame, "3", 29);
    const wipes = runtime.walkLift;
    frame(30);
    expect(runtime.walkInside).toBe(false);
    expect(runtime.walkLift).toBe(wipes);
  });

  it("Back on deck (a re-place) and placeWalk mid-ride end it too", () => {
    const { store, runtime, frame } = setupHer();
    const hooks = sceneHooks(store, runtime);
    act(() => store.getState().startWalk());
    frame(0);
    inCar(hooks, frame, "0");
    hooks.rideLift("up");
    for (let i = 0; i < 60; i += 1) frame(0);
    expect(runtime.walkRide).not.toBeNull();
    hooks.placeWalk("atrium-3", 66, 4, 0);
    frame(0);
    expect(runtime.walkRide).toBeNull();
    expect(runtime.walkRoom).toBe("atrium-3");
  });
});
