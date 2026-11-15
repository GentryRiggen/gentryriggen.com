import { act, fireEvent, render, screen } from "@testing-library/react";
import TrophyShelf from "../TrophyShelf";
import { useGameStore } from "@/lib/planet-smasher/store";
import { freshProgress } from "@/lib/planet-smasher/progress";

describe("TrophyShelf", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState({
        progress: {
          ...freshProgress(),
          trophies: ["firstSmash"],
          stats: {
            ...freshProgress().stats,
            shots: { nuke: 10 },
          },
        },
      });
    });
  });

  it("opens to 20 tiles and labels the earned ones", () => {
    render(<TrophyShelf />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /trophies/i }));
    const tiles = screen.getAllByTestId("trophy-tile");
    expect(tiles).toHaveLength(20);
    expect(screen.getByLabelText(/First smash, earned/)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/earned/)).toHaveLength(1);
  });

  it("shows the earned count on the button", () => {
    render(<TrophyShelf />);
    expect(screen.getByText("1/20")).toBeInTheDocument();
  });

  it("shows a progress bar for a locked goal trophy (nuke25 at 10/25)", () => {
    render(<TrophyShelf />);
    fireEvent.click(screen.getByRole("button", { name: /trophies/i }));
    const bar = screen.getByRole("progressbar", { name: /Nuke fan/ });
    expect(bar).toHaveAttribute("aria-valuenow", "10");
    expect(bar).toHaveAttribute("aria-valuemax", "25");
  });

  it("closes with the X", () => {
    render(<TrophyShelf />);
    fireEvent.click(screen.getByRole("button", { name: /trophies/i }));
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
