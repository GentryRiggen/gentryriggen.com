import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun, performAction, tick } from "@/lib/ever-onward/engine/engine";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import {
  HAUL_ACTION,
  SET_NETS_ACTION,
  netState,
} from "@/lib/ever-onward/universes/light/tide";
import type { RunState } from "@/lib/ever-onward/engine/types";
import TideClock from "../TideClock";

function openRun(): RunState {
  const base = newRun(def);
  return tick(
    def,
    {
      ...base,
      owned: { keeper: 5, "dock-1": 1 },
      resources: { ...base.resources, coins: 500 },
    },
    0.1
  );
}

function fullRun(): RunState {
  let run = performAction(def, openRun(), SET_NETS_ACTION);
  for (let t = 0; t < 400 && netState(run) !== "full"; t += 1)
    run = tick(def, run, 1);
  return run;
}

describe("TideClock", () => {
  it("is absent before the clock opens", () => {
    const { container } = render(
      <TideClock def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("counts down to high tide and offers to set the nets", async () => {
    const onAct = jest.fn();
    render(<TideClock def={def} run={openRun()} onAct={onAct} />);
    expect(screen.getByTestId("lm-tide-headline")).toHaveTextContent(
      "High tide in 1:28"
    );
    const button = screen.getByTestId("lm-tide-button");
    expect(button).toHaveTextContent("Set the nets");
    await userEvent.click(button);
    expect(onAct).toHaveBeenCalledWith(SET_NETS_ACTION);
  });

  it("waits, disabled, while the nets fill", () => {
    const run = performAction(def, openRun(), SET_NETS_ACTION);
    render(<TideClock def={def} run={run} onAct={jest.fn()} />);
    const button = screen.getByTestId("lm-tide-button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Waiting for high tide…");
    expect(screen.getByTestId("lm-tide-panel")).toHaveAttribute(
      "data-nets",
      "set"
    );
  });

  it("offers to haul in when the nets are full", async () => {
    const onAct = jest.fn();
    render(<TideClock def={def} run={fullRun()} onAct={onAct} />);
    const button = screen.getByTestId("lm-tide-button");
    expect(button).toHaveTextContent("Haul in!");
    expect(button).toHaveTextContent(/about \+[\d.,]+K? coins/);
    await userEvent.click(button);
    expect(onAct).toHaveBeenCalledWith(HAUL_ACTION);
  });

  it("shows the result line and tally after a haul", () => {
    const hauled = performAction(def, fullRun(), HAUL_ACTION);
    render(<TideClock def={def} run={hauled} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-tide-result")).toHaveTextContent(/\+\d/);
    expect(screen.getByText(/Hauls so far: 1/)).toBeInTheDocument();
  });
});
