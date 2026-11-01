import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun, performAction, tick } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  danceHint,
  followActionId,
  isDancing,
} from "@/lib/ever-onward/universes/grow/bees";
import { growUniverse as def } from "@/lib/ever-onward/universes/grow";
import BeeDance, { describeDance } from "../BeeDance";

function openRun(): RunState {
  const base = newRun(def);
  return tick(def, { ...base, owned: { sprinkler: 6, "bee-hive": 1 } }, 0.1);
}

function dancingRun(): RunState {
  let run = openRun();
  for (let t = 0; t < 400 && !isDancing(run); t += 1) run = tick(def, run, 1);
  return run;
}

describe("BeeDance", () => {
  it("renders nothing until the bees arrive", () => {
    const { container } = render(
      <BeeDance def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("waits, with the buttons off, while the bees forage", () => {
    render(<BeeDance def={def} run={openRun()} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-bees")).toHaveAttribute(
      "data-stage",
      "foraging"
    );
    expect(screen.getByTestId("lm-bees-follow-0")).toBeDisabled();
  });

  it("follows a patch on click and calls onAct with bees-follow-<n>", async () => {
    const onAct = jest.fn();
    const run = dancingRun();
    render(<BeeDance def={def} run={run} onAct={onAct} />);
    expect(screen.getByTestId("lm-bees")).toHaveAttribute(
      "data-stage",
      "dancing"
    );
    const hint = danceHint(run);
    await userEvent.click(screen.getByTestId(`lm-bees-follow-${hint}`));
    expect(onAct).toHaveBeenCalledWith(followActionId(hint));
  });

  it("shows a kind result line after a follow", () => {
    const run = dancingRun();
    const followed = performAction(def, run, followActionId(danceHint(run)));
    render(<BeeDance def={def} run={followed} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-bees-result")).toHaveTextContent(
      /The bees were right/
    );
  });

  it("describes the dance in plain words", () => {
    expect(describeDance(0, 0.2)).toBe(
      "The bee waggles straight up, a short way off."
    );
    expect(describeDance(130, 0.8)).toMatch(/down and to the right, far/);
  });
});
