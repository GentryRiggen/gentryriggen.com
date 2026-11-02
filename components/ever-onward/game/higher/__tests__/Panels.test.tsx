import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { performAction, tick } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { higherUniverse as def } from "@/lib/ever-onward/universes/higher";
import { runAtPhaseStart } from "@/lib/ever-onward/universes/higher/__tests__/fixtures";
import { loadActionId } from "@/lib/ever-onward/universes/higher/deliveries";
import { footingActionId } from "@/lib/ever-onward/universes/higher/footing";
import {
  forkActionId,
  forkCost,
} from "@/lib/ever-onward/universes/higher/forks";
import { OVERTIME_ACTION_ID } from "@/lib/ever-onward/universes/higher/knowhow";
import { STEADY_ACTION_ID } from "@/lib/ever-onward/universes/higher/sway";
import DeliveryPanel from "../DeliveryPanel";
import FootingPanel from "../FootingPanel";
import ForkPanel from "../ForkPanel";
import KnowHowPanel from "../KnowHowPanel";
import SwayPanel from "../SwayPanel";

function playroom(bears = 4, extra: Record<string, number> = {}): RunState {
  const run = runAtPhaseStart(0);
  return {
    ...run,
    owned: { ...run.owned, bear: bears },
    resources: { ...run.resources, blocks: forkCost("play") * 3, ...extra },
  };
}

function town(extra: Record<string, number> = {}): RunState {
  const run = runAtPhaseStart(1);
  // A moment's tick lets the project show up on the shelf.
  return tick(
    def,
    {
      ...run,
      owned: { mason: 3, "cross-braces": 1 },
      resources: { ...run.resources, ...extra },
    },
    0.1
  );
}

describe("ForkPanel", () => {
  it("renders nothing before the fork opens", () => {
    const { container } = render(
      <ForkPanel def={def} run={runAtPhaseStart(0)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows two cards, each with its picture, its blurb, its catch and its price", () => {
    render(<ForkPanel def={def} run={playroom()} onAct={jest.fn()} />);
    expect(screen.getByTestId("bh-fork-0")).toHaveTextContent("Tall and thin");
    expect(screen.getByTestId("bh-fork-1")).toHaveTextContent(
      "Wide and sturdy"
    );
    expect(screen.getAllByText(/The catch:/)).toHaveLength(2);
    expect(screen.getByTestId("bh-fork-art-play-0")).toBeInTheDocument();
    expect(screen.getByTestId("bh-fork-art-play-1")).toBeInTheDocument();
    expect(screen.getByTestId("bh-fork-0-choose")).toHaveTextContent(
      `${forkCost("play")} blocks`
    );
  });

  it("buys the side on a click and then closes the other", async () => {
    const onAct = jest.fn();
    const { rerender } = render(
      <ForkPanel def={def} run={playroom()} onAct={onAct} />
    );
    await userEvent.click(screen.getByTestId("bh-fork-1-choose"));
    expect(onAct).toHaveBeenCalledWith(forkActionId("play", 1));
    const chosen = performAction(def, playroom(), forkActionId("play", 1));
    rerender(<ForkPanel def={def} run={chosen} onAct={onAct} />);
    expect(screen.getByTestId("bh-fork-1")).toHaveAttribute(
      "data-state",
      "chosen"
    );
    expect(screen.getByTestId("bh-fork-0")).toHaveAttribute(
      "data-state",
      "closed"
    );
  });

  it("does nothing, and says how far off it is, when it cannot be afforded", async () => {
    const onAct = jest.fn();
    render(
      <ForkPanel def={def} run={playroom(4, { blocks: 0 })} onAct={onAct} />
    );
    const button = screen.getByTestId("bh-fork-0-choose");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveTextContent(/so far/);
    await userEvent.click(button);
    expect(onAct).not.toHaveBeenCalled();
  });
});

describe("FootingPanel", () => {
  it("is a radio group of three shares, with the current one checked", () => {
    render(<FootingPanel def={def} run={playroom(3)} onAct={jest.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("bh-footing-1")).toHaveTextContent(
      /Settles at \+\d+% pay/
    );
  });

  it("changes the share on a click", async () => {
    const onAct = jest.fn();
    render(<FootingPanel def={def} run={playroom(3)} onAct={onAct} />);
    await userEvent.click(screen.getByTestId("bh-footing-1"));
    expect(onAct).toHaveBeenCalledWith(footingActionId(1));
  });

  it("is hidden until the first helper has two levels", () => {
    const { container } = render(
      <FootingPanel def={def} run={playroom(1)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("SwayPanel", () => {
  it("steadies a leaning tower on a click", async () => {
    const onAct = jest.fn();
    render(
      <SwayPanel def={def} run={playroom(3, { sway: 0.8 })} onAct={onAct} />
    );
    expect(screen.getByTestId("bh-sway")).toHaveAttribute(
      "data-state",
      "wobbling"
    );
    await userEvent.click(screen.getByTestId("bh-steady"));
    expect(onAct).toHaveBeenCalledWith(STEADY_ACTION_ID);
  });

  it("says the tower is standing straight, and the button waits", async () => {
    const onAct = jest.fn();
    render(<SwayPanel def={def} run={playroom(3)} onAct={onAct} />);
    const button = screen.getByTestId("bh-steady");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveTextContent("Standing straight");
    await userEvent.click(button);
    expect(onAct).not.toHaveBeenCalled();
  });
});

describe("KnowHowPanel", () => {
  it("offers an overtime shift and a project with the same pile of know-how", async () => {
    const onAct = jest.fn();
    render(
      <KnowHowPanel
        def={def}
        run={town({ knowhow: 200, bricks: 0 })}
        onAct={onAct}
      />
    );
    expect(screen.getByTestId("bh-overtime")).toBeInTheDocument();
    expect(screen.getByTestId("bh-project-hard-hats")).toHaveTextContent(
      /The catch:/
    );
    await userEvent.click(screen.getByTestId("bh-overtime-start"));
    expect(onAct).toHaveBeenCalledWith(OVERTIME_ACTION_ID);
    await userEvent.click(screen.getByTestId("bh-project-hard-hats-start"));
    expect(onAct).toHaveBeenCalledWith("hard-hats");
  });

  it("renders nothing in the playroom", () => {
    const { container } = render(
      <KnowHowPanel def={def} run={playroom()} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("DeliveryPanel", () => {
  it("says a delivery is on its way, and nothing is lost by waiting", () => {
    render(<DeliveryPanel def={def} run={playroom(3)} onAct={jest.fn()} />);
    expect(screen.getByTestId("bh-deliveries")).toHaveAttribute(
      "data-here",
      "no"
    );
    expect(screen.getAllByText("Waiting")).toHaveLength(3);
  });

  it("shows three loads when one arrives, marks the best one and places it on a click", async () => {
    const onAct = jest.fn();
    render(
      <DeliveryPanel
        def={def}
        run={playroom(3, { dlStage: 1, sway: 0.95, ftStock: 1e9 })}
        onAct={onAct}
      />
    );
    expect(screen.getByTestId("bh-load-1")).toHaveAttribute("data-best", "yes");
    expect(screen.getByTestId("bh-load-1")).toHaveTextContent(
      /straighter tower/
    );
    await userEvent.click(screen.getByTestId("bh-load-1-place"));
    expect(onAct).toHaveBeenCalledWith(loadActionId(1));
  });
});
