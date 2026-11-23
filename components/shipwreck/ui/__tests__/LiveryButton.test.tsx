import { act, fireEvent, render, screen } from "@testing-library/react";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { carpathia } from "@/lib/shipwreck/ships/carpathia";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import type { SimRunner } from "@/lib/shipwreck/sim/run";
import type { SimFrame } from "@/lib/shipwreck/sim/track";
import Hud from "../Hud";
import { LIVERY_HELP_MS } from "../LiveryButton";
import TitleScreen from "../TitleScreen";

function frame(t: number): SimFrame {
  return {
    t,
    realT: t,
    bodies: [{ part: "whole", x: 0, y: 0, z: 0, pitch: 0, roll: 0, yaw: 0 }],
    water: [],
    waterAboardT: 0,
    trimDeg: 0,
    listDeg: 0,
    power: 1,
    groundedParts: [],
  };
}
const runner: SimRunner = {
  advance: () => true,
  done: true,
  progress: () => 1,
  track: () => ({
    frames: [0, 600, 1200].map(frame),
    events: [],
    outcome: "sank",
    sankAtT: null,
    brokeAtT: null,
    breakX: null,
    endT: 1200,
  }),
};

function hud(ship: "titanic" | "fitzgerald" | "lusitania" | "carpathia") {
  const store = createPlaybackStore({ createRunner: () => runner });
  const onLivery = jest.fn();
  store.getState().setShip(ship);
  render(<Hud store={store} onBack={() => {}} runId={1} onLivery={onLivery} />);
  return { store, onLivery };
}

describe("the paint button in the HUD (R24)", () => {
  it.each(["titanic", "fitzgerald"] as const)(
    "is not there for a ship with one paint (%s)",
    (ship) => {
      hud(ship);
      expect(screen.queryByTestId("shipwreck-livery")).toBeNull();
    }
  );

  it("is a big picture button: a brush and the next paint's two swatches", () => {
    hud("carpathia");
    const b = screen.getByTestId("shipwreck-livery");
    // size-16: 64 px, over the 56 px floor.
    expect(b.className).toMatch(/\bsize-16\b/);
    expect(b).toHaveAccessibleName("Paint: Her 1912 Cunard colours");
    const swatches = b.querySelectorAll("[data-swatch]");
    expect([...swatches].map((s) => s.getAttribute("data-swatch"))).toEqual(
      carpathia.liveries![1].swatches.map(
        (c) => `#${c.toString(16).padStart(6, "0")}`
      )
    );
  });

  it("cycles her liveries, says what each is, and keeps the run going", () => {
    jest.useFakeTimers();
    const { store, onLivery } = hud("lusitania");
    act(() => {
      store.getState().start(lusitania, lusitania.realNight);
      store.getState().pump();
      store.getState().play();
      store.getState().tick(30, 0);
    });
    const before = store.getState();
    const b = screen.getByTestId("shipwreck-livery");
    expect(b).toHaveAccessibleName("Paint: Her first Cunard colours, 1907");

    fireEvent.click(b);
    const after = store.getState();
    expect(after.livery).toBe("cunard-1907");
    expect(onLivery).toHaveBeenLastCalledWith("cunard-1907");
    expect(after.t).toBe(before.t);
    expect(after.playing).toBe(true);
    expect(after.track).toBe(before.track);
    // It explains itself: the paint now, in words, for a while.
    expect(screen.getByTestId("shipwreck-livery-help")).toHaveTextContent(
      "Her first Cunard colours, 1907"
    );
    expect(b).toHaveAccessibleName("Paint: Her colours on 7 May 1915");
    act(() => jest.advanceTimersByTime(LIVERY_HELP_MS + 10));
    expect(screen.queryByTestId("shipwreck-livery-help")).toBeNull();

    fireEvent.click(b);
    expect(store.getState().livery).toBe("war-1915");
    expect(onLivery).toHaveBeenLastCalledWith("war-1915");
    jest.useRealTimers();
  });
});

describe("the paint button on the title", () => {
  it("is beside the choices for a ship with a choice, and paints her", () => {
    const onLivery = jest.fn();
    const { rerender } = render(
      <TitleScreen
        ship="carpathia"
        onShip={() => {}}
        onRealNight={() => {}}
        onWhatIf={() => {}}
        livery={null}
        onLivery={onLivery}
      />
    );
    fireEvent.click(screen.getByTestId("shipwreck-livery"));
    expect(onLivery).toHaveBeenCalledWith("cunard-1912");
    // Her picture's funnel follows her paint.
    rerender(
      <TitleScreen
        ship="carpathia"
        onShip={() => {}}
        onRealNight={() => {}}
        onWhatIf={() => {}}
        livery="cunard-1912"
        onLivery={onLivery}
      />
    );
    const funnel = screen
      .getByTestId("shipwreck-ship-picture-carpathia")
      .querySelector("[data-funnel]");
    expect(funnel).toHaveAttribute("fill", "#cc5a28");
    rerender(
      <TitleScreen
        ship="titanic"
        onShip={() => {}}
        onRealNight={() => {}}
        onWhatIf={() => {}}
        livery={null}
        onLivery={onLivery}
      />
    );
    expect(screen.queryByTestId("shipwreck-livery")).toBeNull();
  });
});
