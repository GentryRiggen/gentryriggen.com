import { act, render, screen } from "@testing-library/react";
import ComboBadge from "../ComboBadge";
import { useGameStore } from "@/lib/planet-smasher/store";

function hit(combo: number, seq: number) {
  act(() => {
    useGameStore.setState({
      lastHit: { peopleLost: 10, u: 0.5, v: 0.5, seq, combo },
    });
  });
}

describe("ComboBadge", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    act(() => {
      useGameStore.setState({ lastHit: null });
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the combo and its bonus from three hits", () => {
    render(<ComboBadge />);
    hit(4, 1);
    expect(screen.getByText("COMBO ×4!")).toBeInTheDocument();
    expect(screen.getByText("+4 ⭐")).toBeInTheDocument();
  });

  it("shows nothing for a combo of two", () => {
    render(<ComboBadge />);
    hit(2, 1);
    expect(screen.queryByText(/COMBO/)).not.toBeInTheDocument();
  });

  it("caps the bonus at 10 stars", () => {
    render(<ComboBadge />);
    hit(14, 1);
    expect(screen.getByText("COMBO ×14!")).toBeInTheDocument();
    expect(screen.getByText("+10 ⭐")).toBeInTheDocument();
  });

  it("is gone 1.3 s after the last hit", () => {
    render(<ComboBadge />);
    hit(3, 1);
    expect(screen.getByText("COMBO ×3!")).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(1300);
    });
    expect(screen.queryByText(/COMBO/)).not.toBeInTheDocument();
  });

  it("stays while the hits keep coming", () => {
    render(<ComboBadge />);
    hit(3, 1);
    act(() => {
      jest.advanceTimersByTime(800);
    });
    hit(4, 2);
    act(() => {
      jest.advanceTimersByTime(800);
    });
    expect(screen.getByText("COMBO ×4!")).toBeInTheDocument();
  });
});
