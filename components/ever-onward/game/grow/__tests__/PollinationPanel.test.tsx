import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun, performAction, tick } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  addBeeActionId,
  plantActionId,
} from "@/lib/ever-onward/universes/grow/bees";
import { growUniverse as def } from "@/lib/ever-onward/universes/grow";
import PollinationPanel from "../PollinationPanel";

function beeRun(): RunState {
  const base = newRun(def);
  const run = tick(
    def,
    {
      ...base,
      owned: { ...base.owned, sprinkler: 5, "bee-hive": 2 },
      resources: { ...base.resources, seeds: 1e6 },
    },
    0.1
  );
  return run;
}

describe("PollinationPanel", () => {
  it("renders nothing before the first hive", () => {
    const { container } = render(
      <PollinationPanel def={def} run={newRun(def)} onAct={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers to plant each bed, then to send bees to it", async () => {
    const onAct = jest.fn();
    const run = beeRun();
    const { rerender } = render(
      <PollinationPanel def={def} run={run} onAct={onAct} />
    );
    expect(screen.getByTestId("eo-bees")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("eo-bed-0-plant"));
    expect(onAct).toHaveBeenCalledWith(plantActionId(0));

    const planted = performAction(def, run, plantActionId(0));
    const working = performAction(def, planted, addBeeActionId(0));
    rerender(<PollinationPanel def={def} run={working} onAct={onAct} />);
    expect(screen.getByTestId("eo-bed-0-bees")).toHaveTextContent("1 bee");
    expect(screen.getByTestId("eo-bed-0")).toHaveTextContent(/honey\/sec/);
    await userEvent.click(screen.getByTestId("eo-bed-0-add"));
    expect(onAct).toHaveBeenCalledWith(addBeeActionId(0));
  });

  it("warns when there is not enough honey for winter", () => {
    render(<PollinationPanel def={def} run={beeRun()} onAct={() => {}} />);
    expect(screen.getByTestId("eo-bees-honey")).toHaveTextContent(
      /bees will leave/
    );
  });
});
