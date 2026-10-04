import { act } from "react";
import { emptyShip } from "../../model/placement";
import { runTrial } from "../../sim/seaTrial";
import type { TrialInput } from "../../sim/types";
import { createInitialState, useShipBuilderStore } from "../store";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

function placeOneDeck() {
  act(() => {
    store().selectTool("deck-1x1");
    store().placeAt({ kind: "grid", level: 0, x: 0, z: 0 });
  });
}

function runningInput(): TrialInput {
  const { trial } = store();
  if (trial.status !== "running") throw new Error("no trial is running");
  return trial.input;
}

describe("sea trial slice", () => {
  it("starts running with the ship's sim input and drops tool and selection", () => {
    placeOneDeck();
    act(() => store().select(store().ship.parts[0].id));
    act(() => store().startTrial("stormy"));

    const input = runningInput();
    expect(input.sea).toBe("stormy");
    expect(input.ship.beam).toBe(store().ship.hull.beam);
    expect(store().selectedId).toBeNull();
    expect(store().tool).toEqual({ kind: "none" });
  });

  it("moves running to result to idle, and ignores a stray finish", () => {
    const calm: TrialInput = {
      ship: { stabilityRatio: 0, listAngle: 0, beam: 5 },
      sea: "calm",
    };
    act(() => store().finishTrial(runTrial(calm)));
    expect(store().trial.status).toBe("idle");

    act(() => store().startTrial("calm"));
    const done = runTrial(runningInput());
    act(() => store().finishTrial(done));
    expect(store().trial).toMatchObject({ status: "result", state: done });

    act(() => store().endTrial());
    expect(store().trial.status).toBe("idle");
  });

  it("gives every run a new id so Try again restarts the runner", () => {
    act(() => store().startTrial("calm"));
    const first = store().trial;
    act(() => store().finishTrial(runTrial(runningInput())));
    act(() => store().startTrial("calm"));
    const second = store().trial;

    expect(first.status).toBe("running");
    expect(second.status).toBe("running");
    if (first.status !== "running" || second.status !== "running") return;
    expect(second.runId).not.toBe(first.runId);
  });

  it("leaves the ship untouched by every edit while a trial is active", () => {
    placeOneDeck();
    const id = store().ship.parts[0].id;
    const before = store().ship;
    const pastLength = store().past.length;
    act(() => store().startTrial("calm"));

    const attempts = [
      () => store().selectTool("deck-1x1"),
      () => store().selectPaint("red"),
      () => store().paintPart(id),
      () => store().paintHull("topsides"),
      () => store().placeAt({ kind: "grid", level: 0, x: 1, z: 0 }),
      () => store().select(id),
      () => store().requestDelete(),
      () => store().confirmRemoval(),
      () => store().changeHullLength(1),
      () => store().changeBeam(1),
      () => store().setBow("clipper"),
      () => store().setStern("cruiser"),
      () => store().undo(),
      () => store().redo(),
      () => store().loadShip(emptyShip(), null),
      () => store().newShip("liner"),
      () => store().newShipFromTemplate("titanic"),
    ];
    for (const attempt of attempts) act(attempt);

    expect(store().ship).toBe(before);
    expect(store().past).toHaveLength(pastLength);
    expect(store().selectedId).toBeNull();
    expect(store().tool).toEqual({ kind: "none" });
    expect(store().placeAt({ kind: "grid", level: 0, x: 2, z: 0 })).toEqual({
      ok: false,
      reason: "Building is paused during the sea trial",
    });
  });

  it("stays frozen while the result shows and unfreezes after endTrial", () => {
    placeOneDeck();
    act(() => store().startTrial("calm"));
    act(() => store().finishTrial(runTrial(runningInput())));
    act(() => store().changeHullLength(1));
    expect(store().past).toHaveLength(1);

    act(() => store().endTrial());
    act(() => store().undo());
    expect(store().ship.parts).toHaveLength(0);
  });

  it("starts an iceberg trial with the hull's compartments", () => {
    act(() => store().cycleBulkhead(2));
    act(() => store().startTrial("calm", 4));

    const { iceberg } = runningInput();
    expect(iceberg?.impactX).toBe(4);
    expect(iceberg?.length).toBe(store().ship.hull.lengthSegments * 3);
    expect(iceberg?.compartments.map((c) => c.toX)).toEqual([
      6,
      iceberg?.length,
    ]);
  });

  it("starts a waves trial without an iceberg", () => {
    act(() => store().startTrial("calm"));
    expect(runningInput().iceberg).toBeUndefined();
  });
});

describe("bulkheads", () => {
  it("cycles a wall with undo, and is paused during a trial", () => {
    act(() => store().cycleBulkhead(1));
    expect(store().ship.hull.bulkheads).toEqual([{ at: 1, height: "low" }]);
    act(() => store().undo());
    expect(store().ship.hull.bulkheads).toBeUndefined();

    act(() => store().startTrial("calm"));
    act(() => store().cycleBulkhead(1));
    expect(store().ship.hull.bulkheads).toBeUndefined();
  });

  it("ignores a boundary outside the hull without touching history", () => {
    act(() => store().cycleBulkhead(0));
    expect(store().past).toHaveLength(0);
  });
});
