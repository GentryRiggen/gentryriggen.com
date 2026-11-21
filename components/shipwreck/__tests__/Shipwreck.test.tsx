import { act, fireEvent, render, screen } from "@testing-library/react";
import { SAVE_KEY } from "@/lib/shipwreck/save";
import { resetSaveStore } from "@/lib/shipwreck/useSave";
import Shipwreck from "../Shipwreck";

jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));
// The 3D scene needs WebGL: the tests cover the DOM UI over it.
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => () => null,
}));
jest.mock("@/components/update/useUpdateCheck", () => ({
  useUpdateCheck: () => ({ isUpdateReady: false }),
}));

beforeEach(() => {
  window.localStorage.clear();
  resetSaveStore();
});

describe("Shipwreck title screen", () => {
  it("shows the title, the parent line and a What's new link", () => {
    render(<Shipwreck />);
    expect(
      screen.getByRole("heading", { name: "Shipwreck" })
    ).toBeInTheDocument();
    expect(screen.getByText(/More than 1,500 people died/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /What's new/ })).toHaveAttribute(
      "href",
      "/shipwreck/versions"
    );
  });

  it("starts the real night: the HUD shows and the hooks say night", () => {
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-real-night"));
    expect(screen.getByTestId("shipwreck-hud")).toBeInTheDocument();
    expect(window.__shipwreck?.getScreen()).toBe("night");
    expect(screen.getByTestId("shipwreck-clock")).toHaveTextContent("11:40 PM");
    expect(screen.getByTestId("shipwreck-caption")).toHaveTextContent(
      /11:40 PM — The iceberg scrapes along the starboard side/
    );
    fireEvent.click(screen.getByLabelText("Back to the title"));
    expect(window.__shipwreck?.getScreen()).toBe("title");
  });

  it("opens the What if? editor and starts a run with the chosen holes", () => {
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-what-if"));
    expect(window.__shipwreck?.getScreen()).toBe("editor");
    fireEvent.click(screen.getByTestId("shipwreck-preset-clear"));
    expect(screen.getByTestId("shipwreck-go")).toBeDisabled();
    fireEvent.click(screen.getByTestId("shipwreck-chip-fore-peak"));
    fireEvent.click(screen.getByTestId("shipwreck-chip-hold1"));
    expect(screen.getByTestId("shipwreck-hole-count")).toHaveTextContent(
      "2 holes"
    );
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    expect(window.__shipwreck?.getScreen()).toBe("night");
  });

  it("exposes the screen to test hooks", () => {
    render(<Shipwreck />);
    expect(window.__shipwreck?.getScreen()).toBe("title");
  });

  it("saves when the page is hidden", () => {
    render(<Shipwreck />);
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      fireEvent(document, new Event("visibilitychange"));
    });
    expect(window.localStorage.getItem(SAVE_KEY)).not.toBeNull();
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });
});
