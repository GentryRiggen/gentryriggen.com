import { act, render, screen } from "@testing-library/react";
import Odometer from "../Odometer";
import { useGameStore } from "@/lib/planet-smasher/store";
import { createPlanetState } from "@/lib/planet-smasher/damage";

const grid = { w: 2, h: 1, weights: new Float32Array([0.5, 0.5]) };

describe("Odometer", () => {
  it("shows one column per digit and a readable label", () => {
    render(<Odometer value={8_000_000_000} />);
    expect(screen.getAllByTestId("odometer-digit")).toHaveLength(10);
    expect(screen.getByLabelText("8,000,000,000")).toBeInTheDocument();
  });

  it("follows the store without re-rendering", () => {
    act(() => {
      useGameStore.setState({ planet: createPlanetState("earth", grid) });
    });
    render(<Odometer value={8_000_000_000} />);
    act(() => {
      const planet = useGameStore.getState().planet!;
      planet.population = 1_204_883;
      useGameStore.setState({ planet: { ...planet } });
    });
    expect(screen.getByLabelText("1,204,883")).toBeInTheDocument();
    const digits = screen.getAllByTestId("odometer-digit");
    // Leading zero columns are hidden.
    expect(digits.filter((d) => d.classList.contains("hidden"))).toHaveLength(
      3
    );
  });
});
