import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { playback } from "@/lib/shipwreck/playback";
import { SAVE_KEY } from "@/lib/shipwreck/save";
import { britannic } from "@/lib/shipwreck/ships/britannic";
import { carpathia } from "@/lib/shipwreck/ships/carpathia";
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

describe("Shipwreck: choosing the Carpathia (1.4)", () => {
  it("plays her real morning on her own clock, words, places and side", async () => {
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-ship-carpathia"));
    expect(playback.getState().ship).toBe("carpathia");
    expect(screen.getByTestId("shipwreck-real-night")).toHaveTextContent(
      "The real morning"
    );
    fireEvent.click(screen.getByTestId("shipwreck-real-night"));
    // Her first two wakes run in from port for 40 s before 9:15 (Task 6).
    expect(playback.getState().t).toBe(-40);
    expect(playback.getState().openings).toEqual(carpathia.realNight);
    // Three torpedoes in her real run (two now, the U-boat's at 10:50).
    expect(playback.getState().hits).toHaveLength(3);
    expect(
      playback.getState().torpedoes.map((h) => [h.t, h.side, h.finisher])
    ).toEqual([
      [0, "port", false],
      [8, "port", false],
      [5700, "port", true],
    ]);
    expect(screen.getByTestId("shipwreck-clock")).toHaveTextContent("9:14 AM");
    expect(screen.getByText(/^Just before the torpedo/)).toBeInTheDocument();
    expect(screen.getByTestId("shipwreck-caption")).toHaveTextContent(
      /^9:14 AM — Two torpedoes are coming!.*port side/
    );
    // The hit at 9:15 AM.
    act(() => {
      playback.getState().pump(60_000);
      playback.getState().seek(0.5);
    });
    expect(screen.getByTestId("shipwreck-clock")).toHaveTextContent("9:15 AM");
    expect(screen.getByText("Just hit by a torpedo")).toBeInTheDocument();
    expect(screen.getByTestId("shipwreck-caption")).toHaveTextContent(
      /^9:15 AM — A torpedo hits her port side, by her boiler room/
    );
    // 9:30 AM, a quarter of an hour on.
    act(() => {
      playback.getState().pump(60_000);
      playback.getState().seek(15 * 60);
    });
    expect(screen.getByTestId("shipwreck-clock")).toHaveTextContent("9:30 AM");
    expect(
      screen.getByText("15 min after the first torpedo")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("shipwreck-places-button"));
    for (const id of [
      "bridge",
      "boiler-room",
      "engine-room",
      "hold-5",
      "dining-saloon",
      "wireless-room",
    ])
      expect(screen.getByTestId(`shipwreck-place-${id}`)).toBeInTheDocument();
    // The water panel draws only the holes open by now: not the U-boat's
    // (it reads the store a few times a second).
    fireEvent.click(screen.getByTestId("shipwreck-panel-button"));
    const panel = screen.getByTestId("shipwreck-panel");
    const holesNow = () =>
      [...panel.querySelectorAll("[data-hole]")].map((h) =>
        h.getAttribute("data-hole")
      );
    await waitFor(() => expect(holesNow().length).toBeGreaterThan(0));
    const holes = holesNow();
    expect(holes).not.toContain("hold5");
    expect(screen.getByTestId("shipwreck-struck-side")).toHaveAttribute(
      "data-side",
      "port"
    );
  });

  it("her What if with only the U-boat's return counts down to it", () => {
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-ship-carpathia"));
    fireEvent.click(screen.getByTestId("shipwreck-what-if"));
    expect(screen.getByTestId("shipwreck-editor")).toHaveAttribute(
      "data-ship",
      "carpathia"
    );
    fireEvent.click(screen.getByTestId("shipwreck-chip-boiler"));
    fireEvent.click(screen.getByTestId("shipwreck-chip-engine"));
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    expect(screen.getByTestId("shipwreck-clock")).toHaveTextContent("9:15 AM");
    expect(
      screen.getByText("1 h 35 min before the torpedo")
    ).toBeInTheDocument();
    expect(screen.getByTestId("shipwreck-caption")).toHaveTextContent(
      /A calm summer morning at sea/
    );
    expect(currentShipwreckSave().whatIfByShip?.carpathia).toEqual({
      ids: ["finisher"],
    });
  });
});

describe("Shipwreck: each ship's paint, remembered (1.4)", () => {
  it("applies the saved livery when her ship is chosen, and her default otherwise", () => {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        v: 1,
        ship: "carpathia",
        lastWhatIf: [],
        liveryByShip: { carpathia: "cunard-1912", lusitania: "junk-0000" },
      })
    );
    playback.getState().reset();
    render(<Shipwreck />);
    expect(playback.getState().ship).toBe("carpathia");
    expect(playback.getState().livery).toBe("cunard-1912");
    expect(window.__shipwreck?.livery?.()).toBe("cunard-1912");
    // The Lusitania's saved id is junk: her default, the save untouched.
    fireEvent.click(screen.getByRole("radio", { name: /Ship: Lusitania/ }));
    expect(playback.getState().livery).toBe("war-1915");
    // A ship with one paint: no livery, no button.
    fireEvent.click(screen.getByRole("radio", { name: /Ship: Titanic/ }));
    expect(playback.getState().livery).toBeNull();
    expect(screen.queryByTestId("shipwreck-livery")).toBeNull();
    // Back to the Carpathia: her 1912 colours again.
    fireEvent.click(screen.getByRole("radio", { name: /Ship: Carpathia/ }));
    expect(playback.getState().livery).toBe("cunard-1912");
  });

  it("the paint button repaints her mid-run and remembers it", () => {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ v: 1, ship: "lusitania", lastWhatIf: [] })
    );
    playback.getState().reset();
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-real-night"));
    expect(window.__shipwreck?.getScreen()).toBe("night");
    expect(playback.getState().livery).toBe("war-1915");
    fireEvent.click(screen.getByTestId("shipwreck-livery"));
    expect(playback.getState().livery).toBe("cunard-1907");
    expect(window.__shipwreck?.getScreen()).toBe("night");
    expect(currentShipwreckSave().liveryByShip).toEqual({
      lusitania: "cunard-1907",
    });
    // The hook paints her too (as the button does).
    act(() => window.__shipwreck?.setLivery?.("war-1915"));
    expect(playback.getState().livery).toBe("war-1915");
  });
});

describe("Shipwreck: choosing the Britannic (1.4)", () => {
  function hide() {
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
  }

  it("plays her real morning on her own clock, words and places", () => {
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-ship-britannic"));
    expect(playback.getState().ship).toBe("britannic");
    expect(screen.getByTestId("shipwreck-parent-line")).toHaveTextContent(
      /A mine sank her in 55 minutes/
    );
    expect(screen.getByTestId("shipwreck-real-night")).toHaveTextContent(
      "The real morning"
    );
    fireEvent.click(screen.getByTestId("shipwreck-real-night"));
    expect(playback.getState().t).toBe(0);
    expect(playback.getState().openings).toEqual(britannic.realNight);
    expect(screen.getByTestId("shipwreck-clock")).toHaveTextContent("8:12 AM");
    expect(screen.getByText("Just hit by the mine")).toBeInTheDocument();
    expect(screen.getByTestId("shipwreck-caption")).toHaveTextContent(
      /^8:12 AM — A mine explodes against her starboard side/
    );
    act(() => {
      playback.getState().pump(60_000);
      playback.getState().seek(18 * 60);
    });
    expect(screen.getByTestId("shipwreck-clock")).toHaveTextContent("8:30 AM");
    expect(screen.getByText("18 min after the mine")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("shipwreck-places-button"));
    for (const id of [
      "bridge",
      "hold-2",
      "boiler-room-6",
      "portholes",
      "gantry-davit",
      "turbine-room",
    ])
      expect(screen.getByTestId(`shipwreck-place-${id}`)).toBeInTheDocument();
    expect(screen.queryByTestId("shipwreck-place-grand-staircase")).toBeNull();
  });

  it("ends her real morning with the real time beside the sim's", () => {
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-ship-britannic"));
    fireEvent.click(screen.getByTestId("shipwreck-real-night"));
    act(() => {
      for (let i = 0; i < 400 && !playback.getState().done; i += 1)
        playback.getState().pump(50);
      playback.getState().seek(playback.getState().computedT);
    });
    const end = screen.getByTestId("shipwreck-end");
    expect(end).toHaveAttribute("data-outcome", "sank");
    expect(end).toHaveTextContent(
      "She sank at 9:07 AM, 55 minutes after the mine."
    );
  });

  it("her What if: mines and three toggles, remembered; then the Titanic's own editor", () => {
    render(<Shipwreck />);
    fireEvent.click(screen.getByTestId("shipwreck-ship-britannic"));
    fireEvent.click(screen.getByTestId("shipwreck-what-if"));
    expect(screen.getByTestId("shipwreck-editor")).toHaveAttribute(
      "data-ship",
      "britannic"
    );
    fireEvent.click(screen.getByTestId("whatif-portholes"));
    fireEvent.click(screen.getByTestId("whatif-doors"));
    fireEvent.click(screen.getByTestId("whatif-engines"));
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    expect(window.__shipwreck?.getScreen()).toBe("night");
    expect(playback.getState().ship).toBe("britannic");
    expect(playback.getState().openings.map((o) => o.compartmentId)).toContain(
      "hold3"
    );
    fireEvent.click(screen.getByLabelText("Back to the title"));
    hide();
    const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY)!);
    expect(saved.ship).toBe("britannic");
    expect(saved.whatIfByShip.britannic).toEqual({
      ids: ["hold3"],
      portholesOpen: false,
      doorsClosed: true,
      enginesStopped: true,
    });
    // Back in her editor: as she was left.
    fireEvent.click(screen.getByTestId("shipwreck-what-if"));
    expect(screen.getByTestId("whatif-doors")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    fireEvent.click(screen.getByLabelText("Back to the title"));

    // Back to the Titanic: her own editor, as 1.0, none of the toggles.
    fireEvent.click(screen.getByTestId("shipwreck-ship-titanic"));
    expect(playback.getState().ship).toBe("titanic");
    fireEvent.click(screen.getByTestId("shipwreck-what-if"));
    expect(screen.getByTestId("shipwreck-editor")).toHaveAttribute(
      "data-ship",
      "titanic"
    );
    expect(screen.queryByTestId("whatif-doors")).toBeNull();
    expect(screen.queryByTestId("shipwreck-portholes")).toBeNull();
  });
});
