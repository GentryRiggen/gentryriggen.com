import { act, render } from "@testing-library/react";
import { Group } from "three";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import type { SimRunner } from "@/lib/shipwreck/sim/run";
import { ShipOnStage } from "../ShipRig";
import { createSceneRuntime } from "../runtime";

jest.mock("@react-three/fiber", () => ({
  useFrame: () => {},
  useThree: () => ({ gl: { compile: () => {} }, scene: {}, camera: {} }),
}));

interface FakeModel {
  ship: string;
  breakX: number | null;
  dispose: jest.Mock;
  handles: { root: Group; setTime: () => void };
}
const mockBuilt: FakeModel[] = [];

jest.mock("../../model/shipModel", () => ({
  createTitanicModel: (
    spec: { id: string },
    opts: { breakX: number | null }
  ) => {
    const model = {
      ship: spec.id,
      breakX: opts.breakX,
      dispose: jest.fn(),
      handles: { root: new Group(), setTime: () => {} },
    };
    mockBuilt.push(model);
    return model;
  },
}));

/** r3f elements are unknown tags to the DOM renderer; swallow only those. */
const R3F_TAG_WARNING =
  /is unrecognized in this browser|incorrect casing|React does not recognize|non-boolean attribute/;
let errorSpy: jest.SpyInstance;
beforeEach(() => {
  mockBuilt.length = 0;
  jest.useFakeTimers();
  const real = console.error.bind(console);
  errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (!R3F_TAG_WARNING.test(String(args[0]))) real(...args);
  });
});
afterEach(() => {
  errorSpy.mockRestore();
  jest.useRealTimers();
});

const idle: SimRunner = {
  advance: () => false,
  done: false,
  progress: () => 0,
  track: () => ({
    frames: [],
    events: [],
    outcome: "sank",
    sankAtT: null,
    brokeAtT: null,
    breakX: null,
    endT: 0,
  }),
};

describe("the ship on the stage", () => {
  it("builds the chosen ship and disposes the other when she changes", () => {
    const store = createPlaybackStore({ createRunner: () => idle });
    const runtime = createSceneRuntime();
    render(<ShipOnStage store={store} runtime={runtime} />);
    expect(mockBuilt.map((m) => m.ship)).toEqual(["titanic"]);
    const first = mockBuilt[0];
    expect(runtime.whole?.root).toBe(first.handles.root);

    // The title: pick the Lusitania.
    act(() => store.getState().setShip("lusitania"));
    act(() => store.getState().start(lusitania, []));
    act(() => jest.runAllTimers());
    expect(mockBuilt.map((m) => m.ship)).toEqual(["titanic", "lusitania"]);
    expect(first.dispose).toHaveBeenCalledTimes(1);
    const second = mockBuilt[1];
    expect(second.dispose).not.toHaveBeenCalled();
    expect(runtime.whole?.root).toBe(second.handles.root);

    // Back to the title, and the Titanic again.
    act(() => store.getState().setShip("titanic"));
    act(() => store.getState().start(titanic, []));
    act(() => jest.runAllTimers());
    expect(mockBuilt.map((m) => m.ship)).toEqual([
      "titanic",
      "lusitania",
      "titanic",
    ]);
    expect(second.dispose).toHaveBeenCalledTimes(1);
    expect(mockBuilt[2].dispose).not.toHaveBeenCalled();
    expect(runtime.whole?.root).toBe(mockBuilt[2].handles.root);
    // No halves were built for a run that never broke.
    expect(mockBuilt.every((m) => m.breakX === null)).toBe(true);
  });
});
