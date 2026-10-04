import { act } from "react";
import { runTrial } from "../../sim/seaTrial";
import { gridPart, testShip } from "../../testing";
import { createInitialState, useShipBuilderStore } from "../store";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("iceberg aiming", () => {
  it("freezes building, switches to the side view and cancels back", () => {
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([gridPart("a", "deck-1x1", 0, 0, 0)]),
      })
    );
    act(() => store().setCameraView("top"));
    const { nonce } = store().camera;
    act(() => store().aimIceberg());

    expect(store().trial).toEqual({ status: "aiming" });
    expect(store().camera.view).toBe("side");
    expect(store().camera.nonce).toBeGreaterThan(nonce);
    expect(store().placeAt({ kind: "grid", level: 0, x: 2, z: 0 })).toEqual({
      ok: false,
      reason: "Building is paused during the sea trial",
    });

    act(() => store().cancelAim());
    expect(store().trial.status).toBe("idle");
  });

  it("does not aim or cancel while a trial runs", () => {
    act(() => store().startTrial("calm"));
    act(() => store().aimIceberg());
    expect(store().trial.status).toBe("running");
    act(() => store().cancelAim());
    expect(store().trial.status).toBe("running");
  });

  it("can aim again from a finished trial", () => {
    act(() => store().startTrial("calm", 12));
    const { trial } = store();
    if (trial.status !== "running") throw new Error("not running");
    act(() => store().finishTrial(runTrial(trial.input)));
    act(() => store().aimIceberg());
    expect(store().trial).toEqual({ status: "aiming" });
  });

  it("starts the iceberg trial from aiming at the tapped spot", () => {
    act(() => store().aimIceberg());
    act(() => store().startTrial("calm", 12));
    const { trial } = store();
    if (trial.status !== "running") throw new Error("not running");
    expect(trial.input.iceberg?.impactX).toBe(12);
  });
});
