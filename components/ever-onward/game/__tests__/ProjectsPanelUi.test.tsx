import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  newRun,
  reconcileRun,
  startProject,
} from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import ProjectsPanel from "../ProjectsPanel";

const nightRun = (knowhow: number): RunState => {
  const base = newRun(def);
  return reconcileRun(def, {
    ...base,
    phase: 1,
    owned: { gen1: 2, gen2: 1 },
    resources: { ...base.resources, night: 99, knowhow, power: 500 },
  });
};

describe("ProjectsPanel", () => {
  it("is absent before any project is offered", () => {
    const { container } = render(
      <ProjectsPanel def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows each card's effect and catch, and starts one on tap", async () => {
    const onAct = jest.fn();
    const run = nightRun(50);
    const { rerender } = render(
      <ProjectsPanel def={def} run={run} onAct={onAct} />
    );
    const card = screen.getByTestId("lm-project-night-school");
    expect(card).toHaveTextContent("Know-how/sec");
    expect(card).toHaveTextContent("The catch:");
    await userEvent.click(screen.getByTestId("lm-project-night-school-start"));
    expect(onAct).toHaveBeenCalledWith("night-school");
    rerender(
      <ProjectsPanel
        def={def}
        run={startProject(def, run, "night-school")}
        onAct={onAct}
      />
    );
    expect(screen.getByTestId("lm-projects-result")).toHaveTextContent(
      "Night school: done!"
    );
  });

  it("marks what can't be afforded yet, and does nothing on tap", async () => {
    const onAct = jest.fn();
    render(<ProjectsPanel def={def} run={nightRun(0)} onAct={onAct} />);
    const start = screen.getByTestId("lm-project-smart-meters-start");
    expect(start).toHaveAttribute("aria-disabled", "true");
    expect(start).toHaveTextContent("Saving up");
    await userEvent.click(start);
    expect(onAct).not.toHaveBeenCalled();
  });

  it("lists what is done", () => {
    const run = startProject(def, nightRun(50), "night-school");
    render(<ProjectsPanel def={def} run={run} onAct={jest.fn()} />);
    expect(screen.getByText(/Done: Night school/)).toBeInTheDocument();
    expect(screen.queryByTestId("lm-project-night-school")).toBeNull();
  });
});
