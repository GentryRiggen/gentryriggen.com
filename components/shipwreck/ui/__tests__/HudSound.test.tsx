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
