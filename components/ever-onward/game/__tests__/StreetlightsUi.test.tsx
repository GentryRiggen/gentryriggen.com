import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  newRun,
  performAction,
  reconcileRun,
} from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import StreetlightsPanel from "../StreetlightsPanel";

const nightRun = (): RunState => {
  const base = newRun(def);
  return reconcileRun(def, {
    ...base,
    phase: 1,
    owned: { gen1: 5, gen2: 3 },
    resources: { ...base.resources, night: 99 },
  });
};

describe("StreetlightsPanel", () => {
  it("is absent before the grid is in play", () => {
    const { container } = render(
      <StreetlightsPanel def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("is a radio group with Bright checked, and picks a step on tap", async () => {
    const onAct = jest.fn();
    render(<StreetlightsPanel def={def} run={nightRun()} onAct={onAct} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(screen.getByRole("radio", { name: "Bright" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await userEvent.click(screen.getByRole("radio", { name: "Soft glow" }));
    expect(onAct).toHaveBeenCalledWith("streetlights-0");
    // Choosing the checked one again does nothing.
    await userEvent.click(screen.getByRole("radio", { name: "Bright" }));
    expect(onAct).toHaveBeenCalledTimes(1);
  });

  it("moves focus with the arrow keys without choosing", async () => {
    const onAct = jest.fn();
    render(<StreetlightsPanel def={def} run={nightRun()} onAct={onAct} />);
    screen.getByRole("radio", { name: "Bright" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Dazzling" })).toHaveFocus();
    expect(onAct).not.toHaveBeenCalled();
  });

  it("says the choice once in the status line", () => {
    const run = performAction(def, nightRun(), "streetlights-0");
    render(<StreetlightsPanel def={def} run={run} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-lamps-result")).toHaveTextContent(
      "The streetlights are set to soft glow."
    );
  });
});
