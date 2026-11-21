import { act, fireEvent, render, screen } from "@testing-library/react";
import { playback } from "@/lib/shipwreck/playback";
import { SAVE_KEY } from "@/lib/shipwreck/save";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
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

describe("Shipwreck: choosing the Lusitania", () => {
  it("plays her real afternoon on her own clock and words", () => {
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-ship-lusitania"));
    expect(screen.getByTestId("shipwreck-parent-line")).toHaveTextContent(
      /A torpedo sank her in 18 minutes/
    );
    expect(playback.getState().ship).toBe("lusitania");
    expect(window.__shipwreck?.ship?.()).toBe("lusitania");
    fireEvent.click(screen.getByTestId("shipwreck-real-night"));
    expect(screen.getByTestId("shipwreck-clock")).toHaveTextContent("2:10 PM");
    expect(screen.getByText("Just hit by the torpedo")).toBeInTheDocument();
    expect(screen.getByTestId("shipwreck-caption")).toHaveTextContent(
      /2:10 PM — A torpedo hits the starboard side/
    );
    expect(playback.getState().openings).toEqual(lusitania.realNight);
    // Her places.
    fireEvent.click(screen.getByTestId("shipwreck-places-button"));
    expect(
      screen.getByTestId("shipwreck-place-starboard-bunker")
    ).toHaveTextContent("Coal Bunker");
    expect(screen.queryByTestId("shipwreck-place-grand-staircase")).toBeNull();
  });

  it("remembers her, and her What if, apart from the Titanic's", () => {
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-ship-lusitania"));
    fireEvent.click(screen.getByTestId("shipwreck-what-if"));
    expect(screen.getByTestId("shipwreck-editor")).toHaveAttribute(
      "data-ship",
      "lusitania"
    );
    fireEvent.click(screen.getByTestId("shipwreck-chip-turbine"));
    fireEvent.click(screen.getByTestId("shipwreck-portholes"));
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    expect(playback.getState().openings.map((o) => o.compartmentId)).toContain(
      "turbine"
    );
    fireEvent.click(screen.getByLabelText("Back to the title"));
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      fireEvent(document, new Event("visibilitychange"));
    });
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY)!);
    expect(saved.ship).toBe("lusitania");
    expect(saved.whatIfByShip.lusitania).toEqual({
      ids: ["turbine"],
      portholesOpen: false,
    });
    expect(saved.lastWhatIf).toEqual([]);

    // Back to the Titanic: her own editor, as 1.0.
    fireEvent.click(screen.getByTestId("shipwreck-ship-titanic"));
    expect(playback.getState().ship).toBe("titanic");
    expect(screen.getByTestId("shipwreck-parent-line")).toHaveTextContent(
      /More than 1,500 people died/
    );
    fireEvent.click(screen.getByTestId("shipwreck-what-if"));
    expect(screen.getByTestId("shipwreck-editor")).toHaveAttribute(
      "data-ship",
      "titanic"
    );
    expect(screen.queryByTestId("shipwreck-portholes")).toBeNull();
    expect(screen.getByTestId("shipwreck-preset-clear")).toBeInTheDocument();
  });

  it("starts on the ship the save chose, never the Titanic first", () => {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, ship: "lusitania", lastWhatIf: ["br6"] })
    );
    playback.getState().reset();
    // Every run start and camera snap, with the ship on the stage then.
    const staged: string[] = [];
    const off = playback.subscribe((s, prev) => {
      if (s.snapId !== prev.snapId) staged.push(s.ship);
    });
    render(<Shipwreck />);
    off();
    expect(staged.length).toBeGreaterThan(0);
    expect(staged.every((id) => id === "lusitania")).toBe(true);
    expect(
      screen.getByRole("radio", { name: /Ship: Lusitania/ })
    ).toHaveAttribute("aria-checked", "true");
    expect(playback.getState().ship).toBe("lusitania");
  });
});
