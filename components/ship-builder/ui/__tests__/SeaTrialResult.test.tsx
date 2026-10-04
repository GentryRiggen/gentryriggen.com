import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runTrial } from "@/lib/ship-builder/sim/seaTrial";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import SeaTrialResult from "../SeaTrialResult";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

function finishTrial(impactX?: number) {
  act(() => store().startTrial("calm", impactX));
  const { trial } = store();
  if (trial.status !== "running") throw new Error("not running");
  act(() => store().finishTrial(runTrial(trial.input)));
}

describe("SeaTrialResult buttons", () => {
  it("offers only Try again and Back to building after a Waves trial", () => {
    finishTrial();
    render(<SeaTrialResult />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Back to building" })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Try another spot" })
    ).toBeNull();
  });

  it("Try again repeats an iceberg trial at the same spot", async () => {
    const user = userEvent.setup();
    finishTrial(14);
    render(<SeaTrialResult />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    const { trial } = store();
    expect(trial.status).toBe("running");
    if (trial.status === "running") {
      expect(trial.input.iceberg?.impactX).toBe(14);
    }
  });

  it("Try another spot goes back to aiming", async () => {
    const user = userEvent.setup();
    finishTrial(14);
    render(<SeaTrialResult />);
    await user.click(screen.getByRole("button", { name: "Try another spot" }));
    expect(store().trial).toEqual({ status: "aiming" });
  });

  it("Back to building ends the trial", async () => {
    const user = userEvent.setup();
    finishTrial(14);
    render(<SeaTrialResult />);
    await user.click(screen.getByRole("button", { name: "Back to building" }));
    expect(store().trial.status).toBe("idle");
  });
});
