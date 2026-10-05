import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { createTrial } from "@/lib/ship-builder/sim/seaTrial";
import type { Timeline } from "@/lib/ship-builder/sim/timeline";
import {
  SIM_STEP_S,
  type SimEvent,
  type TrialInput,
} from "@/lib/ship-builder/sim/types";
import { resetPlayback, trialPlayback } from "../../scene/trialPlayback";
import TrialScrubber, { markLanes } from "../TrialScrubber";

const INPUT: TrialInput = {
  ship: { stabilityRatio: 0, listAngle: 0, beam: 5 },
  sea: "calm",
};

const EVENTS: SimEvent[] = [
  { at: 1.5, kind: "flooding" },
  { at: 4, kind: "power-flicker" },
  { at: 6, kind: "power-out" },
  { at: 6.5, kind: "broke" },
  { at: 8, kind: "sunk" },
];

/** Ten seconds; each state sinks a little deeper so a jump is visible. */
function timeline(): Timeline {
  const first = createTrial(INPUT);
  const count = Math.round(10 / SIM_STEP_S) + 1;
  return {
    states: Array.from({ length: count }, (_, i) => {
      const time = i * SIM_STEP_S;
      return {
        ...first,
        time,
        pose: { ...first.pose, sink: time },
        events: EVENTS.filter((event) => event.at <= time),
      };
    }),
    descended: false,
  };
}

beforeEach(() => {
  act(() => resetPlayback());
});

describe("TrialScrubber", () => {
  it("is a labelled slider that starts at the end", () => {
    render(<TrialScrubber timeline={timeline()} />);
    const slider = screen.getByRole("slider", { name: "Look back" });
    expect(slider).toHaveAttribute("min", "0");
    expect(Number(slider.getAttribute("max"))).toBeCloseTo(10, 6);
    expect(Number((slider as HTMLInputElement).value)).toBeCloseTo(10, 6);
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      expect.stringContaining("Sinks")
    );
  });

  it("marks each big moment that happened", () => {
    render(<TrialScrubber timeline={timeline()} />);
    for (const kind of ["flooding", "power-flicker", "power-out", "broke"]) {
      expect(screen.getByTestId(`scrubber-mark-${kind}`)).toBeInTheDocument();
    }
    expect(screen.queryByTestId("scrubber-mark-touched-bottom")).toBeNull();
    expect(screen.getByText("Lights out")).toBeInTheDocument();
  });

  it("dragging shows that moment while scrubbing, and release leaves it", () => {
    render(<TrialScrubber timeline={timeline()} />);
    const slider = screen.getByRole("slider", { name: "Look back" });

    fireEvent.change(slider, { target: { value: "5" } });
    expect(trialPlayback.scrubbing).toBe(true);
    expect(trialPlayback.time).toBeCloseTo(5, 1);
    expect(trialPlayback.sink).toBeCloseTo(5, 1);
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      expect.stringContaining("Lights flicker")
    );

    fireEvent.pointerUp(slider);
    expect(trialPlayback.scrubbing).toBe(false);
    expect(trialPlayback.sink).toBeCloseTo(5, 1);
  });

  it("Page Up and Page Down jump between the marks", () => {
    render(<TrialScrubber timeline={timeline()} />);
    const slider = screen.getByRole("slider", { name: "Look back" });

    fireEvent.keyDown(slider, { key: "PageDown" });
    expect(trialPlayback.time).toBeCloseTo(8, 1);
    fireEvent.keyDown(slider, { key: "PageDown" });
    expect(trialPlayback.time).toBeCloseTo(6.5, 1);
    fireEvent.keyDown(slider, { key: "PageUp" });
    expect(trialPlayback.time).toBeCloseTo(8, 1);
    fireEvent.keyUp(slider, { key: "PageUp" });
    expect(trialPlayback.scrubbing).toBe(false);
  });

  it("does not count story time past the moment she sinks", () => {
    render(<TrialScrubber timeline={timeline()} />);
    const slider = screen.getByRole("slider", { name: "Look back" });
    fireEvent.change(slider, { target: { value: "8" } });
    const atSinking = slider.getAttribute("aria-valuetext")?.split(" after")[0];
    fireEvent.change(slider, { target: { value: "10" } });
    expect(slider.getAttribute("aria-valuetext")).toContain(
      `${atSinking} after`
    );
  });

  it("never leaves scrubbing on after it unmounts", () => {
    const { unmount } = render(<TrialScrubber timeline={timeline()} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "3" } });
    unmount();
    expect(trialPlayback.scrubbing).toBe(false);
  });

  it("keeps the scrubbed moment (effects frozen) after release, until it closes", () => {
    const { unmount } = render(<TrialScrubber timeline={timeline()} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "3" } });
    fireEvent.pointerUp(screen.getByRole("slider"));
    expect(trialPlayback.scrubbing).toBe(false);
    expect(trialPlayback.scrubbed).toBe(true);
    unmount();
    expect(trialPlayback.scrubbed).toBe(false);
  });
});

describe("markLanes", () => {
  const mark = (at: number) => ({ kind: "broke" as const, label: "x", at });

  it("stacks marks that fall close together and keeps the rest on the track", () => {
    const marks = [mark(1), mark(6), mark(6.4), mark(9)];
    expect(markLanes(marks, 10)).toEqual([0, 0, 1, 0]);
  });

  it("wraps after a few lanes", () => {
    const marks = [mark(5), mark(5.1), mark(5.2), mark(5.3)];
    expect(markLanes(marks, 10)).toEqual([0, 1, 2, 0]);
  });

  it("stacks Lights out and Breaks in two, which are half a second apart", () => {
    render(<TrialScrubber timeline={timeline()} />);
    const lights = screen.getByTestId("scrubber-mark-power-out");
    const broke = screen.getByTestId("scrubber-mark-broke");
    expect(lights.getAttribute("transform")).not.toBe(
      broke.getAttribute("transform")
    );
  });
});
