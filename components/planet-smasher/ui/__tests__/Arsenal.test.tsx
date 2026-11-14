import { act, fireEvent, render, screen } from "@testing-library/react";
import Arsenal from "../Arsenal";
import { useGameStore } from "@/lib/planet-smasher/store";
import { freshProgress } from "@/lib/planet-smasher/progress";
import { resetFresh } from "../freshItems";

function setPoints(points: number) {
  act(() => {
    useGameStore.setState({ progress: { ...freshProgress(), points } });
    resetFresh();
  });
}

describe("Arsenal", () => {
  it("starts with only the asteroid open", () => {
    setPoints(0);
    render(<Arsenal />);
    const tiles = screen.getAllByRole("button");
    expect(tiles).toHaveLength(16);
    const locked = tiles.filter(
      (t) => t.getAttribute("aria-disabled") === "true"
    );
    expect(locked).toHaveLength(15);
    expect(
      screen.getByRole("button", { name: "Asteroid" })
    ).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("⭐ 30")).toBeInTheDocument();
  });

  it("ignores a tap on a locked tile", () => {
    setPoints(0);
    render(<Arsenal />);
    fireEvent.click(screen.getByRole("button", { name: "Nuke" }));
    expect(useGameStore.getState().progress.toolId).toBe("asteroid");
  });

  it("opens the supervolcano at 700 points and selects it", () => {
    setPoints(700);
    render(<Arsenal />);
    const tile = screen.getByRole("button", { name: "Supervolcano" });
    expect(tile).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(tile);
    expect(useGameStore.getState().progress.toolId).toBe("supervolcano");
  });

  it("shows the Twin nuke's radiation sign twice", () => {
    setPoints(0);
    render(<Arsenal />);
    const tile = screen.getByRole("button", { name: "Twin nuke" });
    expect(tile.textContent?.match(/☢️/g)).toHaveLength(2);
  });

  it("scrolls a tapped tile into view", () => {
    const scroll = jest.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      setPoints(700);
      render(<Arsenal />);
      fireEvent.click(screen.getByRole("button", { name: "Supervolcano" }));
      expect(scroll).toHaveBeenCalledWith({
        inline: "nearest",
        block: "nearest",
        behavior: "smooth",
      });
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });

  it("scrolls a tool restored from a save into view on load", () => {
    const scroll = jest.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      act(() => {
        useGameStore.setState({
          progress: {
            ...freshProgress(),
            points: 9000,
            toolId: "mothership",
          },
        });
        resetFresh();
      });
      render(<Arsenal />);
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(scroll.mock.contexts[0]).toBe(
        screen.getByRole("button", { name: "Mothership" })
      );
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });
});
