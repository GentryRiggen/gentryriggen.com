import { act, render, screen } from "@testing-library/react";
import TrophyToast from "../TrophyToast";
import { useShelfOpen } from "../shelfState";
import { useGameStore } from "@/lib/planet-smasher/store";

describe("TrophyToast", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    act(() => {
      useGameStore.setState({ lastUnlocks: [], lastTrophies: [] });
      useShelfOpen.getState().setOpen(false);
    });
  });
  afterEach(() => jest.useRealTimers());

  it("shows nothing without a trophy", () => {
    render(<TrophyToast />);
    expect(screen.queryByText("TROPHY!")).toBeNull();
  });

  it("celebrates each trophy in turn, then clears them", () => {
    act(() =>
      useGameStore.setState({ lastTrophies: ["firstSmash", "combo10"] })
    );
    render(<TrophyToast />);
    expect(screen.getByText("TROPHY!")).toBeInTheDocument();
    expect(screen.getByText("First smash")).toBeInTheDocument();
    expect(screen.getByText("+150 ⭐")).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(screen.getByText("Combo ×10")).toBeInTheDocument();
    expect(useGameStore.getState().lastTrophies).toHaveLength(2);
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(useGameStore.getState().lastTrophies).toEqual([]);
    expect(screen.queryByText("TROPHY!")).toBeNull();
  });

  it("waits while unlock cards are pending", () => {
    act(() =>
      useGameStore.setState({
        lastTrophies: ["firstSmash"],
        lastUnlocks: [{ kind: "tool", id: "meteorShower" }],
      })
    );
    render(<TrophyToast />);
    expect(screen.queryByText("TROPHY!")).toBeNull();
    act(() => useGameStore.setState({ lastUnlocks: [] }));
    expect(screen.getByText("TROPHY!")).toBeInTheDocument();
  });

  it("hides while the trophy shelf is open and shows after it closes", () => {
    act(() => useShelfOpen.getState().setOpen(true));
    act(() => useGameStore.setState({ lastTrophies: ["firstSmash"] }));
    render(<TrophyToast />);
    expect(screen.queryByText("TROPHY!")).toBeNull();
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(useGameStore.getState().lastTrophies).toEqual(["firstSmash"]);
    act(() => useShelfOpen.getState().setOpen(false));
    expect(screen.getByText("TROPHY!")).toBeInTheDocument();
  });
});
