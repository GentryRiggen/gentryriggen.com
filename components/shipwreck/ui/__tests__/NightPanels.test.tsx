import { fireEvent, render, screen } from "@testing-library/react";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import NightPanels, { resetPanelChoice } from "../NightPanels";

describe("NightPanels", () => {
  beforeEach(() => resetPanelChoice());

  it("starts closed at every width, even a wide iPad", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1133,
    });
    render(<NightPanels store={createPlaybackStore()} spec={titanic} />);
    expect(screen.queryByTestId("shipwreck-panel")).toBeNull();
  });

  it("keeps the player's choice for the next run", () => {
    const store = createPlaybackStore();
    const { unmount } = render(<NightPanels store={store} spec={titanic} />);
    fireEvent.click(screen.getByTestId("shipwreck-panel-button"));
    expect(screen.getByTestId("shipwreck-panel")).toBeInTheDocument();
    unmount();
    render(<NightPanels store={store} spec={titanic} />);
    expect(screen.getByTestId("shipwreck-panel")).toBeInTheDocument();
  });
});
