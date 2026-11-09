import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  newRun,
  performAction,
  reconcileRun,
  tick,
} from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import { startWarmth } from "@/lib/ever-onward/universes/light/warmth";
import LightsPanel from "../LightsPanel";

function lastRun(resources: Record<string, number> = {}): RunState {
  const base = newRun(def);
  const run = reconcileRun(def, {
    ...base,
    phase: 3,
    resources: { ...base.resources, lights: 11, flame: 400, ...resources },
  });
  startWarmth(run);
  Object.assign(run.resources, resources);
  return run;
}

/** Renders the panel the way the game does: `onAct` performs the action and re-renders. */
function renderPanel(start: RunState) {
  let run = start;
  const view = render(
    <LightsPanel def={def} run={run} onAct={() => undefined} />
  );
  const onAct = (id: string) => {
    run = performAction(def, run, id);
    view.rerender(<LightsPanel def={def} run={run} onAct={onAct} />);
  };
  view.rerender(<LightsPanel def={def} run={run} onAct={onAct} />);
  return { view, current: () => run };
}

describe("LightsPanel", () => {
  it("is absent outside the last part and after the ending", () => {
    const early = reconcileRun(def, { ...newRun(def), phase: 2 });
    render(<LightsPanel def={def} run={early} onAct={() => undefined} />);
    expect(screen.queryByTestId("lm-lights")).toBeNull();
  });

  it("shows every burning light with its warmth cost and company as marks, never numbers or advice", () => {
    render(<LightsPanel def={def} run={lastRun()} onAct={() => undefined} />);
    const panel = screen.getByTestId("lm-lights");
    expect(panel).toHaveAttribute("data-lit", "11");
    for (let i = 0; i < 11; i += 1)
      expect(screen.getByTestId(`lm-light-${i}`)).toBeInTheDocument();
    // two rows of marks a light, read out as "Costs warmth: n of 5" and "Keeps company: n of 5"
    const stadium = screen.getByTestId("lm-light-2");
    expect(
      within(stadium).getByRole("img", { name: /Costs warmth: \d of 5/ })
    ).toBeInTheDocument();
    expect(
      within(stadium).getByRole("img", { name: /Keeps company: \d of 5/ })
    ).toBeInTheDocument();
    expect(panel).not.toHaveTextContent(/best|recommend|should/i);
  });

  it("lets a light go with one tap, takes it off the list and makes the next one wait", async () => {
    const { current } = renderPanel(lastRun());
    await userEvent.click(screen.getByTestId("lm-letgo-3"));
    expect(current().owned["letgo-bridges"]).toBe(1);
    expect(screen.queryByTestId("lm-light-3")).toBeNull();
    expect(screen.getByTestId("lm-lights")).toHaveAttribute("data-lit", "10");
    expect(screen.getByTestId("lm-lights-note")).toHaveTextContent(/rising/);
    expect(screen.getByTestId("lm-letgo-4")).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("names the cold wind when it is coming or blowing, and says the air is still otherwise", () => {
    const still = lastRun({ wmChillIn: 90, wmChillLeft: 0, wmChillSize: 1 });
    const { view } = renderPanel(still);
    expect(screen.getByTestId("lm-wind")).toHaveTextContent(/air is still/i);
    const coming = lastRun({
      wmChillIn: 12,
      wmChillLeft: 0,
      wmChillSize: 2,
      wmChillKind: 0,
    });
    view.rerender(
      <LightsPanel def={def} run={coming} onAct={() => undefined} />
    );
    expect(screen.getByTestId("lm-wind")).toHaveTextContent(
      /bitter sea wind is coming/i
    );
    // it names the lights it will bite, and marks their cards
    expect(screen.getByTestId("lm-wind")).toHaveTextContent(
      /bridge lights, the harbor lamps, the festival lanterns and the moon mirror/i
    );
    expect(screen.getByTestId("lm-wind")).toHaveAttribute("data-windy", "yes");
    expect(screen.getByTestId("lm-light-3")).toHaveAttribute(
      "data-bitten",
      "yes"
    );
    expect(screen.getByTestId("lm-light-0")).toHaveAttribute(
      "data-bitten",
      "no"
    );
    const blowing = lastRun({
      wmChillLeft: 20,
      wmChillSize: 0,
      wmChillKind: 1,
    });
    view.rerender(
      <LightsPanel def={def} run={blowing} onAct={() => undefined} />
    );
    expect(screen.getByTestId("lm-wind")).toHaveTextContent(
      /mild town wind is blowing/i
    );
    // a goodbye in the wind that bites a light pays more, and says so
    expect(screen.getByTestId("lm-letgo-2")).toHaveTextContent(/on the wind/i);
    expect(screen.getByTestId("lm-letgo-4")).not.toHaveTextContent(
      /on the wind/i
    );
  });

  it("says so when every light has gone", () => {
    const owned = Object.fromEntries(
      [
        "porch",
        "signs",
        "stadium",
        "bridges",
        "harbor",
        "towers",
        "festival",
        "fire",
        "moon",
        "sun",
        "night",
      ].map((n) => [`letgo-${n}`, 1])
    );
    const run = tick(def, { ...lastRun(), owned }, 1);
    render(<LightsPanel def={def} run={run} onAct={() => undefined} />);
    expect(screen.getByTestId("lm-lights")).toHaveTextContent(
      /Every light has gone/
    );
  });
});

describe("LightsPanel, a light getting tired", () => {
  it("tags the one light about to burn down by itself, and only then", () => {
    const { unmount } = render(
      <LightsPanel def={def} run={lastRun()} onAct={() => undefined} />
    );
    expect(screen.queryByText("Getting tired")).toBeNull();
    unmount();
    const late = lastRun({ wmNet: 140 });
    render(<LightsPanel def={def} run={late} onAct={() => undefined} />);
    expect(screen.getAllByText("Getting tired")).toHaveLength(1);
  });
});
