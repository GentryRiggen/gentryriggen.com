import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun, reconcileRun } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import FundPanel from "../FundPanel";

// The Coast has no fund (its one knob is the lamp), so the jar's panel is
// shown on the night, where it first opens.
const coastRun = (fund = 0): RunState => {
  const base = newRun(def);
  return reconcileRun(def, {
    ...base,
    phase: 1,
    owned: { gen1: 2 },
    resources: { ...base.resources, power: 1000, fund },
  });
};

describe("FundPanel", () => {
  it("is never there on the Coast", () => {
    const base = newRun(def);
    const coast = reconcileRun(def, {
      ...base,
      resources: { ...base.resources, ships: 500, coins: 1e6 },
    });
    const { container } = render(
      <FundPanel def={def} run={coast} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("is absent before the jar opens", () => {
    const { container } = render(
      <FundPanel def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("names the catch and puts coins in on tap", async () => {
    const onAct = jest.fn();
    render(<FundPanel def={def} run={coastRun()} onAct={onAct} />);
    expect(screen.getByText("Reservoir")).toBeInTheDocument();
    expect(screen.getByText(/not buying an upgrade now/)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("lm-fund-in-50"));
    expect(onAct).toHaveBeenCalledWith("fund-in-50");
    expect(screen.getByTestId("lm-fund-result")).toHaveTextContent(
      "Put 500 power in the jar."
    );
  });

  it("takes it out only when there is something in", async () => {
    const onAct = jest.fn();
    const { rerender } = render(
      <FundPanel def={def} run={coastRun()} onAct={onAct} />
    );
    await userEvent.click(screen.getByTestId("lm-fund-out"));
    expect(onAct).not.toHaveBeenCalled();
    rerender(<FundPanel def={def} run={coastRun(400)} onAct={onAct} />);
    await userEvent.click(screen.getByTestId("lm-fund-out"));
    expect(onAct).toHaveBeenCalledWith("fund-out");
  });
});
