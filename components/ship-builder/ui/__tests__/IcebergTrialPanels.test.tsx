import { ICEBERG_IMPACT_S } from "@/lib/ship-builder/sim/flooding";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { createTrial } from "@/lib/ship-builder/sim/seaTrial";
import type { SimState, TrialInput } from "@/lib/ship-builder/sim/types";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { clearLiveTrial, publishLiveTrial } from "../../scene/liveTrial";
import BelowDeckInset from "../BelowDeckInset";
import SeaTrialStatus from "../SeaTrialStatus";

const store = () => useShipBuilderStore.getState();

const INPUT: TrialInput = {
  ship: { stabilityRatio: 0, listAngle: 0, beam: 5 },
  sea: "calm",
};

function stateAt(time: number): SimState {
  return { ...createTrial(INPUT), time };
}

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
  act(() => clearLiveTrial());
});

describe("BelowDeckInset", () => {
  it("shows only during an iceberg trial", () => {
    render(<BelowDeckInset />);
    expect(screen.queryByTestId("below-deck-inset")).toBeNull();

    act(() => store().startTrial("calm"));
    expect(screen.queryByTestId("below-deck-inset")).toBeNull();

    act(() => store().startTrial("calm", 12));
    expect(screen.getByRole("region", { name: "Below deck" })).toBeVisible();

    act(() => store().endTrial());
    expect(screen.queryByTestId("below-deck-inset")).toBeNull();
  });
});

describe("SeaTrialStatus story clock", () => {
  it("shows story time in an iceberg trial and not in a waves trial", () => {
    render(<SeaTrialStatus />);
    act(() => store().startTrial("calm"));
    expect(screen.getByRole("status")).toHaveTextContent("Sea trial");
    expect(screen.queryByTestId("story-clock")).toBeNull();

    act(() => store().startTrial("calm", 12));
    expect(screen.getByRole("status")).toHaveTextContent("Iceberg trial");
    expect(screen.getByTestId("story-clock")).toHaveTextContent("0 minutes");

    // The clock waits for the strike.
    act(() => publishLiveTrial(stateAt(ICEBERG_IMPACT_S), 1000));
    expect(screen.getByTestId("story-clock")).toHaveTextContent("0 minutes");

    // 24 sim seconds after impact at 5 story minutes per second is 2 hours.
    act(() => publishLiveTrial(stateAt(ICEBERG_IMPACT_S + 24), 5000));
    expect(screen.getByTestId("story-clock")).toHaveTextContent("2 hours");
  });
});
