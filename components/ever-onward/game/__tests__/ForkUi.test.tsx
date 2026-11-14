import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  newRun,
  performAction,
  reconcileRun,
} from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import ForkPanel from "../ForkPanel";

const nightRun = (power = 1e6): RunState => {
  const base = newRun(def);
  return reconcileRun(def, {
    ...base,
    phase: 1,
    owned: { gen1: 5, gen2: 3 },
    resources: { ...base.resources, night: 80, power },
  });
};

describe("ForkPanel", () => {
  it("is absent until the fork opens", () => {
    const { container } = render(
      <ForkPanel def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows two cards, each with its numbers and its catch", () => {
    render(<ForkPanel def={def} run={nightRun()} onAct={jest.fn()} />);
    const coal = screen.getByTestId("lm-fork-coal");
    const wind = screen.getByTestId("lm-fork-wind");
    expect(
      within(coal).getByRole("heading", { name: "Coal" })
    ).toBeInTheDocument();
    expect(within(coal).getByText(/The catch: /)).toBeInTheDocument();
    expect(within(wind).getByText(/The catch: /)).toBeInTheDocument();
    expect(within(coal).getByText(/Power\/sec/)).toBeInTheDocument();
    expect(screen.getByTestId("lm-fork")).not.toHaveAttribute("data-chosen");
  });

  it("chooses a side on tap", async () => {
    const onAct = jest.fn();
    render(<ForkPanel def={def} run={nightRun()} onAct={onAct} />);
    await userEvent.click(screen.getByTestId("lm-fork-wind-choose"));
    expect(onAct).toHaveBeenCalledWith("fork-wind");
  });

  it("will not choose what it can't pay for, and says it is saving up", async () => {
    const onAct = jest.fn();
    render(<ForkPanel def={def} run={nightRun(100)} onAct={onAct} />);
    expect(screen.getAllByText("Saving up")).toHaveLength(2);
    await userEvent.click(screen.getByTestId("lm-fork-coal-choose"));
    expect(onAct).not.toHaveBeenCalled();
  });

  it("closes the other card once one is chosen", () => {
    const chosen = performAction(def, nightRun(), "fork-coal");
    render(<ForkPanel def={def} run={chosen} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-fork-coal")).toHaveAttribute(
      "data-state",
      "yours"
    );
    expect(screen.getByTestId("lm-fork-wind")).toHaveAttribute(
      "data-state",
      "closed"
    );
    expect(screen.queryByTestId("lm-fork-coal-choose")).toBeNull();
    expect(screen.getByTestId("lm-fork-result")).toHaveTextContent(
      "The other way is closed"
    );
  });
});
