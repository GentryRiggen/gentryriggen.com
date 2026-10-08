import { act } from "react";
import { gridLength } from "../../model/grid";
import { createTrial, runTrial } from "../../sim/seaTrial";
import { gridPart, testShip } from "../../testing";
import { walkInput } from "../walkInput";
import { getWalkState, publishWalk, subscribeWalk } from "../walkLive";
import { createInitialState, useShipBuilderStore } from "../store";

const store = () => useShipBuilderStore.getState();

/** Pools tile the whole main deck, so there is nowhere to stand. */
const NO_DECK = testShip(
  Array.from({ length: 12 }, (_, i) => i * 2).flatMap((x) =>
    [0, 2].map((z) => gridPart(`p${x}${z}`, "pool", 0, x, z))
  )
);

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
  walkInput.forward = 0;
  walkInput.strafe = 0;
  walkInput.turn = 0;
  publishWalk(null);
});

function load(ship = testShip()) {
  act(() => store().loadShip(ship, null));
}

describe("walk slice", () => {
  it("starts walking at the spawn with a new runId per walk, and stops", () => {
    load();
    act(() => store().startWalk());
    const first = store().walk;
    expect(first).toMatchObject({ status: "walking" });
    expect(getWalkState()).toMatchObject({ level: 0, yaw: 0, time: 0 });

    act(() => store().stopWalk());
    expect(store().walk).toEqual({ status: "idle" });

    act(() => store().startWalk());
    const second = store().walk;
    if (first.status !== "walking" || second.status !== "walking") {
      throw new Error("expected walking");
    }
    expect(second.runId).not.toBe(first.runId);
  });

  it("does nothing when there is nowhere to stand", () => {
    load(NO_DECK);
    act(() => store().startWalk());
    expect(store().walk).toEqual({ status: "idle" });
    expect(getWalkState()).toBeNull();
  });

  it("does not start during setup, sailing, an aim or a result", () => {
    load();
    act(() => store().openDrive());
    act(() => store().startWalk());
    expect(store().walk.status).toBe("idle");
    act(() => store().startDrive({ seed: 1, kinds: [], density: "few" }));
    act(() => store().startWalk());
    expect(store().walk.status).toBe("idle");
    act(() => store().endDrive());

    act(() => store().aimIceberg());
    act(() => store().startWalk());
    expect(store().walk.status).toBe("idle");
    act(() => store().cancelAim());

    act(() => store().startTrial("calm", 5));
    const { trial } = store();
    if (trial.status !== "running") throw new Error("expected running");
    act(() => store().finishTrial(createTrial(trial.input)));
    act(() => store().startWalk());
    expect(store().walk.status).toBe("idle");
  });

  it("starts while a trial is running", () => {
    load();
    act(() => store().startTrial("calm", 5));
    act(() => store().startWalk());
    expect(store().walk.status).toBe("walking");
    expect(store().trial.status).toBe("running");
  });

  it("keeps the trial and the drive from starting while walking", () => {
    load();
    act(() => store().startWalk());
    act(() => store().startTrial("calm"));
    act(() => store().aimIceberg());
    act(() => store().openDrive());
    expect(store().trial.status).toBe("idle");
    expect(store().drive.status).toBe("idle");
    expect(store().walk.status).toBe("walking");
  });

  it("freezes building while walking", () => {
    load();
    act(() => store().startWalk());
    act(() => {
      store().selectTool("deck-1x1");
      store().placeAt({ kind: "grid", level: 0, x: 0, z: 0 });
    });
    expect(store().ship.parts).toHaveLength(0);
  });

  it("resets input and clears the live state when the walk ends", () => {
    load();
    act(() => store().startWalk());
    walkInput.forward = 1;
    walkInput.strafe = -1;
    walkInput.turn = 0.5;
    const listener = jest.fn();
    const unsubscribe = subscribeWalk(listener);
    act(() => store().stopWalk());
    unsubscribe();
    expect(walkInput).toEqual({ forward: 0, strafe: 0, turn: 0, jump: false });
    expect(getWalkState()).toBeNull();
    expect(listener).toHaveBeenCalled();
  });

  it("resets input left over from a previous walk on start", () => {
    load();
    walkInput.forward = 1;
    act(() => store().startWalk());
    expect(walkInput.forward).toBe(0);
  });
});

describe("sinking while walking", () => {
  it("starts an iceberg trial and keeps the walk going", () => {
    load();
    act(() => store().startWalk());
    act(() => store().sinkWhileWalking());
    expect(store().walk.status).toBe("walking");
    const { trial } = store();
    expect(trial).toMatchObject({
      status: "running",
      descending: false,
      from: "start",
    });
    if (trial.status !== "running") throw new Error("expected running");
    expect(trial.input.iceberg?.impactX).toBeCloseTo(
      0.2 * gridLength(testShip())
    );
  });

  it("rides her down when she sinks, then waits for Stop to show the result", () => {
    load();
    act(() => store().startWalk());
    act(() => store().sinkWhileWalking());
    const { trial } = store();
    if (trial.status !== "running") throw new Error("expected running");
    const sunk = runTrial(trial.input);
    expect(sunk.outcome).toBe("sank");

    const statuses: string[] = [];
    const unsubscribe = useShipBuilderStore.subscribe((s) =>
      statuses.push(s.trial.status)
    );
    act(() => store().finishTrial(sunk));
    unsubscribe();
    expect(statuses).toEqual(["running"]);
    expect(store().trial).toMatchObject({
      status: "running",
      descending: true,
      from: "end",
    });
    expect(store().walk.status).toBe("walking");

    const descent = store().trial;
    if (descent.status !== "running") throw new Error("expected running");
    expect(descent.runId).not.toBe(trial.runId);
    act(() => store().finishTrial(runTrial(descent.input)));
    expect(store().trial).toMatchObject({
      status: "result",
      descending: true,
    });
    expect(store().walk.status).toBe("walking");

    act(() => store().stopWalk());
    expect(store().walk).toEqual({ status: "idle" });
    expect(store().trial.status).toBe("result");
    expect(getWalkState()).toBeNull();
  });

  it("keeps the walk when the result is not a sinking", () => {
    load();
    act(() => store().startWalk());
    act(() => store().sinkWhileWalking());
    const { trial } = store();
    if (trial.status !== "running") throw new Error("expected running");
    const state = { ...createTrial(trial.input), events: [] };
    act(() => store().finishTrial(state));
    expect(store().trial.status).toBe("result");
    expect(store().walk.status).toBe("walking");
  });

  it("does nothing unless walking with no trial", () => {
    load();
    act(() => store().sinkWhileWalking());
    expect(store().trial.status).toBe("idle");

    act(() => store().startWalk());
    act(() => store().sinkWhileWalking());
    const first = store().trial;
    act(() => store().sinkWhileWalking());
    expect(store().trial).toBe(first);
  });

  it("stopping the trial leaves the walk going", () => {
    load();
    act(() => store().startWalk());
    act(() => store().sinkWhileWalking());
    act(() => store().endTrial());
    expect(store().trial.status).toBe("idle");
    expect(store().walk.status).toBe("walking");
  });
});
