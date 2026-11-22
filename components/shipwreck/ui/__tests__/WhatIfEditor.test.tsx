import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ShipWhatIf } from "@/lib/shipwreck/save";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { isDeckOpening } from "@/lib/shipwreck/ships/types";
import {
  simulate,
  whatIfOpenings,
  whatIfRealIds,
  whatIfSpots,
} from "@/lib/shipwreck/sim/run";
import { endWords, storyEndT } from "@/lib/shipwreck/story";
import WhatIfEditor, { REAL_NIGHT_IDS, realWhatIfIds } from "../WhatIfEditor";

function editor(spec = lusitania, initial: ShipWhatIf = { ids: [] }) {
  const onGo = jest.fn();
  render(
    <WhatIfEditor spec={spec} initial={initial} onBack={() => {}} onGo={onGo} />
  );
  return onGo;
}

describe("What if? for a torpedo ship (more than one hit, 1.3)", () => {
  it("offers her main spaces along the side for the hits, not the bunkers", () => {
    editor();
    const group = screen.getByRole("group", {
      name: "Where torpedoes hit",
    });
    const chips = within(group).getAllByRole("checkbox");
    expect(chips).toHaveLength(12);
    expect(screen.queryByTestId("shipwreck-chip-br1-stbd")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    // The real afternoon to start with: the hit beside the front boiler room.
    expect(screen.getByTestId("shipwreck-chip-br1")).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByTestId("shipwreck-hole-count")).toHaveTextContent(
      "Hits: Boiler room 1"
    );
    expect(
      screen.getByText("Tap where torpedoes hit. Will she float?")
    ).toBeInTheDocument();
    // The plan from above shows her side bunkers.
    expect(screen.getByTestId("shipwreck-plan")).toBeInTheDocument();
  });

  it("takes two or three hits and goes with openings for every one", () => {
    const onGo = editor();
    fireEvent.click(screen.getByTestId("shipwreck-chip-turbine"));
    fireEvent.click(screen.getByTestId("shipwreck-chip-br3"));
    for (const id of ["br1", "turbine", "br3"])
      expect(screen.getByTestId(`shipwreck-chip-${id}`)).toHaveAttribute(
        "aria-checked",
        "true"
      );
    expect(screen.getByTestId("shipwreck-hole-count")).toHaveTextContent(
      "3 torpedoes"
    );
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    const choice = onGo.mock.calls[0][0];
    expect(choice).toEqual({
      ids: ["br1", "turbine", "br3"],
      portholesOpen: true,
    });
    // Go builds openings for all of them: each hit opens its own room.
    const into = new Set(
      whatIfOpenings(lusitania, choice.ids).map((o) => o.compartmentId)
    );
    for (const id of ["br1", "turbine", "br3"]) expect(into).toContain(id);
    // Tapping a hit again takes it away; Clear takes them all.
    fireEvent.click(screen.getByTestId("shipwreck-chip-br3"));
    expect(screen.getByTestId("shipwreck-hole-count")).toHaveTextContent(
      "2 torpedoes"
    );
    fireEvent.click(screen.getByTestId("shipwreck-preset-clear"));
    expect(screen.getByTestId("shipwreck-go")).toBeDisabled();
    expect(screen.getByTestId("shipwreck-hole-count")).toHaveTextContent(
      "Choose where they hit"
    );
  });

  it("goes with the portholes as chosen (open by default); the real check is the real spot, portholes open", () => {
    const onGo = editor();
    const portholes = screen.getByTestId("shipwreck-portholes");
    const real = screen.getByTestId("shipwreck-preset-real");
    expect(portholes).toHaveAttribute("aria-pressed", "true");
    expect(real).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("shipwreck-chip-br1"));
    fireEvent.click(screen.getByTestId("shipwreck-chip-turbine"));
    expect(real).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(portholes);
    expect(portholes).toHaveTextContent("Portholes shut");
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    expect(onGo).toHaveBeenCalledWith({
      ids: ["turbine"],
      portholesOpen: false,
    });
    // Like the real afternoon: back to the real spot, portholes open.
    fireEvent.click(real);
    expect(real).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    expect(onGo).toHaveBeenLastCalledWith({
      ids: ["br1"],
      portholesOpen: true,
    });
  });

  it("remembers her last What if, one hit (a 1.1 save) or more, and never takes the Titanic's ids", () => {
    editor(lusitania, { ids: ["hold2"], portholesOpen: false });
    expect(screen.getByTestId("shipwreck-chip-hold2")).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByTestId("shipwreck-portholes")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    cleanup();
    editor(lusitania, { ids: ["br1", "br3", "turbine"] });
    expect(
      within(screen.getByRole("group", { name: "Where torpedoes hit" }))
        .getAllByRole("checkbox")
        .filter((c) => c.getAttribute("aria-checked") === "true")
    ).toHaveLength(3);
  });

  it("falls back to the real spot for ids she has not got", () => {
    editor(lusitania, { ids: ["br6", "br5"] });
    expect(screen.getByTestId("shipwreck-chip-br1")).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("finds each ship's real damage", () => {
    expect(realWhatIfIds(lusitania)).toEqual(["br1"]);
    expect(whatIfOpenings(lusitania, ["br1"])).toEqual(lusitania.realNight);
    expect(REAL_NIGHT_IDS).toEqual([
      ...new Set(titanic.realNight.map((o) => o.compartmentId)),
    ]);
  });
});

describe("What if? for the Titanic (as 1.0)", () => {
  it("opens many holes, clears, and has no portholes", () => {
    const onGo = editor(titanic, { ids: [] });
    expect(screen.queryByTestId("shipwreck-portholes")).toBeNull();
    expect(screen.queryByTestId("shipwreck-plan")).toBeNull();
    expect(screen.queryByTestId("shipwreck-storm")).toBeNull();
    expect(screen.getByTestId("shipwreck-hole-count")).toHaveTextContent(
      "6 holes"
    );
    fireEvent.click(screen.getByTestId("shipwreck-preset-clear"));
    fireEvent.click(screen.getByTestId("shipwreck-chip-hold1"));
    fireEvent.click(screen.getByTestId("shipwreck-chip-hold2"));
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    expect(onGo).toHaveBeenCalledWith({ ids: ["hold1", "hold2"] });
    // The shared picker: one checkbox per compartment.
    expect(
      screen
        .getAllByRole("checkbox", { checked: true })
        .map((b) => b.dataset.testid)
    ).toEqual(
      expect.arrayContaining(["shipwreck-chip-hold1", "shipwreck-chip-hold2"])
    );
  });
});

describe("What if? for a storm ship (the Fitzgerald)", () => {
  it("shows her spots, multi-select, and the storm, defaulting to the real storm", () => {
    editor(fitzgerald);
    const spots = whatIfSpots(fitzgerald);
    expect(spots).toHaveLength(25);
    const group = screen.getByRole("group", { name: "What lets the lake in" });
    const chips = within(group).getAllByRole("checkbox");
    expect(chips).toHaveLength(25);
    // Defaults: the real damage (every hatch leaking, the vents, her graze).
    const real = whatIfRealIds(fitzgerald);
    for (const id of spots)
      expect(screen.getByTestId(`shipwreck-chip-${id}`)).toHaveAttribute(
        "aria-checked",
        String(real.includes(id))
      );
    // And on the hull: each spot is a tap target.
    for (const id of spots)
      expect(screen.getByTestId(`shipwreck-spot-${id}`)).toBeInTheDocument();
    const storm = screen.getByRole("radiogroup", { name: "The storm" });
    expect(within(storm).getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByTestId("shipwreck-storm-real")).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByTestId("shipwreck-preset-real")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.queryByTestId("shipwreck-portholes")).toBeNull();
  });

  it("toggles any number of spots and the storm, and goes with openings for all", () => {
    const onGo = editor(fitzgerald);
    fireEvent.click(screen.getByTestId("shipwreck-preset-clear"));
    // No damage at all is still a question: every hatch sealed tight.
    expect(screen.getByTestId("shipwreck-go")).toBeEnabled();
    expect(screen.getByTestId("shipwreck-hole-count")).toHaveTextContent(
      "No damage"
    );
    fireEvent.click(screen.getByTestId("shipwreck-spot-hatch-3"));
    fireEvent.click(screen.getByTestId("shipwreck-chip-hatch-7"));
    fireEvent.click(screen.getByTestId("shipwreck-spot-vents"));
    fireEvent.click(screen.getByTestId("shipwreck-chip-shoal-2"));
    fireEvent.click(screen.getByTestId("shipwreck-storm-calmer"));
    expect(screen.getByTestId("shipwreck-preset-real")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    const choice = onGo.mock.calls[0][0];
    expect(choice).toEqual({
      ids: ["hatch-3", "hatch-7", "vents", "shoal-2"],
      storm: "calmer",
    });
    const openings = whatIfOpenings(fitzgerald, choice.ids);
    const leaking = openings
      .filter(isDeckOpening)
      .filter((d) => d.kind === "hatch" && !d.tight)
      .map((d) => d.id);
    expect(leaking).toEqual(["hatch-3", "hatch-7"]);
    expect(openings.filter(isDeckOpening).some((d) => d.kind === "vent")).toBe(
      true
    );
    expect(openings.filter((o) => !isDeckOpening(o))).toEqual([
      fitzgerald.shoalOpenings![1],
    ]);
    // Like the real storm puts it all back.
    fireEvent.click(screen.getByTestId("shipwreck-preset-real"));
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    expect(onGo).toHaveBeenLastCalledWith({
      ids: whatIfRealIds(fitzgerald),
      storm: "real",
    });
  });

  it("remembers her spots and storm, even none at all", () => {
    editor(fitzgerald, { ids: ["hatch-2"], storm: "worse" });
    expect(screen.getByTestId("shipwreck-chip-hatch-2")).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByTestId("shipwreck-chip-hatch-1")).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByTestId("shipwreck-storm-worse")).toHaveAttribute(
      "aria-checked",
      "true"
    );
    cleanup();
    editor(fitzgerald, { ids: [], storm: "calmer" });
    expect(screen.getByTestId("shipwreck-hole-count")).toHaveTextContent(
      "No damage"
    );
  });
});

describe("the end of a What if that never sinks", () => {
  it("an aft hit with her portholes shut floats steady, and the run ends", () => {
    const track = simulate(lusitania, whatIfOpenings(lusitania, ["tunnels"]), {
      portholesOpen: false,
    });
    expect(track.outcome).toBe("floated");
    expect(track.events.some((e) => e.kind === "floating-steady")).toBe(true);
    const words = endWords(track, lusitania, 3, { portholesOpen: false });
    expect(words.title).toBe("She stayed afloat!");
    expect(words.lines[0]).toMatch(/^With her portholes shut/);
    expect(storyEndT(track, true)).toBeLessThan(track.endT);
  });

  it("a hit far aft that breaks her in two says so", () => {
    const track = simulate(lusitania, whatIfOpenings(lusitania, ["tunnels"]));
    const words = endWords(track, lusitania, 3);
    expect(words.outcome).toBe("broke-in-two");
    expect(words.lines[0]).toMatch(
      /^She broke in two and sank \d+ minutes after the torpedo hit/
    );
    // Her stern went down first here: no line about the bow landing first.
    expect(words.lines).toHaveLength(1);
  });
});
