import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { performAction, tick } from "@/lib/ever-onward/engine/engine";
import { FESTIVAL_ACTION_ID } from "@/lib/ever-onward/universes/grow/knowhow";
import { growUniverse as def } from "@/lib/ever-onward/universes/grow";
import { runAtPhaseStart } from "@/lib/ever-onward/universes/grow/__tests__/fixtures";
import { forkActionId, forkCost } from "@/lib/ever-onward/universes/grow/forks";
import type { RunState } from "@/lib/ever-onward/engine/types";
import ForkPanel from "../ForkPanel";
import KnowHowPanel from "../KnowHowPanel";

function yardWithFork(care = 3): RunState {
  const run = runAtPhaseStart(0);
  return {
    ...run,
    owned: { ...run.owned, sprinkler: 3 },
    resources: { ...run.resources, seeds: forkCost("yard") * care },
  };
}

describe("ForkPanel", () => {
  it("renders nothing before the fork opens", () => {
    const { container } = render(
      <ForkPanel def={def} run={runAtPhaseStart(0)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows two cards, each with its blurb, its catch and its price", () => {
    render(<ForkPanel def={def} run={yardWithFork()} onAct={jest.fn()} />);
    expect(screen.getByTestId("gr-fork-0")).toHaveTextContent("Ask the bees");
    expect(screen.getByTestId("gr-fork-1")).toHaveTextContent("Bug spray");
    expect(screen.getAllByText(/The catch:/)).toHaveLength(2);
    expect(screen.getByTestId("gr-fork-0-choose")).toHaveTextContent(
      `${forkCost("yard")} seeds`
    );
  });

  it("buys the side on a click, once it is affordable", async () => {
    const onAct = jest.fn();
    render(<ForkPanel def={def} run={yardWithFork()} onAct={onAct} />);
    await userEvent.click(screen.getByTestId("gr-fork-1-choose"));
    expect(onAct).toHaveBeenCalledWith(forkActionId("yard", 1));
  });

  it("does nothing, and says how far off it is, when it cannot be afforded", async () => {
    const onAct = jest.fn();
    render(<ForkPanel def={def} run={yardWithFork(0)} onAct={onAct} />);
    const button = screen.getByTestId("gr-fork-0-choose");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveTextContent(/so far/);
    await userEvent.click(button);
    expect(onAct).not.toHaveBeenCalled();
  });

  it("marks the chosen card and closes the other one", () => {
    const chosen = performAction(def, yardWithFork(), forkActionId("yard", 0));
    render(<ForkPanel def={def} run={chosen} onAct={jest.fn()} />);
    expect(screen.getByTestId("gr-fork-0")).toHaveAttribute(
      "data-state",
      "chosen"
    );
    expect(screen.getByTestId("gr-fork-1")).toHaveAttribute(
      "data-state",
      "closed"
    );
    expect(screen.getByTestId("gr-fork-1-choose")).toHaveTextContent("Closed");
    expect(screen.getByRole("status")).toHaveTextContent(/Ask the bees/);
  });
});

describe("KnowHowPanel", () => {
  const farm = (knowhow: number): RunState => {
    const run = tick(def, runAtPhaseStart(1), 0.1);
    return {
      ...run,
      owned: { ...run.owned, scarecrow: 3, tractor: 2, well: 1 },
      resources: { ...run.resources, knowhow },
    };
  };
  const ready = (knowhow: number): RunState => tick(def, farm(knowhow), 0.1);

  it("renders nothing in the yard", () => {
    const { container } = render(
      <KnowHowPanel def={def} run={runAtPhaseStart(0)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the projects and the festival, each with its price", () => {
    render(<KnowHowPanel def={def} run={ready(500)} onAct={jest.fn()} />);
    expect(screen.getByTestId("gr-project-drip-lines")).toHaveTextContent(
      /The catch/
    );
    expect(screen.getByTestId("gr-festival")).toHaveTextContent(/3x|2x/);
    expect(screen.getByTestId("gr-festival-start")).toHaveTextContent(
      /know-how/
    );
  });

  it("starts a project or a festival on a click", async () => {
    const onAct = jest.fn();
    render(<KnowHowPanel def={def} run={ready(500)} onAct={onAct} />);
    await userEvent.click(screen.getByTestId("gr-project-drip-lines-start"));
    expect(onAct).toHaveBeenCalledWith("drip-lines");
    await userEvent.click(screen.getByTestId("gr-festival-start"));
    expect(onAct).toHaveBeenCalledWith(FESTIVAL_ACTION_ID);
  });

  it("does nothing when there is not enough know-how", async () => {
    const onAct = jest.fn();
    render(<KnowHowPanel def={def} run={ready(1)} onAct={onAct} />);
    const start = screen.getByTestId("gr-project-drip-lines-start");
    expect(start).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(start);
    await userEvent.click(screen.getByTestId("gr-festival-start"));
    expect(onAct).not.toHaveBeenCalled();
  });
});
