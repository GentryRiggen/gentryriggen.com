import { act, fireEvent, render, screen } from "@testing-library/react";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import type { SimRunner } from "@/lib/shipwreck/sim/run";
import NightPanels, { resetPanelChoice } from "../NightPanels";

describe("NightPanels", () => {
  beforeEach(() => resetPanelChoice());

  it("starts closed at every width, even a wide iPad", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1133,
    });
    render(<NightPanels store={createPlaybackStore()} spec={titanic} />);
    expect(screen.queryByTestId("shipwreck-panel")).toBeNull();
  });

  it("keeps the player's choice for the next run", () => {
    const store = createPlaybackStore();
    const { unmount } = render(<NightPanels store={store} spec={titanic} />);
    fireEvent.click(screen.getByTestId("shipwreck-panel-button"));
    expect(screen.getByTestId("shipwreck-panel")).toBeInTheDocument();
    unmount();
    render(<NightPanels store={store} spec={titanic} />);
    expect(screen.getByTestId("shipwreck-panel")).toBeInTheDocument();
  });

  it("shows the Lusitania's holes in the water panel each at its own time", () => {
    // Her torpedo's two holes at 2:10 PM, the second explosion's two 8 s
    // later (Task 4 gated every ship's holes on their time).
    jest.useFakeTimers();
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
    const store = createPlaybackStore({ createRunner: () => idle });
    store.getState().start(lusitania, lusitania.realNight);
    render(<NightPanels store={store} spec={lusitania} />);
    fireEvent.click(screen.getByTestId("shipwreck-panel-button"));
    const holes = () =>
      [
        ...screen
          .getByTestId("shipwreck-panel")
          .querySelectorAll("polyline[data-hole]"),
      ].map((p) => p.getAttribute("data-hole"));
    const at = (t: number) => {
      act(() => {
        store.setState({ t });
        jest.advanceTimersByTime(300);
      });
      return holes();
    };
    // The pre-roll: none yet.
    expect(at(-20)).toEqual([]);
    const first = lusitania.realNight
      .filter((o) => (o.t ?? 0) === 0)
      .map((o) => o.compartmentId);
    expect(first.length).toBeGreaterThan(0);
    expect(at(1).sort()).toEqual([...first].sort());
    expect(at(7.9).sort()).toEqual([...first].sort());
    expect(at(8).sort()).toEqual(
      lusitania.realNight.map((o) => o.compartmentId).sort()
    );
    jest.useRealTimers();
  });
});
