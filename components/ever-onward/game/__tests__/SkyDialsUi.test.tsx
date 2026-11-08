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
import { openSkyDials } from "@/lib/ever-onward/universes/light/sunEdge";
import ProbeDesignPanel from "../ProbeDesignPanel";
import SunEdgePanel from "../SunEdgePanel";

function skyRun(resources: Record<string, number> = {}): RunState {
  const base = newRun(def);
  const run = reconcileRun(def, {
    ...base,
    phase: 2,
    owned: { collector: 4, probe: 1 },
    resources: { ...base.resources, probes: 30, collectors: 4, ...resources },
  });
  openSkyDials(run);
  const open = tick(def, run, 1);
  // Set after the dials open, which plans the first flare.
  for (const [id, value] of Object.entries(resources))
    if (id.startsWith("sk")) open.resources[id] = value;
  return open;
}

/** Renders a panel the way the game does: `onAct` performs the action and re-renders. */
function renderPanel(
  Panel: typeof SunEdgePanel | typeof ProbeDesignPanel,
  start: RunState
) {
  let run = start;
  const view = render(<Panel def={def} run={run} onAct={() => undefined} />);
  const onAct = (id: string) => {
    run = performAction(def, run, id);
    view.rerender(<Panel def={def} run={run} onAct={onAct} />);
  };
  view.rerender(<Panel def={def} run={run} onAct={onAct} />);
  return { view, current: () => run };
}

describe("SunEdgePanel", () => {
  it("is absent before the dials open", () => {
    const run = reconcileRun(def, { ...newRun(def), phase: 2 });
    render(<SunEdgePanel def={def} run={run} onAct={() => undefined} />);
    expect(screen.queryByTestId("lm-sunedge")).toBeNull();
  });

  it("shows the sun's mood, a vague forecast and five steps with a plus and a minus each", () => {
    render(<SunEdgePanel def={def} run={skyRun()} onAct={() => undefined} />);
    expect(screen.getByTestId("lm-sun-mood")).toHaveTextContent(
      /quiet|usual|restless/
    );
    expect(screen.getByTestId("lm-sun-forecast")).toBeInTheDocument();
    for (let i = 0; i < 5; i += 1)
      expect(screen.getByTestId(`lm-sunedge-${i}`)).toHaveAccessibleName(
        /for light, \d+ of 10 for flare heat/
      );
  });

  it("draws light and heat as long as they really are, not in even steps", () => {
    const bars = (mood: number): { light: number[]; heat: number[] } => {
      const { unmount } = render(
        <SunEdgePanel
          def={def}
          run={skyRun({ skMood: mood })}
          onAct={() => undefined}
        />
      );
      const read = (kind: string): number[] =>
        [0, 1, 2, 3, 4].map((i) =>
          Number(
            screen
              .getByTestId(`lm-sunedge-${i}`)
              .getAttribute("aria-label")
              ?.match(new RegExp(`(\\d+) of 10 for ${kind}`))?.[1]
          )
        );
      const out = { light: read("light"), heat: read("flare heat") };
      unmount();
      return out;
    };
    const usual = bars(1);
    // Brushing is several times as hot as Near, and Far has no heat under a usual sun.
    expect(usual.heat[0]).toBe(0);
    expect(usual.heat[4]).toBeGreaterThanOrEqual(2 * usual.heat[2]);
    // The light does not climb in even steps either.
    expect(usual.light[4] - usual.light[3]).toBeLessThan(
      usual.light[3] - usual.light[0]
    );
    // A restless sun reaches even the far edge; a quiet one's reach is short.
    expect(bars(2).heat[0]).toBeGreaterThan(0);
    expect(bars(0).heat[4]).toBeLessThan(usual.heat[4]);
  });

  it("never says which step is best, nor shows both sides of a sum", () => {
    const { container } = render(
      <SunEdgePanel def={def} run={skyRun()} onAct={() => undefined} />
    );
    expect(container).not.toHaveTextContent(/best|recommend|burns \d|pays x/i);
  });

  it("forecasts a flare in rough seconds, saying it may be wrong", () => {
    render(
      <SunEdgePanel
        def={def}
        run={skyRun({ skFlareIn: 12, skMood: 1 })}
        onAct={() => undefined}
      />
    );
    expect(screen.getByTestId("lm-sun-forecast")).toHaveTextContent(
      /about \d+ s.*not always right/
    );
  });

  it("sets the step when a card is tapped", async () => {
    const { current } = renderPanel(SunEdgePanel, skyRun());
    await userEvent.click(screen.getByTestId("lm-sunedge-3"));
    expect(current().resources.skDist).toBe(3);
    expect(screen.getByTestId("lm-sunedge")).toHaveAttribute("data-step", "3");
  });
});

describe("ProbeDesignPanel", () => {
  it("shows four stats, each with what a point gives and what it costs", () => {
    const { container } = render(
      <ProbeDesignPanel def={def} run={skyRun()} onAct={() => undefined} />
    );
    for (const id of ["speed", "mirrors", "copying", "shields"])
      expect(screen.getByTestId(`lm-design-${id}`)).toHaveTextContent(
        /\+ .*− /
      );
    expect(container).not.toHaveTextContent(/best|recommend/i);
  });

  it("moves a point from one stat to another with two taps", async () => {
    const { current } = renderPanel(ProbeDesignPanel, skyRun());
    await userEvent.click(screen.getByTestId("lm-design-down-speed"));
    expect(screen.getByTestId("lm-design")).toHaveAttribute("data-spare", "1");
    expect(screen.getByTestId("lm-design-note")).toHaveTextContent(/spare/);
    await userEvent.click(screen.getByTestId("lm-design-up-copying"));
    expect(screen.getByTestId("lm-design")).toHaveAttribute("data-spare", "0");
    expect(current().resources.skT2).toBe(3);
    expect(screen.getByTestId("lm-design-note")).toHaveTextContent(
      /on their way/
    );
  });

  it("offers to bring wild probes home only when there are some", async () => {
    const calm = skyRun();
    const { view } = renderPanel(ProbeDesignPanel, calm);
    expect(screen.getByTestId("lm-recall")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    view.unmount();
    const { current } = renderPanel(ProbeDesignPanel, skyRun({ skWild: 20 }));
    expect(screen.getByTestId("lm-wild-words")).not.toHaveTextContent("none");
    await userEvent.click(screen.getByTestId("lm-recall"));
    expect(current().resources.skRecall).toBeGreaterThan(0);
    expect(screen.getByTestId("lm-recall")).toHaveTextContent(/home/i);
  });
});
