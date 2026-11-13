import { act } from "react";
import { getSeaState } from "@/components/ship-builder/hooks/useSeaState";
import type { DriveConfig } from "../../sail/driveConfig";
import type { SailImpact } from "../../sail/types";
import { findTemplate } from "../../templates";
import { blastPiecesOf } from "../../sim/blast";
import { STRIKES } from "../../sim/strike";
import { trialFunnelsOf } from "../../sim/trialFunnels";
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

  it("a sea mine starts a mine trial with a bigger hole", () => {
    sail();
    act(() => store().driveHit({ ...IMPACT, kind: "mine" }));
    const { trial } = store();
    if (trial.status !== "running") throw new Error("no trial running");
    expect(trial.input.iceberg?.strike).toBe("mine");
    expect(trial.input.iceberg?.gashLength).toBe(STRIKES.mine.gashLength);
  });

  it("leaves funnels the mine throws off out of the sinking", () => {
    const titanic = findTemplate("titanic")!.build();
    act(() => store().loadShip(titanic, null));
    const funnelId = trialFunnelsOf(titanic)[0].id;
    const funnelX = trialFunnelsOf(titanic)[0].cellX;
    const thrown = blastPiecesOf(titanic, funnelX).map((p) => p.partId);
    expect(thrown).toContain(funnelId);
    sail();
    act(() => store().driveHit({ ...IMPACT, kind: "mine", impactX: funnelX }));
    const { trial } = store();
    if (trial.status !== "running") throw new Error("no trial running");
    const ids = trial.input.funnels.map((f) => f.id);
    expect(ids).not.toContain(funnelId);
    expect(ids.length).toBeLessThan(trialFunnelsOf(titanic).length);
  });

  it("an island starts a grounding trial", () => {
    sail();
    act(() => store().driveHit({ ...IMPACT, kind: "island", impactX: 0 }));
    const { trial } = store();
    if (trial.status !== "running") throw new Error("no trial running");
    expect(trial.input.iceberg?.strike).toBe("island");
    expect(trial.input.iceberg?.impactX).toBe(0);
  });

  it("rocks and ships still gash her like an iceberg", () => {
    sail();
    act(() => store().driveHit({ ...IMPACT, kind: "rock" }));
    const { trial } = store();
    if (trial.status !== "running") throw new Error("no trial running");
    expect(trial.input.iceberg?.strike).toBeUndefined();
    expect(trial.input.iceberg?.gashLength).toBeUndefined();
  });

  it("ignores a hit when not sailing", () => {
    act(() => store().driveHit(IMPACT));
    expect(store().trial.status).toBe("idle");
  });
});
