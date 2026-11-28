import { act, fireEvent, render, screen } from "@testing-library/react";
import { trackGame } from "@/lib/analytics/trackGame";
import { interiorFor, TITANIC_INTERIOR } from "@/lib/shipwreck/interior";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { simulate, type SimTrack } from "@/lib/shipwreck/sim";
import type { SimRunner } from "@/lib/shipwreck/sim/run";
import { resetWalkInput } from "@/lib/shipwreck/walk";
import { createSceneRuntime } from "@/components/shipwreck/scene/runtime";
import Hud from "../Hud";

/** Start inside (1.16): the camera picker's room buttons and the Walk pulse. */

jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));
jest.mock("@/lib/shipwreck/interior", () => {
  const actual = jest.requireActual("@/lib/shipwreck/interior");
  return { ...actual, interiorFor: jest.fn(actual.interiorFor) };
});

let track: SimTrack;
beforeAll(() => {
  track = simulate(titanic, titanic.realNight);
});
beforeEach(() => {
  resetWalkInput();
  window.localStorage.clear();
  (trackGame as jest.Mock).mockClear();
});

function setup(props: { runtime?: boolean; walked?: boolean } = {}) {
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
  const onWalked = jest.fn();
  render(
    <Hud
      store={store}
      onBack={() => {}}
      runId={1}
      runtime={props.runtime === false ? undefined : runtime}
      walked={props.walked}
      onWalked={onWalked}
    />
  );
  const openCameras = () =>
    fireEvent.click(screen.getByTestId("shipwreck-cameras-button"));
  return { store, runtime, onWalked, openCameras };
}

const roomButtons = () => screen.queryAllByTestId(/^shipwreck-room-/);

describe("the camera picker's rooms", () => {
  it("shows a picture button for each room beside Walk the deck, words only in the label", () => {
    const { openCameras } = setup();
    openCameras();
    const buttons = roomButtons();
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Walk inside: Grand Staircase",
      "Walk inside: Suite",
      "Walk inside: Third class cabin",
      "Walk inside: Scotland Road",
    ]);
    for (const b of buttons) {
      expect(b.textContent).toBe("");
      expect(b.querySelector("svg")).not.toBeNull();
    }
    // In one row right under Walk the deck in the picker.
    const walk = screen.getByTestId("shipwreck-camera-walk");
    const row = screen.getByTestId("shipwreck-rooms");
    expect(walk.nextElementSibling).toBe(row);
    expect(row.firstElementChild).toBe(buttons[0]);
  });

  it("tapping the Grand Staircase starts the walk standing in it", () => {
    const { store, runtime, onWalked, openCameras } = setup();
    openCameras();
    fireEvent.click(screen.getByTestId("shipwreck-room-grand-staircase"));
    expect(store.getState().camera).toBe("walk");
    expect(store.getState().walk.phase).toBe("deck");
    const gs = TITANIC_INTERIOR.entries!.find(
      (e) => e.id === "grand-staircase"
    )!;
    expect(runtime.walkPlace).toEqual({
      area: "gs-boat",
      x: gs.at[0],
      y: gs.at[1],
      yaw: gs.yaw,
    });
    expect(onWalked).toHaveBeenCalledTimes(1);
    expect(trackGame).toHaveBeenCalledTimes(1);
    expect(trackGame).toHaveBeenCalledWith("shipwreck_camera", {
      camera: "walk",
    });
    expect(screen.queryByTestId("shipwreck-cameras")).toBeNull();
  });

  it("does not place anyone when the walk did not start", () => {
    const { store, runtime, onWalked, openCameras } = setup();
    jest.spyOn(store.getState(), "startWalk").mockImplementation(() => {});
    openCameras();
    fireEvent.click(screen.getByTestId("shipwreck-room-suite"));
    expect(runtime.walkPlace).toBeNull();
    expect(onWalked).not.toHaveBeenCalled();
    expect(trackGame).not.toHaveBeenCalled();
  });

  it("hides them all after the break: only Walk the deck is left", () => {
    const { store, openCameras } = setup();
    const breakT = track.events.find((e) => e.kind === "breakup")!.t;
    act(() => store.getState().seek(breakT + 30));
    openCameras();
    expect(roomButtons()).toEqual([]);
    expect(screen.getByTestId("shipwreck-camera-walk")).toBeInTheDocument();
  });

  it("is not there for a ship without rooms", () => {
    (interiorFor as jest.Mock).mockReturnValue(null);
    try {
      const { openCameras } = setup();
      openCameras();
      expect(screen.getByTestId("shipwreck-camera-walk")).toBeInTheDocument();
      expect(roomButtons()).toEqual([]);
    } finally {
      (interiorFor as jest.Mock).mockImplementation(
        jest.requireActual("@/lib/shipwreck/interior").interiorFor
      );
    }
  });

  it("is not there without the scene's runtime", () => {
    const { openCameras } = setup({ runtime: false });
    openCameras();
    expect(roomButtons()).toEqual([]);
  });
});

describe("the caption under the picker", () => {
  it("is out of sight while the picker is open, and back after", () => {
    const { openCameras } = setup();
    const caption = screen.getByTestId("shipwreck-caption");
    const box = caption.parentElement!;
    expect(box.className).not.toContain("invisible");
    openCameras();
    expect(box.className).toContain("invisible");
    openCameras();
    expect(box.className).not.toContain("invisible");
  });
});

describe("the Walk button's pulse", () => {
  it("pulses until the save says they have walked", () => {
    setup({ walked: true });
    expect(screen.queryByTestId("shipwreck-walk-glow")).toBeNull();
  });

  it("a walk from the button tells the save", () => {
    const { onWalked } = setup();
    expect(screen.getByTestId("shipwreck-walk-glow")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("shipwreck-walk"));
    expect(onWalked).toHaveBeenCalledTimes(1);
  });

  it("a walk from the picker's Walk the deck tells the save", () => {
    const { onWalked, openCameras } = setup();
    openCameras();
    fireEvent.click(screen.getByTestId("shipwreck-camera-walk"));
    expect(onWalked).toHaveBeenCalledTimes(1);
  });
});
