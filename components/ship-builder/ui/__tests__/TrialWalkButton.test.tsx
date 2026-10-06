import { act, render, screen } from "@testing-library/react";
import { createTrial } from "@/lib/ship-builder/sim/seaTrial";
import type { TrialInput } from "@/lib/ship-builder/sim/types";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { testShip } from "@/lib/ship-builder/testing";
import { clearLiveTrial, publishLiveTrial } from "../../scene/liveTrial";
import TrialWalkButton from "../TrialWalkButton";

const store = () => useShipBuilderStore.getState();

const INPUT: TrialInput = {
  ship: { stabilityRatio: 0, listAngle: 0, beam: 5 },
  sea: "calm",
};

const walkButton = () => screen.queryByRole("button", { name: "Walk" });

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
  act(() => {
    clearLiveTrial();
    store().loadShip(testShip(), null);
  });
});

describe("TrialWalkButton", () => {
  it("shows only while a trial is running", () => {
    render(<TrialWalkButton />);
    expect(walkButton()).toBeNull();
    act(() => store().startTrial("calm", 5));
    expect(walkButton()).toBeVisible();
  });

  it("starts the walk and then goes away", () => {
    render(<TrialWalkButton />);
    act(() => store().startTrial("calm", 5));
    act(() => walkButton()!.click());
    expect(store().walk.status).toBe("walking");
    expect(walkButton()).toBeNull();
  });

  it("hides once she has gone under", () => {
    render(<TrialWalkButton />);
    act(() => store().startTrial("calm", 5));
    act(() =>
      publishLiveTrial({ ...createTrial(INPUT), phase: "done" }, 0, true)
    );
    expect(walkButton()).toBeNull();
  });
});
