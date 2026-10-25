import { act, render, screen } from "@testing-library/react";
import { createTrial } from "@/lib/ship-builder/sim/seaTrial";
import type { TrialInput } from "@/lib/ship-builder/sim/types";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { testShip } from "@/lib/ship-builder/testing";
import { clearLiveTrial, publishLiveTrial } from "../../scene/liveTrial";
import { resetPlayback, trialPlayback } from "../../scene/trialPlayback";
import TrialWalkButton from "../TrialWalkButton";

const store = () => useShipBuilderStore.getState();

const INPUT: TrialInput = {
  ship: { stabilityRatio: 0, listAngle: 0, beam: 5 },
  sea: "calm",
  funnels: [],
  length: 30,
};

const walkButton = () => screen.queryByRole("button", { name: "Walk" });

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
  act(() => {
    clearLiveTrial();
    resetPlayback();
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

  it("asks where to start, walks from there and then goes away", () => {
    render(<TrialWalkButton />);
    act(() => store().startTrial("calm", 5));
    act(() => walkButton()!.click());
    expect(store().walk.status).toBe("idle");
    act(() => screen.getByRole("button", { name: "Front (bow)" }).click());
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

  it("hides once she has broken in two", () => {
    render(<TrialWalkButton />);
    act(() => store().startTrial("calm", 5));
    act(() =>
      publishLiveTrial(
        {
          ...createTrial(INPUT),
          breakup: { at: 10, atX: 20, angle: -0.3 },
        },
        0,
        true
      )
    );
    expect(walkButton()).toBeNull();
  });

  it("hides while she descends to the sea floor", () => {
    render(<TrialWalkButton />);
    act(() => store().startTrial("calm", 5));
    act(() =>
      publishLiveTrial({ ...createTrial(INPUT), phase: "descending" }, 0, true)
    );
    expect(walkButton()).toBeNull();
  });

  it.each([
    ["capsizing", { phase: "capsizing" as const }],
    ["sinking", { phase: "sinking" as const }],
    ["descending", { phase: "descending" as const }],
    ["capsized earlier", { capsizedAt: 4 }],
  ])("hides in a weather trial (no live state) once she is %s", (_n, patch) => {
    jest.useFakeTimers();
    try {
      render(<TrialWalkButton />);
      act(() => store().startTrial("stormy"));
      expect(walkButton()).toBeVisible();
      Object.assign(trialPlayback, patch);
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(walkButton()).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
