import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runTrial } from "@/lib/ship-builder/sim/seaTrial";
import { bestValue } from "@/lib/ship-builder/challenges/progress";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { findTemplate } from "@/lib/ship-builder/templates";
import { challengeProgress } from "../../hooks/challengeProgress";
import SeaTrialResult from "../SeaTrialResult";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  localStorage.clear();
  act(() => {
    challengeProgress.resetMemory();
    useShipBuilderStore.setState(createInitialState());
    store().loadShip(findTemplate("titanic")!.build(), "titanic-save");
  });
});

function finishChallenge(id: "outlast" | "evacuation" | "shipshape") {
  act(() => store().startChallenge(id));
  const { trial } = store();
  if (trial.status !== "running") throw new Error("not running");
  act(() => store().finishTrial(runTrial(trial.input)));
}

describe("a challenge result", () => {
  it("shows no challenge section after an ordinary trial", () => {
    act(() => store().startTrial("calm"));
    const { trial } = store();
    if (trial.status !== "running") throw new Error("not running");
    act(() => store().finishTrial(runTrial(trial.input)));
    render(<SeaTrialResult />);
    expect(screen.queryByText(/Challenge:/)).toBeNull();
  });

  it("gives the Titanic one star on the iceberg and saves it", () => {
    finishChallenge("outlast");
    render(<SeaTrialResult />);
    const section = screen.getByRole("region", {
      name: "Challenge: Outlast the Titanic",
    });
    expect(section).toHaveTextContent("Stayed afloat 2 hours 33 minutes");
    expect(
      screen.getByRole("img", { name: "1 of 3 stars" })
    ).toBeInTheDocument();
    expect(screen.getByText("New best!")).toBeInTheDocument();
    expect(
      screen.getByText(/For the next star: stay afloat/)
    ).toBeInTheDocument();
    expect(
      bestValue(challengeProgress.get(), "titanic-save", "outlast")
    ).toBeGreaterThanOrEqual(60);
  });

  it("scores the evacuation from the plan the scene plays", () => {
    finishChallenge("evacuation");
    render(<SeaTrialResult />);
    expect(screen.getByText(/% of people saved/)).toBeInTheDocument();
    expect(
      bestValue(challengeProgress.get(), "titanic-save", "evacuation")
    ).toBeGreaterThan(0);
  });

  it("gives a stable ship three stars for Shipshape", () => {
    finishChallenge("shipshape");
    render(<SeaTrialResult />);
    expect(
      screen.getByRole("img", { name: "3 of 3 stars" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Three stars/)).toBeInTheDocument();
  });

  it("does not call a repeat a new best, and keeps the better value", () => {
    finishChallenge("shipshape");
    const { unmount } = render(<SeaTrialResult />);
    unmount();
    finishChallenge("shipshape");
    render(<SeaTrialResult />);
    expect(screen.queryByText("New best!")).toBeNull();
  });

  it("runs the challenge again from the card", async () => {
    const user = userEvent.setup();
    finishChallenge("shipshape");
    render(<SeaTrialResult />);
    await user.click(
      screen.getByRole("button", { name: /Try the challenge again/ })
    );
    expect(store().trial.status).toBe("running");
  });

  it("keeps stars for an unsaved ship under the unsaved bucket", () => {
    act(() => store().loadShip(findTemplate("titanic")!.build(), null));
    finishChallenge("shipshape");
    render(<SeaTrialResult />);
    expect(bestValue(challengeProgress.get(), "unsaved", "shipshape")).toBe(3);
  });
});
