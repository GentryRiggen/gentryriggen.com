import { act } from "react";
import { emptyShip } from "../../model/placement";
import { runTrial } from "../../sim/seaTrial";
import type { SimState } from "../../sim/types";
import { clearLiveTrial } from "../liveTrialState";
import {
  createInitialState,
  useShipBuilderStore,
  type TrialSlice,
} from "../store";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
  clearLiveTrial();
});

function running(): Extract<TrialSlice, { status: "running" }> {
  const { trial } = store();
  if (trial.status !== "running") throw new Error("no trial is running");
  return trial;
}

/** A liner with no walls, struck near the bow: she sinks. */
function finishSinkingTrial(): SimState {
  act(() => store().startTrial("calm", 5));
  const end = runTrial(running().input);
  if (end.outcome !== "sank") throw new Error("expected her to sink");
  act(() => store().finishTrial(end));
  return end;
}

describe("break mode", () => {
  it("defaults to real and goes into the iceberg input", () => {
    expect(store().breakMode).toBe("real");
    act(() => store().startTrial("calm", 5));
    expect(running().input.iceberg?.breakMode).toBe("real");
  });

  it("is remembered across trials, leaving, and loading a ship", () => {
    act(() => store().setBreakMode("never"));
    act(() => store().startTrial("calm", 5));
    expect(running().input.iceberg?.breakMode).toBe("never");
    act(() => store().endTrial());
    act(() => store().loadShip(emptyShip(), null));
    expect(store().breakMode).toBe("never");

    act(() => store().setBreakMode("always"));
    act(() => store().aimIceberg());
    act(() => store().startTrial("calm", 3));
    expect(running().input.iceberg?.breakMode).toBe("always");
  });

  it("stays out of waves trials", () => {
    act(() => store().setBreakMode("always"));
    act(() => store().startTrial("calm"));
    expect(running().input.iceberg).toBeUndefined();
  });
});

describe("descending", () => {
  it("is set for every iceberg trial and not for a waves trial", () => {
    act(() => store().startTrial("calm", 5));
    expect(running().descending).toBe(true);
    act(() => store().startTrial("calm"));
    expect(running().descending).toBe(false);
  });

  it("has no descend action any more", () => {
    expect("descend" in store()).toBe(false);
  });

  it("keeps descending on the result when she sinks", () => {
    finishSinkingTrial();
    expect(store().trial).toMatchObject({
      status: "result",
      descending: true,
    });
  });
});

describe("replay", () => {
  it("plays a finished iceberg trial again from the start", () => {
    finishSinkingTrial();
    const before = store().trial;
    act(() => store().replay());
    const trial = running();

    expect(trial).toMatchObject({ descending: true });
    expect(before.status === "result" && before.input).toBe(trial.input);
    expect(before.status === "result" && before.runId).not.toBe(trial.runId);
  });

  it("does nothing unless an iceberg result is showing", () => {
    act(() => store().replay());
    expect(store().trial.status).toBe("idle");

    act(() => store().startTrial("calm", 5));
    const trial = store().trial;
    act(() => store().replay());
    expect(store().trial).toBe(trial);

    act(() => store().startTrial("calm"));
    act(() => store().finishTrial(runTrial(running().input)));
    const waves = store().trial;
    act(() => store().replay());
    expect(store().trial).toBe(waves);
  });
});

describe("leaving", () => {
  it("endTrial, aimIceberg and cancelAim clear a sunk trial", () => {
    finishSinkingTrial();
    act(() => store().endTrial());
    expect(store().trial).toEqual({ status: "idle" });

    finishSinkingTrial();
    act(() => store().aimIceberg());
    expect(store().trial).toEqual({ status: "aiming" });
    act(() => store().cancelAim());
    expect(store().trial).toEqual({ status: "idle" });
  });
});
