import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun, performAction, tick } from "@/lib/ever-onward/engine/engine";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import {
  isProbeOut,
  launchActionId,
} from "@/lib/ever-onward/universes/light/probes";
import type { RunState } from "@/lib/ever-onward/engine/types";
import ProbeRaces from "../ProbeRaces";

function openRun(owned: Record<string, number> = {}): RunState {
  const base = newRun(def);
  return tick(
    def,
    {
      ...base,
      phase: 2,
      owned: { collector: 5, probe: 1, "nav-1": 1, ...owned },
      resources: {
        ...base.resources,
        energy: 500,
        collectors: 5,
        probes: 20,
        stars: 900,
      },
    },
    0.1
  );
}

const idle = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

describe("ProbeRaces", () => {
  it("is absent before the charts are bought, and outside the sky", () => {
    const { container } = render(
      <ProbeRaces def={def} run={newRun(def)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
    const coast: RunState = { ...openRun(), phase: 0 };
    const again = render(
      <ProbeRaces def={def} run={coast} onAct={jest.fn()} />
    );
    expect(again.container).toBeEmptyDOMElement();
  });

  it("shows three routes with honest times, and a launch button", async () => {
    const onAct = jest.fn();
    render(<ProbeRaces def={def} run={openRun()} onAct={onAct} />);
    expect(screen.getByTestId("lm-probe-time-short")).toHaveTextContent("75 s");
    expect(screen.getByTestId("lm-probe-time-long")).toHaveTextContent("180 s");
    expect(screen.getByTestId("lm-probe-time-comet")).toHaveTextContent(
      "110 s"
    );
    expect(screen.getByTestId("lm-probe-status")).toHaveTextContent(
      "Probe is at the dock"
    );
    const cards = within(screen.getByRole("radiogroup")).getAllByRole("radio");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toBeChecked();

    // pick the long loop, then launch it
    await userEvent.click(screen.getByTestId("lm-probe-card-long"));
    expect(screen.getByTestId("lm-probe-card-long")).toBeChecked();
    expect(screen.getByTestId("lm-probe-map")).toHaveAttribute(
      "data-route",
      "long"
    );
    const launch = screen.getByTestId("lm-probe-launch");
    expect(launch).toHaveTextContent("Launch: Long loop");
    await userEvent.click(launch);
    expect(onAct).toHaveBeenCalledWith(launchActionId(1));
  });

  it("shows the comet bar and its range up front", () => {
    render(<ProbeRaces def={def} run={openRun()} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-probe-comet-bar")).toBeInTheDocument();
    expect(screen.getByRole("meter", { hidden: true })).toHaveAttribute(
      "aria-valuenow"
    );
    expect(
      screen.getByText(/Up to \+[\d.,]+K? when the comet is close/)
    ).toBeInTheDocument();
  });

  it("counts down while the probe is out, with a progress bar, and cannot launch again", () => {
    const flying = idle(performAction(def, openRun(), launchActionId(0)), 15);
    expect(isProbeOut(flying)).toBe(true);
    render(<ProbeRaces def={def} run={flying} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-probe-status")).toHaveTextContent(
      "Probe is out: 1:00 left"
    );
    const launch = screen.getByTestId("lm-probe-launch");
    expect(launch).toHaveAttribute("aria-disabled", "true");
    expect(launch).toHaveTextContent("Probe is out: 1:00 left");
    expect(screen.getByTestId("lm-probe-progress")).toHaveAttribute(
      "aria-valuenow",
      "20"
    );
    expect(screen.getByTestId("lm-probe-panel")).toHaveAttribute(
      "data-probe",
      "out"
    );
  });

  it("announces the result and the tally when the probe is home", () => {
    const home = idle(performAction(def, openRun(), launchActionId(0)), 83);
    render(<ProbeRaces def={def} run={home} onAct={jest.fn()} />);
    const result = screen.getByTestId("lm-probe-result");
    expect(result).toHaveAttribute("role", "status");
    expect(result).toHaveTextContent(
      /The probe is home from the short hop: \+\d/
    );
    expect(screen.getByText(/Runs home: 1/)).toBeInTheDocument();
    expect(screen.getByTestId("lm-probe-launch")).toHaveAttribute(
      "aria-disabled",
      "false"
    );
  });

  it("tells about the scout once mission control is built", () => {
    const run = openRun({ "mission-control": 1 });
    render(<ProbeRaces def={def} run={run} onAct={jest.fn()} />);
    expect(screen.getByTestId("lm-probe-scout-line")).toHaveTextContent(
      /Fly a route and its scout will follow it/
    );
  });

  it("moves the pick with the arrow keys and keeps one tab stop", async () => {
    render(<ProbeRaces def={def} run={openRun()} onAct={jest.fn()} />);
    const short = screen.getByTestId("lm-probe-card-short");
    short.focus();
    await userEvent.keyboard("{ArrowDown}");
    const long = screen.getByTestId("lm-probe-card-long");
    expect(long).toBeChecked();
    expect(long).toHaveFocus();
    expect(long).toHaveAttribute("tabindex", "0");
    expect(short).toHaveAttribute("tabindex", "-1");
    expect(long).toHaveAccessibleName("Long loop, 180 seconds");
  });
});
