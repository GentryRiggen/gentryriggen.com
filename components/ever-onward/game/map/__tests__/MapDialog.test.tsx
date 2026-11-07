import { act, fireEvent, render, screen } from "@testing-library/react";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { newUniverseSave } from "@/lib/ever-onward/engine/prestige";
import type { UniverseSave } from "@/lib/ever-onward/engine/types";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import { LIGHT_ARTIFACTS } from "@/lib/ever-onward/universes/light/map";
import MapDialog from "../MapDialog";

const finishedAt = (at: string): UniverseSave => {
  const save = newUniverseSave(def);
  return {
    ...save,
    map: { ...save.map!, at },
    run: { ...newRun(def), complete: true, time: 3000 },
  };
};

function renderMap(universe: UniverseSave, mode: "view" | "choose") {
  const onStep = jest.fn();
  const onToggle = jest.fn();
  const onClose = jest.fn();
  render(
    <MapDialog
      def={def}
      universe={universe}
      mode={mode}
      onStep={onStep}
      onToggle={onToggle}
      onClose={onClose}
    />
  );
  return { onStep, onToggle, onClose };
}

describe("MapDialog", () => {
  afterEach(() => jest.useRealTimers());

  it("never names an artifact before it is found", () => {
    renderMap(newUniverseSave(def), "view");
    for (const a of LIGHT_ARTIFACTS)
      expect(document.body.textContent).not.toContain(a.name);
    expect(
      screen.getByTestId("eo-map-square-6,2").getAttribute("aria-label")
    ).toContain("something strange is here");
    fireEvent.click(screen.getByTestId("eo-map-square-6,2"));
    expect(screen.getByTestId("eo-map-detail").textContent).toContain(
      "Something strange is here"
    );
    expect(screen.queryByTestId("eo-map-go")).toBeNull();
  });

  it("shows what a square changes, and nothing for the start", () => {
    renderMap(newUniverseSave(def), "view");
    expect(screen.getByTestId("eo-map-detail").textContent).toContain(
      "Nothing changes here."
    );
    fireEvent.click(screen.getByTestId("eo-map-square-2,3"));
    expect(screen.getByTestId("eo-map-detail").textContent).toContain(
      "Busy harbour"
    );
  });

  it("reveals the find, then offers only legal squares", () => {
    jest.useFakeTimers();
    const { onStep } = renderMap(finishedAt("1,0"), "choose");
    const reveal = screen.getByTestId("eo-map-reveal");
    expect(
      reveal.getAttribute("aria-label") ?? reveal.textContent
    ).toBeTruthy();
    act(() => jest.advanceTimersByTime(4000));
    expect(screen.getByTestId("eo-map-reveal").textContent).toContain(
      "A Gull Feather"
    );
    fireEvent.click(screen.getByTestId("eo-map-reveal-continue"));
    expect(screen.queryByTestId("eo-map-reveal")).toBeNull();
    const choosable = Array.from(
      document.querySelectorAll("[data-choosable]")
    ).map((el) => el.getAttribute("data-testid"));
    expect(choosable.sort()).toEqual(
      ["eo-map-square-1,0", "eo-map-square-1,1", "eo-map-square-2,0"].sort()
    );
    fireEvent.click(screen.getByTestId("eo-map-square-5,5"));
    expect(screen.queryByTestId("eo-map-go")).toBeNull();
    fireEvent.click(screen.getByTestId("eo-map-square-2,0"));
    fireEvent.click(screen.getByTestId("eo-map-go"));
    expect(onStep).toHaveBeenCalledWith("2,0");
  });

  it("a tap during the reveal skips to the name", () => {
    renderMap(finishedAt("1,0"), "choose");
    fireEvent.click(screen.getByTestId("eo-map-reveal-continue"));
    expect(screen.getByTestId("eo-map-reveal").textContent).toContain(
      "A Gull Feather"
    );
  });

  it("closing without choosing steps nowhere", () => {
    const { onStep, onClose } = renderMap(finishedAt("0,0"), "choose");
    expect(screen.queryByTestId("eo-map-reveal")).toBeNull();
    fireEvent.click(screen.getByLabelText("Close the map"));
    expect(onClose).toHaveBeenCalled();
    expect(onStep).not.toHaveBeenCalled();
  });

  it("the shelf shows finds with a switch for catches", () => {
    const save = newUniverseSave(def);
    const { onToggle } = renderMap(
      {
        ...save,
        map: { ...save.map!, found: ["storm-glass", "gull-feather"] },
      },
      "view"
    );
    expect(screen.getByTestId("eo-map-shelf").textContent).toContain(
      "The Storm Glass"
    );
    expect(screen.queryByTestId("eo-shelf-toggle-gull-feather")).toBeNull();
    fireEvent.click(screen.getByTestId("eo-shelf-toggle-storm-glass"));
    expect(onToggle).toHaveBeenCalledWith("storm-glass");
  });

  it("lists the keepsake for players with old upgrades", () => {
    renderMap(
      { ...newUniverseSave(def), prestigeUpgrades: { "ember-tap": 2 } },
      "view"
    );
    expect(screen.getByTestId("eo-map-shelf").textContent).toContain(
      "Keepsake"
    );
  });
});
