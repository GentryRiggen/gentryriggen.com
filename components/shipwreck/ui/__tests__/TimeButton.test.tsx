import { act, fireEvent, render, screen } from "@testing-library/react";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import type { SimRunner } from "@/lib/shipwreck/sim/run";
import { SHIP_IDS } from "@/lib/shipwreck/ships";
import { timesOf } from "@/lib/shipwreck/times";
import Hud from "../Hud";
import { TIME_HELP_MS } from "../TimeButton";

const runner: SimRunner = {
  advance: () => true,
  done: true,
  progress: () => 1,
  track: () => ({
    frames: [],
    events: [],
    outcome: "sank",
    sankAtT: null,
    brokeAtT: null,
    breakX: null,
    endT: 1200,
  }),
};

function hud(ship: (typeof SHIP_IDS)[number]) {
  const store = createPlaybackStore({ createRunner: () => runner });
  store.getState().setShip(ship);
  render(<Hud store={store} onBack={() => {}} runId={1} />);
  return store;
}

const ids = (row: string) =>
  [
    ...screen
      .getByTestId(`shipwreck-time-${row}`)
      .querySelectorAll("[data-time]"),
  ].map((e) => e.getAttribute("data-time"));

describe("the time button (1.9)", () => {
  it.each(SHIP_IDS)(
    "%s: her real time alone on the anchor row, others to try below",
    (ship) => {
      hud(ship);
      const b = screen.getByTestId("shipwreck-time-button");
      expect(b.className).toMatch(/\bsize-16\b/);
      expect(b).toHaveAttribute("data-current", "real");
      fireEvent.click(b);
      expect(ids("real")).toEqual(["real"]);
      const fun = ids("fun");
      expect(fun).toEqual(
        timesOf(ship)
          .filter((o) => o.id !== "real")
          .map((o) => o.id)
      );
      expect(fun.length).toBeGreaterThanOrEqual(1);
      // Her real time is named for what it was.
      expect(
        screen
          .getAllByTestId("shipwreck-time")
          .find((e) => e.dataset.time === "real")
      ).toHaveAccessibleName(/^Time: Real: /);
    }
  );

  it("a tap changes the hour live and says it is just for fun; real brings it back", () => {
    jest.useFakeTimers();
    const store = hud("lusitania");
    fireEvent.click(screen.getByTestId("shipwreck-time-button"));
    const night = screen
      .getAllByTestId("shipwreck-time")
      .find((e) => e.dataset.time === "night")!;
    fireEvent.click(night);
    expect(store.getState().time).toBe("night");
    expect(night).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("shipwreck-time-help")).toHaveTextContent(
      "Just for fun"
    );
    act(() => jest.advanceTimersByTime(TIME_HELP_MS + 10));
    expect(screen.queryByTestId("shipwreck-time-help")).toBeNull();
    fireEvent.click(
      screen
        .getAllByTestId("shipwreck-time")
        .find((e) => e.dataset.time === "real")!
    );
    expect(store.getState().time).toBeNull();
    jest.useRealTimers();
  });

  it("a new ship starts at her real time again", () => {
    const store = hud("lusitania");
    store.getState().setTime("sunset");
    act(() => store.getState().setShip("titanic"));
    expect(store.getState().time).toBeNull();
  });

  it("the water row sets how light the water is, real water first", () => {
    const store = hud("titanic");
    fireEvent.click(screen.getByTestId("shipwreck-time-button"));
    const steps = screen.getAllByTestId("shipwreck-water-light");
    expect(steps.map((e) => e.dataset.level)).toEqual(["0", "1", "2"]);
    expect(steps[0]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(steps[2]);
    expect(store.getState().underLight).toBe(2);
    expect(steps[2]).toHaveAttribute("aria-pressed", "true");
  });
});
