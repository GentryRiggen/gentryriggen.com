import { act, render } from "@testing-library/react";
import { BufferGeometry, Group, LineBasicMaterial, LineSegments } from "three";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { britannic } from "@/lib/shipwreck/ships/britannic";
import { carpathia } from "@/lib/shipwreck/ships/carpathia";
import { concordia } from "@/lib/shipwreck/ships/concordia";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { poseidon } from "@/lib/shipwreck/ships/poseidon";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import type { SimRunner } from "@/lib/shipwreck/sim/run";
import type { SimEvent } from "@/lib/shipwreck/sim/events";
import {
  ShipOnStage,
  deckLightsOf,
  BLACKOUT_FLICKER_S,
  blackoutLights,
  dimRails,
} from "../ShipRig";
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
  handles: {
    root: Group;
    breakX: number | null;
    setTime: () => void;
    setLivery: jest.Mock;
    warmLiveries: jest.Mock;
  };
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
      handles: {
        root: new Group(),
        breakX: opts.breakX,
        setTime: () => {},
        setLivery: jest.fn(),
        warmLiveries: jest.fn((compile: () => void) => compile()),
      },
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

describe("switching to and from the Carpathia", () => {
  it("disposes the old model going Carpathia → Lusitania → Carpathia", () => {
    const store = createPlaybackStore({ createRunner: () => idle });
    const runtime = createSceneRuntime();
    act(() => store.getState().setShip("carpathia"));
    act(() => store.getState().start(carpathia, []));
    render(<ShipOnStage store={store} runtime={runtime} />);
    act(() => jest.runAllTimers());
    expect(mockBuilt.map((m) => m.ship)).toEqual(["carpathia"]);
    const first = mockBuilt[0];

    act(() => store.getState().setShip("lusitania"));
    act(() => store.getState().start(lusitania, []));
    act(() => jest.runAllTimers());
    expect(first.dispose).toHaveBeenCalledTimes(1);
    const lus = mockBuilt[1];
    expect(lus.ship).toBe("lusitania");

    act(() => store.getState().setShip("carpathia"));
    act(() => store.getState().start(carpathia, []));
    act(() => jest.runAllTimers());
    expect(mockBuilt.map((m) => m.ship)).toEqual([
      "carpathia",
      "lusitania",
      "carpathia",
    ]);
    expect(lus.dispose).toHaveBeenCalledTimes(1);
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(mockBuilt[2].dispose).not.toHaveBeenCalled();
    expect(runtime.whole?.root).toBe(mockBuilt[2].handles.root);
  });
});

describe("switching to and from the Costa Concordia", () => {
  it("builds her, then the Titanic, disposing her model", () => {
    const store = createPlaybackStore({ createRunner: () => idle });
    const runtime = createSceneRuntime();
    act(() => store.getState().setShip("concordia"));
    act(() => store.getState().start(concordia, []));
    render(<ShipOnStage store={store} runtime={runtime} />);
    act(() => jest.runAllTimers());
    expect(mockBuilt.map((m) => m.ship)).toEqual(["concordia"]);
    const first = mockBuilt[0];
    expect(runtime.whole?.root).toBe(first.handles.root);

    act(() => store.getState().setShip("titanic"));
    act(() => store.getState().start(titanic, []));
    act(() => jest.runAllTimers());
    expect(mockBuilt.map((m) => m.ship)).toEqual(["concordia", "titanic"]);
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(mockBuilt[1].dispose).not.toHaveBeenCalled();
    expect(runtime.whole?.root).toBe(mockBuilt[1].handles.root);
  });
});

describe("switching to and from the Poseidon", () => {
  it("title → Poseidon → back → Fitzgerald builds the right model and disposes the other", () => {
    const store = createPlaybackStore({ createRunner: () => idle });
    const runtime = createSceneRuntime();
    act(() => store.getState().setShip("poseidon"));
    act(() => store.getState().start(poseidon, [], { preview: true }));
    render(<ShipOnStage store={store} runtime={runtime} />);
    act(() => jest.runAllTimers());
    expect(mockBuilt.map((m) => m.ship)).toEqual(["poseidon"]);
    const first = mockBuilt[0];
    expect(first.dispose).not.toHaveBeenCalled();
    expect(runtime.whole?.root).toBe(first.handles.root);

    act(() => store.getState().setShip("fitzgerald"));
    act(() => store.getState().start(fitzgerald, [], { preview: true }));
    act(() => jest.runAllTimers());
    expect(mockBuilt.map((m) => m.ship)).toEqual(["poseidon", "fitzgerald"]);
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(mockBuilt[1].dispose).not.toHaveBeenCalled();
    expect(runtime.whole?.root).toBe(mockBuilt[1].handles.root);
  });
});

describe("her livery, switched live", () => {
  it("repaints the built model from the store, never rebuilding it", () => {
    const store = createPlaybackStore({ createRunner: () => idle });
    const runtime = createSceneRuntime();
    act(() => store.getState().setShip("carpathia"));
    act(() => store.getState().start(carpathia, []));
    render(<ShipOnStage store={store} runtime={runtime} />);
    act(() => jest.runAllTimers());
    const [model] = mockBuilt;
    // Built: painted in her default, her other paints' parts warmed.
    expect(model.handles.setLivery).toHaveBeenLastCalledWith("dazzle-1918");
    expect(model.handles.warmLiveries).toHaveBeenCalledTimes(1);
    act(() => store.getState().setLivery("cunard-1912"));
    expect(model.handles.setLivery).toHaveBeenLastCalledWith("cunard-1912");
    // An id she does not have: her default.
    act(() => store.getState().setLivery("war-1915"));
    expect(model.handles.setLivery).toHaveBeenLastCalledWith("dazzle-1918");
    expect(mockBuilt).toHaveLength(1);
    expect(model.dispose).not.toHaveBeenCalled();
  });

  it("warms her other paints on the halves too, once they are built", () => {
    // Her no-finisher What if breaks: the first paint swap after the break
    // must not wait on the halves' shaders or textures.
    const broken: SimRunner = {
      ...idle,
      track: () => ({ ...idle.track(), breakX: -20 }),
    };
    const store = createPlaybackStore({ createRunner: () => broken });
    const runtime = createSceneRuntime();
    act(() => store.getState().setShip("carpathia"));
    act(() => store.getState().start(carpathia, carpathia.realNight));
    act(() => store.getState().pump());
    render(<ShipOnStage store={store} runtime={runtime} />);
    act(() => jest.runAllTimers());
    const halves = mockBuilt.find((m) => m.breakX === -20);
    expect(halves).toBeDefined();
    expect(runtime.split?.root).toBe(halves!.handles.root);
    expect(halves!.handles.setLivery).toHaveBeenLastCalledWith("dazzle-1918");
    expect(halves!.handles.warmLiveries).toHaveBeenCalledTimes(1);
  });

  it("paints the Titanic in a fun paint, and her own for an id she lacks", () => {
    const store = createPlaybackStore({ createRunner: () => idle });
    const runtime = createSceneRuntime();
    render(<ShipOnStage store={store} runtime={runtime} />);
    act(() => store.getState().setLivery("fun-cunard"));
    expect(mockBuilt[0].handles.setLivery).toHaveBeenLastCalledWith(
      "fun-cunard"
    );
    act(() => store.getState().setLivery("cunard-1912"));
    expect(mockBuilt[0].handles.setLivery).toHaveBeenLastCalledWith(
      "white-star-1912"
    );
  });
});

describe("choosing the Britannic (1.4)", () => {
  it("title → Britannic → back → Titanic builds the right model and disposes the other", () => {
    const store = createPlaybackStore({ createRunner: () => idle });
    const runtime = createSceneRuntime();
    render(<ShipOnStage store={store} runtime={runtime} />);
    const first = mockBuilt[0];
    expect(first.ship).toBe("titanic");

    // The title: pick the Britannic, and her preview.
    act(() => store.getState().setShip("britannic"));
    act(() => store.getState().start(britannic, [], { endT: 5 }));
    act(() => jest.runAllTimers());
    expect(mockBuilt.map((m) => m.ship)).toEqual(["titanic", "britannic"]);
    expect(first.dispose).toHaveBeenCalledTimes(1);
    const brit = mockBuilt[1];
    expect(brit.dispose).not.toHaveBeenCalled();
    expect(runtime.whole?.root).toBe(brit.handles.root);

    // Her real morning, then back to the title and the Titanic.
    act(() => store.getState().start(britannic, britannic.realNight));
    act(() => jest.runAllTimers());
    expect(mockBuilt).toHaveLength(2);
    act(() => store.getState().setShip("titanic"));
    act(() => store.getState().start(titanic, []));
    act(() => jest.runAllTimers());
    expect(mockBuilt.map((m) => m.ship)).toEqual([
      "titanic",
      "britannic",
      "titanic",
    ]);
    expect(brit.dispose).toHaveBeenCalledTimes(1);
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

describe("her blackout (the Concordia's emergency lights)", () => {
  const ev = (t: number, kind: SimEvent["kind"]): SimEvent => ({
    t,
    realT: t,
    kind,
  });
  const track = { events: [ev(0, "collision"), ev(58, "lights-out")] };

  it("keeps her lit, no emergency panes, until lights-out (and on a seek back)", () => {
    const l = blackoutLights(concordia, track, 57, 1);
    expect(l).toEqual({ lit: 1, flicker: 0, emergency: 0 });
  });

  it("flickers briefly, then only her emergency panes at her level", () => {
    const during = blackoutLights(concordia, track, 59, 0.25);
    expect(during.flicker).toBeGreaterThan(0);
    expect(during.emergency).toBe(concordia.blackout!.emergencyLight);
    const after = blackoutLights(
      concordia,
      track,
      58 + BLACKOUT_FLICKER_S + 1,
      0.25
    );
    expect(after).toEqual({
      lit: 0,
      flicker: 0,
      emergency: concordia.blackout!.emergencyLight,
    });
  });

  it("leaves every other ship's lights as the frame's power", () => {
    for (const p of [1, 0.4, 0])
      expect(blackoutLights(titanic, track, 100, p)).toEqual({
        lit: p,
        flicker: p > 0 && p < 1 ? 0.6 : 0,
        emergency: 0,
      });
  });

  it("writes into the frame loop's scratch without allocating", () => {
    const into = { lit: 0, flicker: 0, emergency: 0 };
    expect(blackoutLights(concordia, track, 57, 1, into)).toBe(into);
    expect(into).toEqual({ lit: 1, flicker: 0, emergency: 0 });
    blackoutLights(concordia, track, 58 + BLACKOUT_FLICKER_S + 1, 1, into);
    expect(into.emergency).toBe(concordia.blackout!.emergencyLight);
    expect(into.lit).toBe(0);
  });
});

describe("her rails after the blackout", () => {
  it("dims the unlit rail lines to her light level", () => {
    const root = new Group();
    const mat = new LineBasicMaterial({ vertexColors: true });
    const lines = new LineSegments(new BufferGeometry(), mat);
    lines.name = "rails-and-rigging";
    root.add(lines);
    const model = { root };
    dimRails(model, 1);
    expect(mat.color.r).toBe(1);
    dimRails(model, concordia.blackout!.emergencyLight);
    expect(mat.color.r).toBeCloseTo(0.25, 6);
    expect(mat.color.b).toBeCloseTo(0.25, 6);
  });
});

describe("the Poseidon's lights (Task 9)", () => {
  it("puts her lit window rows on the sea: three a side, just outboard, at deck 3", () => {
    const lights = deckLightsOf(poseidon);
    expect(lights).toHaveLength(6);
    expect(lights.length).toBeLessThanOrEqual(MAX_LAMPS - 2);
    const deck3 = poseidon.decks.find((d) => d.name === "3")!.z;
    for (const [x, y, z] of lights) {
      expect(Math.abs(y)).toBeGreaterThan(poseidon.beam / 2);
      expect(z).toBeCloseTo(deck3, 1);
      expect(x).toBeGreaterThan(poseidon.stations[0].x);
      expect(x).toBeLessThan(poseidon.stations[poseidon.stations.length - 1].x);
    }
    expect(lights.filter(([, y]) => y > 0)).toHaveLength(3);
  });

  it("goes to her emergency mask at lights-out, none before it", () => {
    const out = 9.4;
    const track = {
      events: [{ kind: "lights-out", t: out, realT: out } as SimEvent],
    };
    expect(blackoutLights(poseidon, track, out - 1, 1)).toEqual({
      lit: 1,
      flicker: 0,
      emergency: 0,
    });
    const after = blackoutLights(
      poseidon,
      track,
      out + BLACKOUT_FLICKER_S + 1,
      0
    );
    expect(after.lit).toBe(0);
    expect(after.emergency).toBe(poseidon.blackout!.emergencyLight);
  });
});
