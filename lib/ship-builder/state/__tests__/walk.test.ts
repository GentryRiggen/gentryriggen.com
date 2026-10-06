import { act } from "react";
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

  it("does not start during setup, sailing or a trial", () => {
    load();
    act(() => store().openDrive());
    act(() => store().startWalk());
    expect(store().walk.status).toBe("idle");
    act(() => store().startDrive({ seed: 1, kinds: [], density: "few" }));
    act(() => store().startWalk());
    expect(store().walk.status).toBe("idle");
    act(() => store().endDrive());

    act(() => store().startTrial("calm"));
    act(() => store().startWalk());
    expect(store().walk.status).toBe("idle");
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
    expect(walkInput).toEqual({ forward: 0, strafe: 0, turn: 0 });
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
