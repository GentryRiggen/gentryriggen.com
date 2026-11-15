import { act, fireEvent, render, screen } from "@testing-library/react";
import PlanetPicker from "../PlanetPicker";
import { useGameStore } from "@/lib/planet-smasher/store";
import { freshProgress } from "@/lib/planet-smasher/progress";

jest.mock("../../scene/planetTextures", () => ({
  loadPlanetTextures: () =>
    Promise.resolve({
      population: { w: 2, h: 1, weights: new Float32Array([0.5, 0.5]) },
    }),
}));

describe("PlanetPicker", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState({
        progress: { ...freshProgress(), points: 80000 },
      });
    });
  });

  it("opens Mars and keeps Frostia locked", () => {
    render(<PlanetPicker />);
    fireEvent.click(screen.getByRole("button", { name: /choose a planet/i }));
    expect(screen.getByRole("button", { name: "Mars" })).not.toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getByRole("button", { name: "Frostia" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getByText("⭐ 122,000")).toBeInTheDocument();
  });

  it("selects Mars", async () => {
    render(<PlanetPicker />);
    fireEvent.click(screen.getByRole("button", { name: /choose a planet/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mars" }));
    });
    expect(useGameStore.getState().progress.planetId).toBe("mars");
  });

  it("shows a wreck count badge on planets that have been wrecked", () => {
    const base = freshProgress();
    act(() => {
      useGameStore.setState({
        progress: {
          ...base,
          points: 80000,
          stats: { ...base.stats, endedByPlanet: { lava: 3, mars: 0 } },
        },
      });
    });
    render(<PlanetPicker />);
    fireEvent.click(screen.getByRole("button", { name: /choose a planet/i }));
    expect(screen.getByText("💥 3")).toBeInTheDocument();
    expect(screen.getAllByText(/💥/)).toHaveLength(1);
  });
});
