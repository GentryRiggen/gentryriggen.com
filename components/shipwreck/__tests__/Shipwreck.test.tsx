import { act, fireEvent, render, screen } from "@testing-library/react";
import { playback } from "@/lib/shipwreck/playback";
import { SAVE_KEY } from "@/lib/shipwreck/save";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { currentShipwreckSave, resetSaveStore } from "@/lib/shipwreck/useSave";
import Shipwreck, { PREVIEW_END_S } from "../Shipwreck";

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

  it("leaving the night clears a running walk", () => {
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-real-night"));
    act(() => playback.getState().startWalk());
    expect(playback.getState().walk.phase).toBe("deck");
    // The title's own setCamera also walks off: check leaveNight asks.
    const leave = jest.spyOn(playback.getState(), "leaveWalk");
    fireEvent.click(screen.getByLabelText("Back to the title"));
    expect(leave).toHaveBeenCalled();
    leave.mockRestore();
    expect(playback.getState().walk.phase).toBe("off");
    expect(playback.getState().camera).not.toBe("walk");
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
    // Her run starts 40 s before the hit: the torpedo's run-in.
    expect(playback.getState().t).toBe(-(lusitania.preRollS ?? 0));
    expect(screen.getByTestId("shipwreck-clock")).toHaveTextContent("2:09 PM");
    expect(screen.getByText("Just before the torpedo")).toBeInTheDocument();
    expect(screen.getByTestId("shipwreck-caption")).toHaveTextContent(
      /2:09 PM — A torpedo is coming/
    );
    // Then the hit, at 2:10 PM.
    act(() => {
      playback.getState().pump(1000);
      playback.getState().seek(30);
    });
    expect(screen.getByTestId("shipwreck-clock")).toHaveTextContent("2:10 PM");
    expect(screen.getByText("Just hit by the torpedo")).toBeInTheDocument();
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
    // Two torpedoes (1.3): the real hit stays, a second at the turbines.
    fireEvent.click(screen.getByTestId("shipwreck-chip-turbine"));
    fireEvent.click(screen.getByTestId("shipwreck-portholes"));
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    expect(playback.getState().openings.map((o) => o.compartmentId)).toContain(
      "turbine"
    );
    expect(playback.getState().hits).toHaveLength(2);
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
      ids: ["br1", "turbine"],
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

describe("Shipwreck: choosing the Edmund Fitzgerald (1.3)", () => {
  it("previews only her opening moment behind the title", () => {
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-ship-fitzgerald"));
    expect(playback.getState().ship).toBe("fitzgerald");
    act(() => {
      for (let i = 0; i < 50 && !playback.getState().done; i += 1)
        playback.getState().pump(50);
    });
    expect(playback.getState().done).toBe(true);
    expect(playback.getState().computedT).toBeLessThanOrEqual(
      PREVIEW_END_S + 1
    );
  });

  it("plays her real storm on her own clock, words and places", () => {
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-ship-fitzgerald"));
    expect(screen.getByTestId("shipwreck-parent-line")).toHaveTextContent(
      /all 29 of her crew died/
    );
    expect(screen.getByTestId("shipwreck-real-night")).toHaveTextContent(
      "The real storm"
    );
    fireEvent.click(screen.getByTestId("shipwreck-real-night"));
    expect(playback.getState().t).toBe(0);
    expect(playback.getState().openings).toEqual(fitzgerald.realNight);
    expect(screen.getByTestId("shipwreck-clock")).toHaveTextContent("3:30 PM");
    expect(screen.getByText("Her first report")).toBeInTheDocument();
    expect(screen.getByTestId("shipwreck-caption")).toHaveTextContent(
      /^3:30 PM — Her captain radios the Arthur M. Anderson/
    );
    // Computed: her timeline is the last 10%, from 6:50 PM.
    act(() => {
      playback.getState().pump(60_000);
    });
    expect(screen.getByTestId("shipwreck-clock")).toHaveTextContent("6:50 PM");
    // 7:00 PM, three and a half hours into the storm.
    act(() => {
      playback.getState().seek(3.5 * 3600);
    });
    expect(screen.getByTestId("shipwreck-clock")).toHaveTextContent("7:00 PM");
    expect(screen.getByText("3 h 30 min into the storm")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("shipwreck-places-button"));
    for (const id of [
      "pilothouse",
      "bell",
      "cargo-hold-1",
      "ballast-tank",
      "engine-room",
      "hatch-crane",
    ])
      expect(screen.getByTestId(`shipwreck-place-${id}`)).toBeInTheDocument();
    expect(screen.queryByTestId("shipwreck-place-bridge")).toBeNull();
  });

  it("her What if: spots and a calmer storm, remembered under her name", () => {
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-ship-fitzgerald"));
    fireEvent.click(screen.getByTestId("shipwreck-what-if"));
    expect(screen.getByTestId("shipwreck-editor")).toHaveAttribute(
      "data-ship",
      "fitzgerald"
    );
    fireEvent.click(screen.getByTestId("shipwreck-preset-clear"));
    fireEvent.click(screen.getByTestId("shipwreck-chip-hatch-1"));
    fireEvent.click(screen.getByTestId("shipwreck-chip-shoal-3"));
    fireEvent.click(screen.getByTestId("shipwreck-storm-calmer"));
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    expect(playback.getState().ship).toBe("fitzgerald");
    expect(playback.getState().openings).toEqual([
      fitzgerald.shoalOpenings![2],
    ]);
    expect(playback.getState().hits).toEqual([]);
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
    expect(saved.ship).toBe("fitzgerald");
    expect(saved.whatIfByShip.fitzgerald).toEqual({
      ids: ["hatch-1", "shoal-3"],
      storm: "calmer",
    });
    // Back in the editor: as she was left.
    fireEvent.click(screen.getByTestId("shipwreck-what-if"));
    expect(screen.getByTestId("shipwreck-storm-calmer")).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByTestId("shipwreck-hole-count")).toHaveTextContent(
      "1 leaky hatch · 1 shoal scrape"
    );
    // Like the real storm: her real spots, her real hull damage.
    fireEvent.click(screen.getByTestId("shipwreck-preset-real"));
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    expect(playback.getState().openings).toEqual(fitzgerald.realNight);
  });

  it("her real run shows no ending badge and records no ending as seen", () => {
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-ship-fitzgerald"));
    fireEvent.click(screen.getByTestId("shipwreck-real-night"));
    act(() => {
      for (let i = 0; i < 400 && !playback.getState().done; i += 1)
        playback.getState().pump(50);
      playback.getState().seek(playback.getState().computedT);
    });
    expect(screen.getByTestId("shipwreck-end")).toBeInTheDocument();
    expect(document.querySelector(".sw-badge")).toBeNull();
    expect(currentShipwreckSave().seen.endings).toEqual([]);
  });
});
