import { act, render, screen } from "@testing-library/react";
import TapHint from "../TapHint";
import { useGameStore } from "@/lib/planet-smasher/store";
import { freshProgress } from "@/lib/planet-smasher/progress";

describe("TapHint", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState({
        progress: { ...freshProgress(), points: 0 },
        lastHit: null,
      });
    });
  });

  it("shows at 0 points before any hit", () => {
    render(<TapHint />);
    expect(screen.getByTestId("tap-hint")).toHaveTextContent("Tap!");
  });

  it("hides after the first hit, for good", () => {
    render(<TapHint />);
    act(() => {
      useGameStore.setState({
        lastHit: { peopleLost: 5, u: 0.5, v: 0.5, seq: 1, combo: 0 },
      });
    });
    expect(screen.queryByTestId("tap-hint")).toBeNull();
    act(() => useGameStore.setState({ lastHit: null }));
    expect(screen.queryByTestId("tap-hint")).toBeNull();
  });

  it("stays hidden once there are points", () => {
    act(() => {
      useGameStore.setState({
        progress: { ...freshProgress(), points: 3 },
      });
    });
    render(<TapHint />);
    expect(screen.queryByTestId("tap-hint")).toBeNull();
  });
});
