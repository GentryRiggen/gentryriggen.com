import { act, fireEvent, render } from "@testing-library/react";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { sampleTrack, simulate, type SimTrack } from "@/lib/shipwreck/sim";
import type { SimRunner } from "@/lib/shipwreck/sim/run";
import { resetWalkInput, walkInput } from "@/lib/shipwreck/walk";
import Hud from "@/components/shipwreck/ui/Hud";
import { createSceneRuntime } from "../runtime";
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
  return { store, runtime, frame };
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
});
