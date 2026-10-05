import { act } from "react";
import { getSeaState } from "@/components/ship-builder/hooks/useSeaState";
import type { DriveConfig } from "../../sail/driveConfig";
import type { SailImpact } from "../../sail/types";
import { sailInput } from "../sailInput";
import { getSailState, publishSail, subscribeSail } from "../sailLive";
import { createInitialState, useShipBuilderStore } from "../store";

const store = () => useShipBuilderStore.getState();

const CONFIG: DriveConfig = { seed: 7, kinds: ["iceberg"], density: "some" };

const IMPACT: SailImpact = {
  obstacleId: "a",
  kind: "iceberg",
  impactX: 3.5,
  part: "side",
  closingSpeed: 2,
  at: 1,
};

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
  sailInput.throttle = 0;
  sailInput.rudder = 0;
  publishSail(null);
});

function sail() {
  act(() => {
    store().openDrive();
    store().startDrive(CONFIG);
  });
}

describe("drive slice", () => {
  it("opens the picker, sails with a new runId per run, and ends", () => {
    expect(store().drive).toEqual({ status: "idle" });
    act(() => store().openDrive());
    expect(store().drive).toEqual({ status: "setup" });

    act(() => store().startDrive(CONFIG));
    const first = store().drive;
    expect(first).toMatchObject({
      status: "sailing",
      config: CONFIG,
      view: "chase",
    });

    act(() => store().endDrive());
    expect(store().drive).toEqual({ status: "idle" });

    sail();
    const second = store().drive;
    if (first.status !== "sailing" || second.status !== "sailing") {
      throw new Error("expected sailing");
    }
    expect(second.runId).not.toBe(first.runId);
  });

  it("only starts from the picker and only opens from building", () => {
    act(() => store().startDrive(CONFIG));
    expect(store().drive.status).toBe("idle");

    act(() => store().startTrial("calm"));
    act(() => store().openDrive());
    expect(store().drive.status).toBe("idle");
  });

  it("freezes building during setup and sailing", () => {
    act(() => store().openDrive());
    act(() => {
      store().selectTool("deck-1x1");
      store().placeAt({ kind: "grid", level: 0, x: 0, z: 0 });
    });
    expect(store().ship.parts).toHaveLength(0);
    act(() => store().endDrive());

    sail();
    act(() => {
      store().selectTool("deck-1x1");
      store().placeAt({ kind: "grid", level: 0, x: 0, z: 0 });
    });
    expect(store().ship.parts).toHaveLength(0);
  });

  it("switches views only while sailing", () => {
    act(() => store().setDriveView("top"));
    expect(store().drive.status).toBe("idle");
    sail();
    act(() => store().setDriveView("top"));
    expect(store().drive).toMatchObject({ status: "sailing", view: "top" });
  });

  it("resets input and clears the live state when the drive ends", () => {
    sail();
    sailInput.throttle = 1;
    sailInput.rudder = -0.5;
    const listener = jest.fn();
    const unsubscribe = subscribeSail(listener);
    act(() => store().endDrive());
    unsubscribe();
    expect(sailInput).toEqual({ throttle: 0, rudder: 0 });
    expect(getSailState()).toBeNull();
    expect(listener).toHaveBeenCalled();
  });

  it("a hard hit ends the drive and starts the trial at the impact spot", () => {
    sail();
    act(() => store().driveHit(IMPACT));
    expect(store().drive).toEqual({ status: "idle" });
    const { trial } = store();
    if (trial.status !== "running") throw new Error("no trial running");
    expect(trial.input.sea).toBe(getSeaState());
    expect(trial.input.iceberg?.impactX).toBe(3.5);
  });

  it("ignores a hit when not sailing", () => {
    act(() => store().driveHit(IMPACT));
    expect(store().trial.status).toBe("idle");
  });
});
