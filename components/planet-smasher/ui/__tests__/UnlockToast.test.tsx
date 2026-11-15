import { act, render, screen } from "@testing-library/react";
import UnlockToast from "../UnlockToast";
import Arsenal from "../Arsenal";
import { useGameStore } from "@/lib/planet-smasher/store";

describe("UnlockToast", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("shows nothing without an unlock", () => {
    act(() => useGameStore.setState({ lastUnlocks: [] }));
    render(<UnlockToast />);
    expect(screen.queryByText("NEW!")).toBeNull();
  });

  it("celebrates each unlock in turn, then clears them", () => {
    act(() =>
      useGameStore.setState({
        lastUnlocks: [
          { kind: "tool", id: "meteorShower" },
          { kind: "planet", id: "mars" },
        ],
      })
    );
    render(<UnlockToast />);
    expect(screen.getByText("NEW!")).toBeInTheDocument();
    expect(screen.getByText("Meteor shower")).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(screen.getByText("Mars")).toBeInTheDocument();
    expect(useGameStore.getState().lastUnlocks).toHaveLength(2);
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(useGameStore.getState().lastUnlocks).toEqual([]);
    expect(screen.queryByText("NEW!")).toBeNull();
  });

  it("moves the tray to the tool being shown, not the first queued", () => {
    act(() =>
      useGameStore.setState({
        lastUnlocks: [
          { kind: "tool", id: "nuke" },
          { kind: "tool", id: "tsunami" },
        ],
      })
    );
    render(
      <>
        <Arsenal />
        <UnlockToast />
      </>
    );
    const tab = (name: string) => screen.getByRole("tab", { name });
    expect(tab("Bombs")).toHaveAttribute("aria-selected", "true");
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(tab("Nature")).toHaveAttribute("aria-selected", "true");
  });
});
