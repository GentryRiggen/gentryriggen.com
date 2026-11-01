import { act } from "react";
import { trackGame } from "@/lib/analytics/trackGame";
import { runTrial } from "../../sim/seaTrial";
import { testShip } from "../../testing";
import { requestBoard, takeEscapeRequest } from "../escapeActions";
import { resetEscape } from "../escapeLive";
import { createInitialState, useShipBuilderStore } from "../store";

jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));

const store = () => useShipBuilderStore.getState();
const escapeCalls = () =>
  jest
    .mocked(trackGame)
    .mock.calls.filter(([name]) => name === "escape_ending");

beforeEach(() => {
  jest.mocked(trackGame).mockClear();
  act(() => useShipBuilderStore.setState(createInitialState()));
  act(() => store().loadShip(testShip(), null));
});

function walk() {
  act(() => store().startWalk());
}

/** A finished trial showing its result, with an escape on the record. */
function resultWithEscape() {
  act(() => store().startTrial("calm", 5));
  const { trial } = store();
  if (trial.status !== "running") throw new Error("not running");
  act(() => store().finishTrial(runTrial(trial.input)));
  act(() =>
    useShipBuilderStore.setState({
      lastEscape: { ending: "deck", boat: "davit" },
    })
  );
}

describe("escape_ending analytics", () => {
  it("fires once per recorded ending", () => {
    walk();
    act(() => store().recordEscape("swim", "raft"));
    act(() => store().recordEscape("frozen", "none"));
    expect(escapeCalls()).toEqual([
      ["escape_ending", { ending: "swim", boat: "raft" }],
    ]);
  });

  it("does not fire when not walking", () => {
    act(() => store().recordEscape("deck", "davit"));
    expect(escapeCalls()).toHaveLength(0);
  });
});

describe("clearEscape", () => {
  it("lets the next ending record afresh and fire again", () => {
    walk();
    act(() => store().recordEscape("deck", "davit"));
    act(() => store().clearEscape());
    expect(store().lastEscape).toBeNull();
    act(() => store().recordEscape("frozen", "none"));
    expect(store().lastEscape).toEqual({ ending: "frozen", boat: "none" });
    expect(escapeCalls()).toHaveLength(2);
  });
});

describe("forgetting the last escape", () => {
  it("retryTrial clears it", () => {
    resultWithEscape();
    act(() => store().retryTrial());
    expect(store().lastEscape).toBeNull();
  });

  it("replay clears it", () => {
    resultWithEscape();
    act(() => store().replay());
    expect(store().lastEscape).toBeNull();
  });
});

describe("resetEscape", () => {
  it("drops a stale tap", () => {
    requestBoard();
    resetEscape();
    expect(takeEscapeRequest()).toBeNull();
  });
});
