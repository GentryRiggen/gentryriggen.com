import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { growUniverse as def } from "@/lib/ever-onward/universes/grow";
import { runAtPhaseStart } from "@/lib/ever-onward/universes/grow/__tests__/fixtures";
import {
  plantActionId,
  plantCrop,
} from "@/lib/ever-onward/universes/grow/market";
import MarketPanel from "../MarketPanel";

describe("MarketPanel", () => {
  it("renders nothing outside the farm", () => {
    const { container } = render(
      <MarketPanel def={def} run={runAtPhaseStart(0)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("is a radio group with the planted crop checked and roving tabindex", () => {
    render(
      <MarketPanel def={def} run={runAtPhaseStart(1)} onAct={jest.fn()} />
    );
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Tomatoes" })).toBeChecked();
    expect(radios.map((r) => r.getAttribute("tabindex"))).toEqual([
      "0",
      "-1",
      "-1",
    ]);
    for (const r of radios) expect(r).not.toBeDisabled();
  });

  it("moves focus with the arrow keys, planting only on choose", async () => {
    const onAct = jest.fn();
    render(<MarketPanel def={def} run={runAtPhaseStart(1)} onAct={onAct} />);
    screen.getByRole("radio", { name: "Tomatoes" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    const corn = screen.getByRole("radio", { name: "Corn" });
    expect(corn).toHaveFocus();
    expect(corn).toHaveAttribute("tabindex", "0");
    expect(onAct).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    expect(onAct).toHaveBeenCalledWith(plantActionId("corn"));
  });

  it("says what happened in a status line, with the same labels", () => {
    const run = runAtPhaseStart(1);
    const planted = { ...run, resources: { ...run.resources } };
    plantCrop(planted, "pumpkin");
    render(<MarketPanel def={def} run={planted} onAct={jest.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      /Pumpkins are sprouting/
    );
    expect(screen.getByRole("radio", { name: "Pumpkins" })).toBeChecked();
  });
});
