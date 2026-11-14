import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tick } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { growUniverse as def } from "@/lib/ever-onward/universes/grow";
import { runAtPhaseStart } from "@/lib/ever-onward/universes/grow/__tests__/fixtures";
import {
  plantActionId,
  plantCrop,
} from "@/lib/ever-onward/universes/grow/market";
import MarketPanel from "../MarketPanel";

/** A fresh farm at the start of a harvest day, nothing planted. */
const farm = (): RunState => {
  const run = runAtPhaseStart(1);
  return {
    ...run,
    resources: { ...run.resources, mkDay: 0, mkField: 0, mkLast: 0 },
  };
};

describe("MarketPanel", () => {
  it("renders nothing outside the farm", () => {
    const { container } = render(
      <MarketPanel def={def} run={runAtPhaseStart(0)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("is a radio group of four crops with roving tabindex, none in the ground at first", () => {
    render(<MarketPanel def={def} run={farm()} onAct={jest.fn()} />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    for (const r of radios) expect(r).not.toBeChecked();
    expect(radios.map((r) => r.getAttribute("tabindex"))).toEqual([
      "0",
      "-1",
      "-1",
      "-1",
    ]);
    expect(screen.getByRole("radio", { name: "Beans" })).toBeInTheDocument();
  });

  it("moves focus with the arrow keys, planting only on choose", async () => {
    const onAct = jest.fn();
    render(<MarketPanel def={def} run={farm()} onAct={onAct} />);
    screen.getByRole("radio", { name: "Tomatoes" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    const corn = screen.getByRole("radio", { name: "Corn" });
    expect(corn).toHaveFocus();
    expect(corn).toHaveAttribute("tabindex", "0");
    expect(onAct).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    expect(onAct).toHaveBeenCalledWith(plantActionId("corn"));
  });

  it("shows the forecast as a range that narrows as harvest day gets closer, and never names a best crop", () => {
    const early = farm();
    const { rerender } = render(
      <MarketPanel def={def} run={early} onAct={jest.fn()} />
    );
    const rangeAt = (run: RunState) => {
      rerender(<MarketPanel def={def} run={run} onAct={jest.fn()} />);
      return screen.getByTestId("lm-market-corn-order").textContent ?? "";
    };
    expect(rangeAt(early)).toMatch(/Towns pay \d+% to \d+%/);
    expect(screen.getByTestId("lm-market-stage")).toHaveTextContent(
      /rough guess/i
    );
    let late = early;
    for (let t = 0; t < 100; t += 1) late = tick(def, late, 1);
    expect(rangeAt(late)).toMatch(/Towns pay \d+%, sure/);
    expect(screen.getByTestId("lm-market-stage")).toHaveTextContent(/sure/i);
    expect(screen.getByTestId("lm-market").textContent).not.toMatch(
      /most wanted|best|recommend/i
    );
  });

  it("checks the crop in the ground and shows what the soil will do", () => {
    const run = farm();
    const planted = { ...run, resources: { ...run.resources } };
    plantCrop(planted, "corn");
    // the same crop was harvested last time: planting it again wears the soil
    planted.resources.mkLast = 2;
    render(<MarketPanel def={def} run={planted} onAct={jest.fn()} />);
    expect(screen.getByRole("radio", { name: "Corn" })).toBeChecked();
    expect(screen.getByTestId("lm-market-corn-order")).toHaveTextContent(
      /wears the soil/
    );
    expect(screen.getByTestId("lm-market-beans-order")).toHaveTextContent(
      /Rests the soil/
    );
    expect(screen.getByTestId("lm-soil")).toHaveTextContent(/Soil: /);
  });

  it("says what happened on the last harvest day, in plain words", () => {
    let run = farm();
    for (let t = 0; t < 112; t += 1) run = tick(def, run, 1);
    render(<MarketPanel def={def} run={run} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-market-result")).toHaveTextContent(
      /field was empty/
    );
  });
});
