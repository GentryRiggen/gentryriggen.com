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
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    for (const r of radios) expect(r).toHaveAttribute("aria-disabled", "true");
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

  it("is a radio group with roving tabindex and stable labels", () => {
    render(<CountyFair def={def} run={fairRun()} onAct={jest.fn()} />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual([
      "Pumpkin 1",
      "Pumpkin 2",
      "Pumpkin 3",
    ]);
    expect(radios.map((r) => r.getAttribute("tabindex"))).toEqual([
      "0",
      "-1",
      "-1",
    ]);
    for (const r of radios) {
      expect(r).not.toHaveAttribute("disabled");
      expect(r).toHaveAttribute("aria-disabled", "false");
    }
  });

  it("totals the displayed odds to 100", () => {
    render(<CountyFair def={def} run={fairRun()} onAct={jest.fn()} />);
    for (let i = 0; i < 3; i += 1) {
      const nums = (
        screen.getByTestId(`lm-fair-odds-${i}`).textContent ?? ""
      ).match(/\d+/g);
      expect(nums?.map(Number).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });

  it("moves focus with the arrow keys, entering only on choose", async () => {
    const onAct = jest.fn();
    render(<CountyFair def={def} run={fairRun()} onAct={onAct} />);
    screen.getByRole("radio", { name: "Pumpkin 1" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Pumpkin 2" })).toHaveFocus();
    expect(onAct).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    expect(onAct).toHaveBeenCalledWith(enterActionId(1));
  });

  it("keeps focus on the same pumpkin when the fair moves to judging", () => {
    const run = fairRun();
    const { rerender } = render(
      <CountyFair def={def} run={run} onAct={jest.fn()} />
    );
    screen.getByRole("radio", { name: "Pumpkin 1" }).focus();
    const judged = performAction(def, run, enterActionId(0));
    rerender(<CountyFair def={def} run={judged} onAct={jest.fn()} />);
    const first = screen.getByRole("radio", { name: "Pumpkin 1" });
    expect(first).toHaveFocus();
    expect(first).toBeChecked();
  });

  it("has an always-present status line", () => {
    render(<CountyFair def={def} run={fairRun()} onAct={jest.fn()} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
