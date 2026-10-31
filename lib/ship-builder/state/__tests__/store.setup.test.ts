import { act } from "react";
import { getSeaState } from "@/components/ship-builder/hooks/useSeaState";
import { getTimeOfDay } from "@/components/ship-builder/hooks/useTimeOfDay";
import { trialChoicesSetting } from "@/components/ship-builder/hooks/useTrialChoices";
import type { DriveConfig } from "../../sail/driveConfig";
import { runTrial } from "../../sim/seaTrial";
import {
  createInitialState,
  useShipBuilderStore,
  type TrialSlice,
} from "../store";

const store = () => useShipBuilderStore.getState();

const SEA_KEY = "ship-builder:ui:sea";
const TIME_KEY = "ship-builder:ui:time";

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(SEA_KEY, "choppy");
  window.localStorage.setItem(TIME_KEY, "sunset");
  act(() => useShipBuilderStore.setState(createInitialState()));
});

afterAll(() => window.localStorage.clear());

function running(): Extract<TrialSlice, { status: "running" }> {
  const { trial } = store();
  if (trial.status !== "running") throw new Error("no trial is running");
  return trial;
}

describe("trial setup", () => {
  it("opens the waves card on the main sea and time", () => {
    act(() => store().openTrialSetup("waves"));
    expect(store().trial).toEqual({
      status: "setup",
      kind: "waves",
      look: { sea: "choppy", time: "sunset" },
    });
  });

  it("opens the waves card on the remembered sea", () => {
    trialChoicesSetting.set({ waveSea: "stormy", lifeboats: "fill" });
    act(() => store().openTrialSetup("waves"));
    expect(store().trial).toMatchObject({ look: { sea: "stormy" } });
  });

  it("opens the storm card in the wild sea", () => {
    act(() => store().openTrialSetup("storm"));
    expect(store().trial).toEqual({
      status: "setup",
      kind: "storm",
      look: { sea: "wild", time: "sunset" },
    });
  });

  it("does not open while a trial runs or a drive is on", () => {
    act(() => store().startTrial("calm"));
    act(() => store().openTrialSetup("waves"));
    expect(store().trial.status).toBe("running");
    act(() => store().endTrial());
    act(() => store().openDrive());
    act(() => store().openTrialSetup("waves"));
    expect(store().trial.status).toBe("idle");
  });

  it("changes the look while setting up, never the main choices", () => {
    act(() => store().openTrialSetup("waves"));
    act(() => store().setTrialLook({ sea: "stormy", time: "night" }));
    expect(store().trial).toMatchObject({
      look: { sea: "stormy", time: "night" },
    });
    expect(getSeaState()).toBe("choppy");
    expect(getTimeOfDay()).toBe("sunset");
  });

  it("keeps the storm's wild sea and the waves card off it", () => {
    act(() => store().openTrialSetup("storm"));
    act(() => store().setTrialLook({ sea: "calm", time: "night" }));
    expect(store().trial).toMatchObject({
      look: { sea: "wild", time: "night" },
    });
    act(() => store().cancelTrialSetup());
    act(() => store().openTrialSetup("waves"));
    act(() => store().setTrialLook({ sea: "wild" }));
    expect(store().trial).toMatchObject({ look: { sea: "choppy" } });
  });

  it("changes the look while aiming, and ignores it otherwise", () => {
    act(() => store().setTrialLook({ time: "night" }));
    expect(store().trial).toEqual({ status: "idle" });
    act(() => store().aimIceberg());
    act(() => store().setTrialLook({ time: "night" }));
    expect(store().trial).toMatchObject({
      status: "aiming",
      look: { sea: "choppy", time: "night" },
    });
    act(() => store().startTrial("choppy", 4));
    const trial = running();
    act(() => store().setTrialLook({ time: "day" }));
    expect(store().trial).toBe(trial);
  });

  it("cancels back to building", () => {
    act(() => store().openTrialSetup("waves"));
    act(() => store().setTrialLook({ sea: "stormy", time: "night" }));
    act(() => store().cancelTrialSetup());
    expect(store().trial).toEqual({ status: "idle" });
    expect(getSeaState()).toBe("choppy");
    expect(getTimeOfDay()).toBe("sunset");
  });

  it("freezes the ship while the card is open", () => {
    act(() => store().openTrialSetup("waves"));
    expect(store().placeAt({ kind: "grid", level: 0, x: 0, z: 0 })).toEqual({
      ok: false,
      reason: "Building is paused during the sea trial",
    });
  });

  it("Go starts the waves trial in the picked sea and time", () => {
    act(() => store().openTrialSetup("waves"));
    act(() => store().setTrialLook({ sea: "stormy", time: "night" }));
    act(() => store().startSetupTrial());
    const trial = running();
    expect(trial.input.sea).toBe("stormy");
    expect(trial.input.storm).toBeUndefined();
    expect(trial.input.iceberg).toBeUndefined();
    expect(trial.look).toEqual({ sea: "stormy", time: "night" });
  });

  it("Go starts the storm with the break mode and lifeboats picked", () => {
    trialChoicesSetting.set({ lifeboats: "titanic" });
    act(() => store().setBreakMode("never"));
    act(() => store().openTrialSetup("storm"));
    act(() => store().setTrialLook({ time: "night" }));
    act(() => store().startSetupTrial());
    const trial = running();
    expect(trial.input.sea).toBe("wild");
    expect(trial.input.storm).toMatchObject({
      length: store().ship.hull.lengthSegments * 3,
      breakMode: "never",
    });
    expect(trial.input.lifeboats).toBe("titanic");
    expect(trial.look).toEqual({ sea: "wild", time: "night" });
    expect(trial.descending).toBe(true);
  });

  it("Go does nothing without a card open", () => {
    act(() => store().startSetupTrial());
    expect(store().trial.status).toBe("idle");
  });

  it("striking the iceberg keeps the chosen time and lifeboats", () => {
    trialChoicesSetting.set({ lifeboats: "titanic" });
    act(() => store().aimIceberg());
    act(() => store().setTrialLook({ time: "night" }));
    act(() => store().startTrial("choppy", 4));
    const trial = running();
    expect(trial.look).toEqual({ sea: "choppy", time: "night" });
    expect(trial.input.lifeboats).toBe("titanic");
  });

  it("a hard hit skips the card: main time, remembered lifeboats", () => {
    trialChoicesSetting.set({ lifeboats: "titanic" });
    const config: DriveConfig = {
      seed: 7,
      kinds: ["iceberg"],
      density: "some",
    };
    act(() => {
      store().openDrive();
      store().startDrive(config);
    });
    act(() =>
      store().driveHit({
        obstacleId: "a",
        kind: "iceberg",
        impactX: 3.5,
        part: "side",
        closingSpeed: 2,
        at: 1,
      })
    );
    const trial = running();
    expect(trial.look).toEqual({ sea: "choppy", time: "sunset" });
    expect(trial.input.lifeboats).toBe("titanic");
  });

  it("defaults the lifeboats to fill every seat", () => {
    act(() => store().aimIceberg());
    act(() => store().startTrial("choppy", 4));
    expect(running().input.lifeboats).toBe("fill");
  });
});

describe("storm results", () => {
  function finishStorm() {
    act(() => store().openTrialSetup("storm"));
    act(() => store().setTrialLook({ time: "night" }));
    act(() => store().startSetupTrial());
    act(() => store().finishTrial(runTrial(running().input)));
  }

  it("replays a finished storm", () => {
    finishStorm();
    const before = store().trial;
    act(() => store().replay());
    const trial = running();
    expect(before.status === "result" && before.input).toBe(trial.input);
    expect(trial.look).toEqual({ sea: "wild", time: "night" });
  });

  it("Try again runs the same storm again", () => {
    finishStorm();
    const before = store().trial;
    act(() => store().retryTrial());
    const trial = running();
    if (before.status !== "result") throw new Error("no result");
    expect(trial.input).toEqual(before.input);
    expect(trial.input.storm).toBeDefined();
    expect(trial.look).toEqual(before.look);
    expect(trial.runId).not.toBe(before.runId);
  });

  it("Try again does nothing unless a result shows", () => {
    act(() => store().retryTrial());
    expect(store().trial.status).toBe("idle");
  });
});

describe("aiming again from a result", () => {
  function result(): Extract<TrialSlice, { status: "result" }> {
    const { trial } = store();
    if (trial.status !== "result") throw new Error("no result");
    return trial;
  }

  it("Try again on a challenge result keeps the challenge", () => {
    act(() => store().startChallenge("outlast"));
    act(() => store().finishTrial(runTrial(running().input)));
    expect(result().challenge).toBe("outlast");
    act(() => store().retryTrial());
    expect(running().challenge).toBe("outlast");
  });

  it("Try again without a challenge stays untagged", () => {
    act(() => store().aimIceberg());
    act(() => store().startTrial("choppy", 4));
    act(() => store().finishTrial(runTrial(running().input)));
    act(() => store().retryTrial());
    expect(running().challenge).toBeUndefined();
  });

  it("Try another spot keeps the iceberg card's look", () => {
    act(() => store().aimIceberg());
    act(() => store().setTrialLook({ time: "night" }));
    act(() => store().startTrial("choppy", 4));
    act(() => store().finishTrial(runTrial(running().input)));
    act(() => store().aimIceberg());
    expect(store().trial).toEqual({
      status: "aiming",
      look: { sea: "choppy", time: "night" },
    });
  });

  it("aiming after a waves result starts from the main look", () => {
    act(() => store().openTrialSetup("waves"));
    act(() => store().setTrialLook({ sea: "stormy", time: "night" }));
    act(() => store().startSetupTrial());
    act(() => store().finishTrial(runTrial(running().input)));
    act(() => store().aimIceberg());
    expect(store().trial).toEqual({
      status: "aiming",
      look: { sea: "choppy", time: "sunset" },
    });
  });
});
