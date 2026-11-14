import { act } from "react";
import { gridLength } from "../../model/grid";
import { BOMB_FALL_S, type BombDrop } from "../../sim/bombs";
import { runTrial } from "../../sim/seaTrial";
import { findTemplate } from "../../templates";
import { createInitialState, useShipBuilderStore } from "../store";

const store = () => useShipBuilderStore.getState();

function titanic() {
  const template = findTemplate("titanic");
  if (!template) throw new Error("no titanic");
  return template.build();
}

function drop(at: number, impactX: number): BombDrop {
  return { at, impactX, level: 1, z: 2, point: { x: 0, y: 2, z: 0 } };
}

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
  act(() => useShipBuilderStore.setState({ ship: titanic() }));
});

describe("Boom!", () => {
  it("arms straight away: side view, building frozen, no card to fill in", () => {
    const { nonce } = store().camera;
    act(() => store().armBombs());
    expect(store().trial).toEqual({
      status: "aiming",
      kind: "boom",
      look: { sea: "calm", time: "day" },
    });
    expect(store().camera.view).toBe("side");
    expect(store().camera.nonce).toBeGreaterThan(nonce);
    act(() => store().cancelAim());
    expect(store().trial.status).toBe("idle");
  });

  it("starts the trial with the first bomb", () => {
    act(() => store().armBombs());
    act(() => store().dropBomb(drop(BOMB_FALL_S, 20)));
    const { trial } = store();
    if (trial.status !== "running") throw new Error("not running");
    expect(trial.input.boom?.bombs).toHaveLength(1);
    expect(trial.input.boom?.length).toBe(gridLength(store().ship));
    expect(trial.resumeAt).toBeUndefined();
    expect(trial.descending).toBe(true);
  });

  it("joins a running Boom! trial and carries on from the tap", () => {
    act(() => store().armBombs());
    act(() => store().dropBomb(drop(BOMB_FALL_S, 20)));
    const first = store().trial;
    if (first.status !== "running") throw new Error("not running");
    act(() => store().dropBomb(drop(5 + BOMB_FALL_S, 40), []));
    const next = store().trial;
    if (next.status !== "running") throw new Error("not running");
    expect(next.runId).toBe(first.runId);
    expect(next.resumeAt).toBeCloseTo(5);
    expect(next.input.boom?.bombs.map((b) => b.impactX)).toEqual([20, 40]);
  });

  it("brings a finished Boom! trial back to life with another bomb", () => {
    act(() => store().armBombs());
    act(() => store().dropBomb(drop(BOMB_FALL_S, 20)));
    const running = store().trial;
    if (running.status !== "running") throw new Error("not running");
    act(() => store().finishTrial(runTrial(running.input)));
    expect(store().trial.status).toBe("result");
    act(() => store().dropBomb(drop(200, 30)));
    const again = store().trial;
    expect(again.status).toBe("running");
    if (again.status !== "running") return;
    expect(again.resumeAt).toBeCloseTo(200 - BOMB_FALL_S);
    expect(again.input.boom?.bombs).toHaveLength(2);
  });

  it("drops nothing outside Boom!", () => {
    act(() => store().dropBomb(drop(1, 10)));
    expect(store().trial.status).toBe("idle");
    act(() => store().aimIceberg());
    act(() => store().dropBomb(drop(1, 10)));
    expect(store().trial).toMatchObject({ status: "aiming" });
    act(() => store().startTrial("calm", 10));
    const iceberg = store().trial;
    act(() => store().dropBomb(drop(1, 10)));
    expect(store().trial).toBe(iceberg);
  });

  it("does not arm while walking or driving", () => {
    act(() => store().openDrive());
    act(() => store().armBombs());
    expect(store().trial.status).toBe("idle");
  });
});
