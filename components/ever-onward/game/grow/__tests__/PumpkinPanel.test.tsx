import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { performAction, tick } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { growUniverse as def } from "@/lib/ever-onward/universes/grow";
import { runAtPhaseStart } from "@/lib/ever-onward/universes/grow/__tests__/fixtures";
import {
  ENTER_ACTION_ID,
  FEED_ACTION_ID,
} from "@/lib/ever-onward/universes/grow/pumpkin";
import PumpkinPanel from "../PumpkinPanel";

const farmStart = runAtPhaseStart(1);

/** A rich farm with the fair open on a harvest day. */
function fairDay(): RunState {
  let run: RunState = {
    ...farmStart,
    owned: { ...farmStart.owned, tractor: 1 },
    resources: { ...farmStart.resources, harvest: 1e15, mkDay: 0 },
  };
  for (let t = 0; t < 112; t += 1) run = tick(def, run, 1);
  return run;
}

describe("PumpkinPanel", () => {
  it("renders nothing before the fair opens", () => {
    const { container } = render(
      <PumpkinPanel def={def} run={farmStart} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the risk and the odds before feeding or entering", () => {
    render(<PumpkinPanel def={def} run={fairDay()} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-pumpkin")).toHaveAttribute(
      "data-free",
      "true"
    );
    expect(screen.getByTestId("lm-pumpkin-feed")).toHaveTextContent(
      /Chance it splits: 0%/
    );
    expect(screen.getByTestId("lm-pumpkin-feed")).toHaveTextContent(/Costs/);
    expect(screen.getByTestId("lm-pumpkin-odds")).toHaveTextContent(
      /Blue ribbon \d+%, Red ribbon \d+%, Garden ribbon \d+%/
    );
    expect(screen.getByTestId("lm-pumpkin").textContent).not.toMatch(
      /best|recommend/i
    );
  });

  it("calls onAct with the feed and enter actions", async () => {
    const onAct = jest.fn();
    render(<PumpkinPanel def={def} run={fairDay()} onAct={onAct} />);
    await userEvent.click(screen.getByTestId("lm-pumpkin-feed"));
    expect(onAct).toHaveBeenCalledWith(FEED_ACTION_ID);
    await userEvent.click(screen.getByTestId("lm-pumpkin-enter"));
    expect(onAct).toHaveBeenCalledWith(ENTER_ACTION_ID);
  });

  it("locks both buttons after today's choice and says when the next harvest day is", () => {
    const fed = performAction(def, fairDay(), FEED_ACTION_ID);
    render(<PumpkinPanel def={def} run={fed} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-pumpkin-feed")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getByTestId("lm-pumpkin-enter")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getByTestId("lm-pumpkin-wait")).toHaveTextContent(
      /Next harvest day in/
    );
    expect(screen.getByTestId("lm-pumpkin-size")).toHaveTextContent(/1 of 5/);
  });
});
