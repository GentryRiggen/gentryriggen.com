import { act, render } from "@testing-library/react";
import { Group } from "three";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import type { SimRunner } from "@/lib/shipwreck/sim/run";
import { ShipOnStage, deckLightsOf } from "../ShipRig";
import { MAX_LAMPS } from "../runtime";
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

  it("disposes each old model going Fitzgerald → Lusitania → Titanic", () => {
    const store = createPlaybackStore({ createRunner: () => idle });
    const runtime = createSceneRuntime();
    act(() => store.getState().setShip("fitzgerald"));
    act(() => store.getState().start(fitzgerald, []));
    render(<ShipOnStage store={store} runtime={runtime} />);
    act(() => jest.runAllTimers());
    expect(mockBuilt.map((m) => m.ship)).toEqual(["fitzgerald"]);
    const fitz = mockBuilt[0];
    expect(runtime.whole?.root).toBe(fitz.handles.root);

    act(() => store.getState().setShip("lusitania"));
    act(() => store.getState().start(lusitania, []));
    act(() => jest.runAllTimers());
    expect(fitz.dispose).toHaveBeenCalledTimes(1);
    const lus = mockBuilt[1];
    expect(lus.ship).toBe("lusitania");
    expect(lus.dispose).not.toHaveBeenCalled();

    act(() => store.getState().setShip("titanic"));
    act(() => store.getState().start(titanic, []));
    act(() => jest.runAllTimers());
    expect(mockBuilt.map((m) => m.ship)).toEqual([
      "fitzgerald",
      "lusitania",
      "titanic",
    ]);
    expect(lus.dispose).toHaveBeenCalledTimes(1);
    expect(fitz.dispose).toHaveBeenCalledTimes(1);
    expect(mockBuilt[2].dispose).not.toHaveBeenCalled();
    expect(runtime.whole?.root).toBe(mockBuilt[2].handles.root);
  });
});

describe("her deck lights along the hatches (the storm's night)", () => {
  it("stand over her open deck, both sides, for the sea and spray only", () => {
    const lights = deckLightsOf(fitzgerald);
    expect(lights.length).toBeGreaterThanOrEqual(4);
    expect(lights.length).toBeLessThanOrEqual(MAX_LAMPS - 2);
    const deck = fitzgerald.openDeck!;
    for (const [x, y, z] of lights) {
      expect(x).toBeGreaterThan(deck.fromX);
      expect(x).toBeLessThan(deck.toX);
      expect(Math.abs(y)).toBeLessThan(fitzgerald.beam / 2);
      expect(z).toBeGreaterThan(fitzgerald.sheerZ(x));
    }
    expect(new Set(lights.map((l) => Math.sign(l[1])))).toEqual(
      new Set([1, -1])
    );
    expect(deckLightsOf(titanic)).toEqual([]);
    expect(deckLightsOf(lusitania)).toEqual([]);
  });
});
