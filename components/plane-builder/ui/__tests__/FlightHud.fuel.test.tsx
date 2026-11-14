import { act, render, screen } from "@testing-library/react";
import { newProgress } from "@/lib/plane-builder/economy/progress";
import { LEVELS } from "@/lib/plane-builder/levels";
import { planeStats } from "@/lib/plane-builder/plane/stats";
import { launch } from "@/lib/plane-builder/sim/flight";
import { flightLive } from "@/lib/plane-builder/state/flightLive";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import FlightHud from "../FlightHud";

const progress = newProgress();
// A plane with an engine, so it has fuel to show.
progress.levels.meadow.tiers = {
  ...progress.levels.meadow.tiers,
  engine: 1,
  fuel: 1,
};
const stats = planeStats(LEVELS.meadow.plane, progress.levels.meadow.tiers);

function fuelAt(share: number) {
  const state = launch(LEVELS.meadow, stats, { pitch: 0.2, yaw: 0, power: 1 });
  state.fuel = stats.fuel * share;
  act(() => {
    flightLive.set(state);
    flightLive.notify();
  });
}

beforeEach(() => {
  window.localStorage.clear();
  usePlaneBuilderStore.setState(usePlaneBuilderStore.getInitialState(), true);
  usePlaneBuilderStore.setState({
    progress,
    levelId: "meadow",
    screen: "flight",
  });
});

afterEach(() => {
  flightLive.set(null);
});

describe("fuel gauge", () => {
  it("shows how much fuel is left as a number", () => {
    expect(stats.thrust).toBeGreaterThan(0);
    render(<FlightHud />);
    fuelAt(0.8);
    expect(screen.getByTestId("flight-fuel-amount")).toHaveTextContent("80%");
    expect(screen.getByTestId("flight-fuel")).toHaveAttribute(
      "data-tone",
      "ok"
    );
  });

  it("turns orange when low and red when nearly empty", () => {
    render(<FlightHud />);
    fuelAt(0.3);
    expect(screen.getByTestId("flight-fuel")).toHaveAttribute(
      "data-tone",
      "low"
    );
    fuelAt(0.1);
    expect(screen.getByTestId("flight-fuel")).toHaveAttribute(
      "data-tone",
      "critical"
    );
  });

  it("says EMPTY when the tank runs dry", () => {
    render(<FlightHud />);
    fuelAt(0);
    expect(screen.getByTestId("flight-fuel-amount")).toHaveTextContent("EMPTY");
    expect(screen.getByRole("progressbar", { name: "Fuel" })).toHaveAttribute(
      "aria-valuetext",
      "Empty"
    );
  });
});
