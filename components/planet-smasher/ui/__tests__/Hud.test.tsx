import { act, render, screen } from "@testing-library/react";
import Hud from "../Hud";
import { useGameStore } from "@/lib/planet-smasher/store";
import { createPlanetState } from "@/lib/planet-smasher/damage";

const grid = { w: 2, h: 1, weights: new Float32Array([0.5, 0.5]) };

describe("Hud", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState({
        planet: createPlanetState("earth", grid),
        lastHit: null,
      });
      useGameStore.setState((s) => ({
        progress: { ...s.progress, points: 1234 },
      }));
    });
  });

  it("shows the points", () => {
    render(<Hud />);
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("shows health as a progress bar", () => {
    render(<Hud />);
    const bar = screen.getByRole("progressbar", { name: /health/i });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });

  it("pops off the people lost on a hit", () => {
    render(<Hud />);
    expect(screen.queryByTestId("popoff")).toBeNull();
    act(() => {
      useGameStore.setState({
        lastHit: { peopleLost: 1204883.4, u: 0.5, v: 0.5, seq: 1, combo: 0 },
      });
    });
    expect(screen.getByTestId("popoff")).toHaveTextContent("−1,204,883");
  });
});
