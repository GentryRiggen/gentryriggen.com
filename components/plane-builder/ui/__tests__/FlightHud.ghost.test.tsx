import { act, render, screen } from "@testing-library/react";
import { newProgress } from "@/lib/plane-builder/economy/progress";
import { encodeGhost } from "@/lib/plane-builder/ghost/ghost";
import { LEVELS } from "@/lib/plane-builder/levels";
import { planeStats } from "@/lib/plane-builder/plane/stats";
import { launch } from "@/lib/plane-builder/sim/flight";
import { flightLive } from "@/lib/plane-builder/state/flightLive";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import FlightHud from "../FlightHud";
import { ghostSetting } from "../ghostSetting";

// The ghost flew 60 m/s: x = 60 * t, sampled every 0.1 s for 2 s.
const ghost = encodeGhost(
  2,
  Array.from({ length: 21 }, (_, i) => ({
    x: i * 6,
    y: 5,
    z: 0,
    heading: 0,
    pitch: 0,
    bank: 0,
  }))
);

function fly(time: number, x: number, finishTime: number | null = null) {
  const level = LEVELS.meadow;
  const state = launch(
    level,
    planeStats(level.plane, newProgress().levels.meadow.tiers),
    {
      pitch: 0.2,
      yaw: 0,
      power: 0.5,
    }
  );
  state.time = time;
  state.maxX = x;
  if (finishTime !== null) {
    state.finished = true;
    state.finishTime = finishTime;
  }
  act(() => {
    flightLive.set(state);
    flightLive.notify();
  });
}

beforeEach(() => {
  window.localStorage.clear();
  ghostSetting.resetMemory();
  usePlaneBuilderStore.setState(usePlaneBuilderStore.getInitialState(), true);
  const progress = newProgress();
  progress.ghosts = { meadow: ghost };
  usePlaneBuilderStore.setState({
    progress,
    levelId: "meadow",
    screen: "flight",
  });
});

afterEach(() => {
  flightLive.set(null);
});

describe("ghost readout", () => {
  it("says how far ahead of the ghost you are", () => {
    render(<FlightHud />);
    fly(0.5, 60);
    expect(screen.getByTestId("ghost-gap")).toHaveTextContent(
      "Ghost: +0.5s ahead"
    );
  });

  it("says how far behind", () => {
    render(<FlightHud />);
    fly(1.5, 60);
    expect(screen.getByTestId("ghost-gap")).toHaveTextContent(
      "Ghost: +0.5s behind"
    );
  });

  it("reads even for a gap too small to show", () => {
    render(<FlightHud />);
    fly(1.02, 60);
    expect(screen.getByTestId("ghost-gap")).toHaveTextContent("Ghost: even");
  });

  it("freezes at the finish instead of drifting through the runout", () => {
    render(<FlightHud />);
    // The ghost finished at 2 s; this plane crossed the line at 1.5 s and has
    // flown on to 4 s of sim time.
    fly(1.5, 120, 1.5);
    expect(screen.getByTestId("ghost-gap")).toHaveTextContent(
      "Ghost: +0.5s ahead"
    );
    fly(4, 400, 1.5);
    expect(screen.getByTestId("ghost-gap")).toHaveTextContent(
      "Ghost: +0.5s ahead"
    );
  });

  it("is hidden when ghosts are turned off", () => {
    ghostSetting.set(false);
    render(<FlightHud />);
    fly(0.5, 60);
    expect(screen.queryByTestId("ghost-gap")).not.toBeInTheDocument();
  });

  it("is hidden when the world has no ghost yet", () => {
    usePlaneBuilderStore.setState({ progress: newProgress() });
    render(<FlightHud />);
    fly(0.5, 60);
    expect(screen.queryByTestId("ghost-gap")).not.toBeInTheDocument();
  });

  it("shows the twist on a daily flight", () => {
    usePlaneBuilderStore.setState({
      daily: { date: "2026-10-30", world: "meadow", twist: "headwind" },
    });
    render(<FlightHud />);
    fly(0.5, 60);
    expect(screen.getByTestId("daily-twist")).toHaveTextContent(
      "Daily: Headwind"
    );
    // A daily races today's own best flight, not the world's ghost.
    expect(screen.queryByTestId("ghost-gap")).not.toBeInTheDocument();
  });
});
