import { act } from "react";
import { render, screen } from "@testing-library/react";
import { createTrial } from "@/lib/ship-builder/sim/seaTrial";
import type { SimState, TrialInput } from "@/lib/ship-builder/sim/types";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { testShip } from "@/lib/ship-builder/testing";
import { clearLiveTrial, publishLiveTrial } from "../../scene/liveTrial";
import SeaTrialStatus from "../SeaTrialStatus";

const store = () => useShipBuilderStore.getState();

const INPUT: TrialInput = {
  ship: { stabilityRatio: 0, listAngle: 0, beam: 5 },
  sea: "calm",
  funnels: [],
  length: 30,
};

function sunkState(): SimState {
  return {
    ...createTrial(INPUT),
    time: 30,
    phase: "done",
    outcome: "sank",
    events: [{ at: 30, kind: "sunk" }],
  };
}

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
  act(() => clearLiveTrial());
});

const followButton = () =>
  screen.queryByRole("button", { name: "Follow her down" });

describe("SeaTrialStatus", () => {
  it("never offers Follow her down, even once she has sunk", () => {
    render(<SeaTrialStatus />);
    act(() => store().startTrial("calm", 5));
    expect(followButton()).toBeNull();
    act(() => publishLiveTrial(sunkState(), 0, true));
    expect(followButton()).toBeNull();
    expect(screen.getByRole("button", { name: "Stop" })).toHaveFocus();
  });

  it("never shows it in a waves trial", () => {
    render(<SeaTrialStatus />);
    act(() => store().startTrial("calm"));
    act(() => publishLiveTrial(sunkState(), 0, true));
    expect(followButton()).toBeNull();
  });
});

describe("SeaTrialStatus story clock", () => {
  it("stops at the moment she sinks, however far the descent goes", () => {
    render(<SeaTrialStatus />);
    act(() => store().startTrial("calm", 5));
    act(() => publishLiveTrial({ ...sunkState(), time: 30 }, 0, true));
    const atSinking = screen.getByTestId("story-clock").textContent;
    act(() => publishLiveTrial({ ...sunkState(), time: 80 }, 0, true));
    expect(screen.getByTestId("story-clock").textContent).toBe(atSinking);
  });

  it("keeps counting while she is afloat", () => {
    render(<SeaTrialStatus />);
    act(() => store().startTrial("calm", 5));
    const afloat = (time: number): SimState => ({
      ...createTrial(INPUT),
      time,
    });
    act(() => publishLiveTrial(afloat(10), 0, true));
    const early = screen.getByTestId("story-clock").textContent;
    act(() => publishLiveTrial(afloat(20), 0, true));
    expect(screen.getByTestId("story-clock").textContent).not.toBe(early);
  });
});

describe("SeaTrialStatus focus", () => {
  it("leaves focus alone when the run starts while walking", () => {
    render(<SeaTrialStatus />);
    act(() => {
      store().loadShip(testShip(), null);
      store().startWalk();
    });
    act(() => store().sinkWhileWalking());
    expect(document.body).toHaveFocus();
  });

  it("still focuses Stop when a run starts from building", () => {
    render(<SeaTrialStatus />);
    act(() => store().startTrial("calm", 5));
    expect(screen.getByRole("button", { name: "Stop" })).toHaveFocus();
  });
});
