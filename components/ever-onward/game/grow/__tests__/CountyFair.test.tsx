import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun, performAction, tick } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  enterActionId,
  isFairOn,
  likeliestPumpkin,
} from "@/lib/ever-onward/universes/grow/fair";
import { growUniverse as def } from "@/lib/ever-onward/universes/grow";
import CountyFair from "../CountyFair";

function openRun(): RunState {
  const base = newRun(def);
  return tick(
    def,
    { ...base, phase: 1, owned: { scarecrow: 6, tractor: 1 } },
    0.1
  );
}

function fairRun(): RunState {
  let run = openRun();
  for (let t = 0; t < 400 && !isFairOn(run); t += 1) run = tick(def, run, 1);
  return run;
}

describe("CountyFair", () => {
  it("renders nothing before the fair opens", () => {
    const { container } = render(
      <CountyFair def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("waits, with the buttons off, until the pumpkins are ready", () => {
    render(<CountyFair def={def} run={openRun()} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-fair")).toHaveAttribute(
      "data-stage",
      "waiting"
    );
    expect(screen.queryByTestId("lm-fair-enter-0")).toBeNull();
  });

  it("shows the odds before entering and calls onAct with fair-enter-<n>", async () => {
    const onAct = jest.fn();
    const run = fairRun();
    render(<CountyFair def={def} run={run} onAct={onAct} />);
    expect(screen.getByTestId("lm-fair")).toHaveAttribute("data-stage", "open");
    expect(screen.getByTestId("lm-fair-odds-0")).toHaveTextContent(
      /Blue \d+%, red \d+%, garden \d+%/
    );
    const best = likeliestPumpkin(run);
    await userEvent.click(screen.getByTestId(`lm-fair-enter-${best}`));
    expect(onAct).toHaveBeenCalledWith(enterActionId(best));
  });

  it("shows a kind result line after the judges decide", () => {
    let run = performAction(def, fairRun(), enterActionId(0));
    for (let t = 0; t < 10; t += 1) run = tick(def, run, 1);
    render(<CountyFair def={def} run={run} onAct={jest.fn()} />);
    const line = screen.getByTestId("lm-fair-result").textContent ?? "";
    expect(line).toMatch(/ribbon/);
    expect(line).not.toMatch(/lose|lost|fail|wrong|bad/i);
  });
});
