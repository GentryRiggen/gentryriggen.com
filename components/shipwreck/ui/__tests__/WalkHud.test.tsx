import { act, fireEvent, render, screen } from "@testing-library/react";
import { trackGame } from "@/lib/analytics/trackGame";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { simulate, type SimTrack } from "@/lib/shipwreck/sim";
import type { SimRunner } from "@/lib/shipwreck/sim/run";
import { resetWalkInput, walkInput, walkMapFor } from "@/lib/shipwreck/walk";
import { createSceneRuntime } from "@/components/shipwreck/scene/runtime";
import Hud from "../Hud";
import WalkHud from "../WalkHud";

jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));
jest.mock("@/lib/shipwreck/walk", () => {
  const actual = jest.requireActual("@/lib/shipwreck/walk");
  return { ...actual, walkMapFor: jest.fn(actual.walkMapFor) };
});

// jsdom has no PointerEvent: a MouseEvent with a pointer id stands in.
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}
if (typeof window.PointerEvent === "undefined")
  (window as unknown as { PointerEvent: unknown }).PointerEvent =
    TestPointerEvent;

let track: SimTrack;
beforeAll(() => {
  track = simulate(titanic, titanic.realNight);
});
beforeEach(() => {
  jest.useFakeTimers();
  resetWalkInput();
  window.localStorage.clear();
  (trackGame as jest.Mock).mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

function makeStore(started = true) {
  const runner: SimRunner = {
    advance: () => true,
    done: true,
    progress: () => 1,
    track: () => track,
  };
  const store = createPlaybackStore({ createRunner: () => runner });
  if (started) {
    store.getState().start(titanic, titanic.realNight);
    store.getState().pump();
  }
  return store;
}

function setup(started = true) {
  const store = makeStore(started);
  const runtime = createSceneRuntime();
  const view = render(
    <>
      <WalkHud store={store} runtime={runtime} />
      <Hud store={store} onBack={() => {}} runId={1} />
    </>
  );
  const tick = () => act(() => jest.advanceTimersByTime(100));
  return { store, runtime, tick, ...view };
}

const walkButton = () => screen.queryByTestId("shipwreck-walk");

describe("the Walk button", () => {
  it("walk button disabled without a frame", () => {
    setup(false);
    expect(walkButton()).toBeDisabled();
  });

  it("is absent for a ship with no map", () => {
    (walkMapFor as jest.Mock).mockReturnValue(null);
    try {
      setup();
      expect(walkButton()).toBeNull();
    } finally {
      (walkMapFor as jest.Mock).mockImplementation(
        jest.requireActual("@/lib/shipwreck/walk").walkMapFor
      );
    }
  });

  it("is hidden under the end card", () => {
    const store = makeStore();
    render(<Hud store={store} onBack={() => {}} runId={1} hidden />);
    expect(walkButton()).toBeNull();
  });

  it("tapping it starts a walk, counts it once and stops the glow", () => {
    const { store } = setup();
    expect(screen.getByTestId("shipwreck-walk-glow")).toBeInTheDocument();
    fireEvent.click(walkButton()!);
    expect(store.getState().camera).toBe("walk");
    expect(store.getState().walk.phase).toBe("deck");
    expect(trackGame).toHaveBeenCalledWith("shipwreck_camera", {
      camera: "walk",
    });
    expect(window.localStorage.getItem("shipwreck:walk-seen")).toBe("1");
    act(() => store.getState().leaveWalk());
    expect(screen.queryByTestId("shipwreck-walk-glow")).toBeNull();
  });

  it("does not count a walk that did not start", () => {
    const { store } = setup();
    jest.spyOn(store.getState(), "startWalk").mockImplementation(() => {});
    fireEvent.click(walkButton()!);
    expect(trackGame).not.toHaveBeenCalled();
  });
});

describe("walking", () => {
  it("hides X-ray, places and cameras; shows Fly, the stick and the look layer", () => {
    const { store } = setup();
    expect(screen.getByTestId("shipwreck-xray")).toBeInTheDocument();
    fireEvent.click(walkButton()!);
    expect(screen.queryByTestId("shipwreck-xray")).toBeNull();
    expect(screen.queryByTestId("shipwreck-places-button")).toBeNull();
    expect(screen.queryByTestId("shipwreck-cameras-button")).toBeNull();
    expect(screen.getByTestId("shipwreck-play")).toBeInTheDocument();
    expect(screen.getByTestId("shipwreck-speed-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fly" })).toBeInTheDocument();
    expect(screen.getByTestId("shipwreck-walk-stick")).toBeInTheDocument();
    expect(screen.getByTestId("shipwreck-walk-look")).toBeInTheDocument();
    expect(store.getState().walk.phase).toBe("deck");
  });

  it("Fly calls leaveWalk", () => {
    const { store } = setup();
    fireEvent.click(walkButton()!);
    fireEvent.click(screen.getByRole("button", { name: "Fly" }));
    expect(store.getState().walk.phase).toBe("off");
    expect(store.getState().camera).toBe("orbit");
    expect(screen.queryByTestId("shipwreck-walk-stick")).toBeNull();
  });

  it("in water, Back on deck shows only when she can be boarded", () => {
    const { store, runtime, tick } = setup();
    fireEvent.click(walkButton()!);
    act(() => store.getState().wentInWater());
    runtime.walkCanReboard = false;
    tick();
    expect(screen.queryByRole("button", { name: "Back on deck" })).toBeNull();
    expect(screen.getByTestId("shipwreck-walk-stick")).toBeInTheDocument();
    runtime.walkCanReboard = true;
    tick();
    const back = screen.getByRole("button", { name: "Back on deck" });
    const seq = store.getState().walk.seq;
    fireEvent.click(back);
    expect(store.getState().walk.phase).toBe("deck");
    expect(store.getState().walk.seq).toBe(seq + 1);
  });

  it("Look under toggles setLookUnder", () => {
    const { store } = setup();
    fireEvent.click(walkButton()!);
    act(() => store.getState().wentInWater());
    const look = screen.getByRole("button", { name: "Look under the water" });
    expect(look).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(look);
    expect(store.getState().walk.lookUnder).toBe(true);
    const up = screen.getByRole("button", { name: "Come up" });
    expect(up).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(up);
    expect(store.getState().walk.lookUnder).toBe(false);
  });

  it("the stick walks, and unmounting it mid-drag zeroes walkInput", () => {
    const { store } = setup();
    fireEvent.click(walkButton()!);
    const stick = screen.getByTestId("shipwreck-walk-stick");
    stick.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 144, height: 144 }) as DOMRect;
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 72, clientY: 0 });
    expect(walkInput.forward).toBeGreaterThan(0.9);
    act(() => store.getState().leaveWalk());
    expect(walkInput.forward).toBe(0);
    expect(walkInput.strafe).toBe(0);
  });

  it("a stale pointer that cannot be captured still drags the stick and the view", () => {
    // jsdom has no pointer capture: one that throws, as a stale pointer does.
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    const had = Object.getOwnPropertyDescriptor(proto, "setPointerCapture");
    proto.setPointerCapture = () => {
      throw new DOMException("stale", "NotFoundError");
    };
    try {
      setup();
      fireEvent.click(walkButton()!);
      const stick = screen.getByTestId("shipwreck-walk-stick");
      stick.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 144, height: 144 }) as DOMRect;
      fireEvent.pointerDown(stick, { pointerId: 1, clientX: 72, clientY: 0 });
      expect(walkInput.forward).toBeGreaterThan(0.9);
      fireEvent.pointerMove(stick, { pointerId: 1, clientX: 72, clientY: 144 });
      expect(walkInput.forward).toBeLessThan(-0.9);
      const look = screen.getByTestId("shipwreck-walk-look");
      fireEvent.pointerDown(look, { pointerId: 2, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(look, { pointerId: 2, clientX: 120, clientY: 100 });
      expect(walkInput.lookDx).toBe(20);
    } finally {
      if (had) Object.defineProperty(proto, "setPointerCapture", had);
      else delete proto.setPointerCapture;
    }
  });

  it("hides the timeline's event marks while walking; the bar, play and speeds stay", () => {
    const { store } = setup();
    const marks = () => screen.queryAllByTestId(/^shipwreck-mark-/);
    expect(marks().length).toBeGreaterThan(0);
    fireEvent.click(walkButton()!);
    expect(marks()).toHaveLength(0);
    act(() => store.getState().wentInWater());
    expect(marks()).toHaveLength(0);
    expect(screen.getByTestId("shipwreck-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("shipwreck-play")).toBeInTheDocument();
    expect(screen.getByTestId("shipwreck-speed-1")).toBeInTheDocument();
    act(() => store.getState().leaveWalk());
    expect(marks().length).toBeGreaterThan(0);
  });

  it("dragging the look layer turns the view and fades the hint", () => {
    const { store } = setup();
    fireEvent.click(walkButton()!);
    const hint = screen.getByTestId("shipwreck-walk-hint");
    expect(hint.className).not.toMatch(/opacity-0/);
    const look = screen.getByTestId("shipwreck-walk-look");
    fireEvent.pointerDown(look, { pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(look, { pointerId: 2, clientX: 130, clientY: 90 });
    expect(walkInput.lookDx).toBe(30);
    expect(walkInput.lookDy).toBe(-10);
    fireEvent.pointerUp(look, { pointerId: 2, clientX: 130, clientY: 90 });
    expect(screen.getByTestId("shipwreck-walk-hint").className).toMatch(
      /opacity-0/
    );
    expect(store.getState().walk.phase).toBe("deck");
  });

  it("shows slide arrows at the downhill edge while sliding", () => {
    const { runtime, tick } = setup();
    fireEvent.click(walkButton()!);
    tick();
    expect(screen.queryByTestId("shipwreck-walk-slide")).toBeNull();
    runtime.walkSlide = 1;
    runtime.walkDownhill[0] = 1;
    runtime.walkDownhill[1] = 0;
    tick();
    expect(screen.getByTestId("shipwreck-walk-slide")).toHaveAttribute(
      "data-edge",
      "right"
    );
    runtime.walkSlide = 0;
    tick();
    expect(screen.queryByTestId("shipwreck-walk-slide")).toBeNull();
  });

  it("ripples once on going in", () => {
    const { store, runtime, tick } = setup();
    fireEvent.click(walkButton()!);
    tick();
    expect(screen.queryByTestId("shipwreck-walk-ripple")).toBeNull();
    runtime.walkSplash += 1;
    act(() => store.getState().wentInWater());
    tick();
    const ripple = screen.getByTestId("shipwreck-walk-ripple");
    expect(ripple.className).toMatch(/motion-reduce:hidden/);
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.queryByTestId("shipwreck-walk-ripple")).toBeNull();
  });

  it("every walk button is big, named, and shows no words", () => {
    const { store, runtime, tick, container } = setup();
    const check = () => {
      const buttons = [
        ...container.querySelectorAll<HTMLElement>("[data-walk-control]"),
      ];
      expect(buttons.length).toBeGreaterThan(0);
      for (const b of buttons) {
        expect(b.getAttribute("aria-label")).toBeTruthy();
        expect(b.className).toMatch(/\bsize-(1[6-9]|2\d|3\d)\b/);
        expect(b.textContent).toBe("");
      }
    };
    check();
    fireEvent.click(walkButton()!);
    check();
    act(() => store.getState().wentInWater());
    runtime.walkCanReboard = true;
    tick();
    check();
    expect(screen.getByTestId("shipwreck-walk-hud").textContent).toBe("");
  });
});
