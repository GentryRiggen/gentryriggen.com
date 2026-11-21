import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ShipWhatIf } from "@/lib/shipwreck/save";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { simulate, whatIfOpenings } from "@/lib/shipwreck/sim/run";
import { endWords, storyEndT } from "@/lib/shipwreck/story";
import WhatIfEditor, { REAL_NIGHT_IDS, realWhatIfIds } from "../WhatIfEditor";

function editor(spec = lusitania, initial: ShipWhatIf = { ids: [] }) {
  const onGo = jest.fn();
  render(
    <WhatIfEditor spec={spec} initial={initial} onBack={() => {}} onGo={onGo} />
  );
  return onGo;
}

describe("What if? for a torpedo ship", () => {
  it("offers her main spaces along the side for the hit, not the bunkers", () => {
    editor();
    const group = screen.getByRole("radiogroup", {
      name: "Where the torpedo hits",
    });
    const chips = within(group).getAllByRole("radio");
    expect(chips).toHaveLength(12);
    expect(screen.queryByTestId("shipwreck-chip-br1-stbd")).toBeNull();
    // The real afternoon to start with: the hit beside the front boiler room.
    expect(screen.getByTestId("shipwreck-chip-br1")).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByTestId("shipwreck-hole-count")).toHaveTextContent(
      "Hits: Boiler room 1"
    );
    expect(screen.queryByTestId("shipwreck-preset-clear")).toBeNull();
    // The plan from above shows her side bunkers.
    expect(screen.getByTestId("shipwreck-plan")).toBeInTheDocument();
  });

  it("moves the one hit and goes with the portholes as chosen (open by default)", () => {
    const onGo = editor();
    const portholes = screen.getByTestId("shipwreck-portholes");
    expect(portholes).toHaveAttribute("aria-pressed", "true");
    expect(portholes).toHaveTextContent("Portholes open");
    fireEvent.click(screen.getByTestId("shipwreck-chip-turbine"));
    expect(screen.getByTestId("shipwreck-chip-br1")).toHaveAttribute(
      "aria-checked",
      "false"
    );
    fireEvent.click(portholes);
    expect(portholes).toHaveTextContent("Portholes shut");
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    expect(onGo).toHaveBeenCalledWith({
      ids: ["turbine"],
      portholesOpen: false,
    });
    // Like the real afternoon: back to the real spot, portholes open.
    fireEvent.click(screen.getByTestId("shipwreck-preset-real"));
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    expect(onGo).toHaveBeenLastCalledWith({
      ids: ["br1"],
      portholesOpen: true,
    });
  });

  it("remembers her last What if, and never takes the Titanic's ids", () => {
    editor(lusitania, { ids: ["hold2"], portholesOpen: false });
    expect(screen.getByTestId("shipwreck-chip-hold2")).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByTestId("shipwreck-portholes")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
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
    expect(screen.getByTestId("shipwreck-hole-count")).toHaveTextContent(
      "6 holes"
    );
    fireEvent.click(screen.getByTestId("shipwreck-preset-clear"));
    fireEvent.click(screen.getByTestId("shipwreck-chip-hold1"));
    fireEvent.click(screen.getByTestId("shipwreck-chip-hold2"));
    fireEvent.click(screen.getByTestId("shipwreck-go"));
    expect(onGo).toHaveBeenCalledWith({ ids: ["hold1", "hold2"] });
    expect(
      screen
        .getAllByRole("button", { pressed: true })
        .map((b) => b.dataset.testid)
    ).toEqual(
      expect.arrayContaining(["shipwreck-chip-hold1", "shipwreck-chip-hold2"])
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
