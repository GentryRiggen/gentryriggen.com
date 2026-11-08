import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  newRun,
  performAction,
  reconcileRun,
  tick,
} from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import { TUNING } from "@/lib/ever-onward/universes/light/tuning";
import {
  POST_SCHOOL,
  POST_WATCH,
  crewPostActionId,
} from "@/lib/ever-onward/universes/light/weather";
import CrewsPanel from "../CrewsPanel";
import GridPanel from "../GridPanel";

const G = TUNING.grid;

function nightRun(
  owned: Record<string, number> = {},
  resources: Record<string, number> = {}
): RunState {
  const base = newRun(def);
  return tick(
    def,
    reconcileRun(def, {
      ...base,
      phase: 1,
      owned: { gen1: 5, gen2: 3, "lines-1": 1, ...owned },
      resources: { ...base.resources, night: 80, power: 1000, ...resources },
    }),
    1
  );
}

describe("GridPanel", () => {
  it("is absent before the grid opens", () => {
    const { container } = render(
      <GridPanel def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the day, tonight's rush and the three things that carry it", () => {
    const run = nightRun({ "batt-1": 1, "batt-2": 1 }, { pgCharge: 150 });
    render(<GridPanel def={def} run={run} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-grid")).toHaveAttribute("data-part", "Day");
    expect(screen.getByTestId("lm-day-strip")).toBeInTheDocument();
    expect(screen.getByTestId("lm-grid-tonight")).toHaveTextContent(
      /Tonight's rush: a mild evening, in/
    );
    expect(screen.getByTestId("lm-grid-plants")).toHaveTextContent(/MW/);
    expect(screen.getByTestId("lm-grid-lines")).toHaveTextContent(/MW/);
    expect(screen.getByTestId("lm-grid-batteries")).toHaveTextContent(/s/);
  });

  it("never says which streetlights to pick", () => {
    const run = nightRun({ "batt-1": 1 });
    render(<GridPanel def={def} run={run} onAct={jest.fn()} />);
    const text = screen.getByTestId("lm-grid").textContent ?? "";
    expect(text).not.toMatch(/best|recommend|should|dim your|set the/i);
  });

  it("says the rush is on, and is kind about a dark evening", () => {
    const run = nightRun(
      { "batt-1": 1 },
      { pgStarted: 1, pgClock: G.rushAt + 3, pgRush: 1, pgLast: 2 }
    );
    render(<GridPanel def={def} run={run} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-grid-part")).toHaveTextContent(
      "Evening rush"
    );
    expect(screen.getByTestId("lm-grid-result")).toHaveTextContent(
      /costs a little power, nothing more/
    );
  });
});

describe("CrewsPanel", () => {
  it("is absent until the grid opens", () => {
    const { container } = render(
      <CrewsPanel def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists every crew with its posts, and posts one on tap", async () => {
    const onAct = jest.fn();
    const run = nightRun();
    render(<CrewsPanel def={def} run={run} onAct={onAct} />);
    expect(screen.getByTestId("lm-crews")).toHaveAttribute("data-crews", "2");
    expect(screen.getByTestId("lm-crew-0-post-0")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await userEvent.click(screen.getByTestId("lm-crew-1-post-1"));
    expect(onAct).toHaveBeenCalledWith(crewPostActionId(1, POST_SCHOOL));
    // the watch posts open with the weather desk (three steam plants here)
    await userEvent.click(screen.getByTestId(`lm-crew-0-post-${POST_WATCH}`));
    expect(onAct).toHaveBeenCalledWith(crewPostActionId(0, POST_WATCH));
  });

  it("shows a crew on the road, and nothing to tap for where it already is", async () => {
    const onAct = jest.fn();
    const run = performAction(
      def,
      nightRun(),
      crewPostActionId(0, POST_SCHOOL)
    );
    render(<CrewsPanel def={def} run={run} onAct={onAct} />);
    expect(screen.getByTestId("lm-crew-0")).toHaveAttribute(
      "data-moving",
      "true"
    );
    expect(screen.getByTestId("lm-crew-0")).toHaveTextContent(/on the road/);
    await userEvent.click(screen.getByTestId("lm-crew-0-post-1"));
    expect(onAct).not.toHaveBeenCalled();
  });

  it("offers a third crew once it is hired", () => {
    render(
      <CrewsPanel
        def={def}
        run={nightRun({ "storm-crews": 1 })}
        onAct={jest.fn()}
      />
    );
    expect(screen.getByTestId("lm-crew-2")).toBeInTheDocument();
  });
});
