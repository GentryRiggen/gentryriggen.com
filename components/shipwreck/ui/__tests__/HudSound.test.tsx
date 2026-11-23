import { fireEvent, render, screen } from "@testing-library/react";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import Hud from "../Hud";

describe("Hud sound button", () => {
  it("is absent without a sound prop", () => {
    render(<Hud store={createPlaybackStore()} onBack={() => {}} runId={1} />);
    expect(screen.queryByTestId("shipwreck-sound")).toBeNull();
  });

  it("names its state and toggles", () => {
    const onToggle = jest.fn();
    const { rerender } = render(
      <Hud
        store={createPlaybackStore()}
        onBack={() => {}}
        runId={1}
        sound={{ isOn: true, onToggle }}
      />
    );
    const on = screen.getByRole("button", { name: "Sound on" });
    fireEvent.click(on);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(
      <Hud
        store={createPlaybackStore()}
        onBack={() => {}}
        runId={1}
        sound={{ isOn: false, onToggle }}
      />
    );
    expect(screen.getByRole("button", { name: "Sound off" })).toBeTruthy();
  });
});

describe("Hud paint button", () => {
  it("shows her saved paint before the store has it", () => {
    const store = createPlaybackStore();
    store.getState().setShip("carpathia");
    expect(store.getState().livery).toBeNull();
    const { rerender } = render(
      <Hud store={store} onBack={() => {}} runId={1} />
    );
    const plain = screen.getByTestId("shipwreck-livery").dataset.current;
    expect(plain).toBe("dazzle-1918");
    rerender(
      <Hud
        store={store}
        onBack={() => {}}
        runId={1}
        savedLivery="cunard-1912"
      />
    );
    expect(screen.getByTestId("shipwreck-livery").dataset.current).toBe(
      "cunard-1912"
    );
  });
});
