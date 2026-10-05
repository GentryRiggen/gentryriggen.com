import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { runTrial } from "@/lib/ship-builder/sim/seaTrial";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import useKeyboardShortcuts from "../../hooks/useKeyboardShortcuts";
import SeaTrialResult, { extraSummaryLines } from "../SeaTrialResult";

function ShortcutsHost() {
  useKeyboardShortcuts();
  return null;
}

function renderShortcuts() {
  render(<ShortcutsHost />);
}

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
  it("keeps Try again behind Details after a Waves trial", async () => {
    const user = userEvent.setup();
    finishTrial();
    render(<SeaTrialResult />);
    expect(
      screen.getByRole("button", { name: "Back to building" })
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Details" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Try another spot" })
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Try another spot" })
    ).toBeNull();
  });

  it("marks only the bar (not the Details sheet) for camera framing", async () => {
    const user = userEvent.setup();
    finishTrial();
    const { container } = render(<SeaTrialResult />);
    await user.click(screen.getByRole("button", { name: "Details" }));
    const marked = container.querySelectorAll("[data-sea-trial-result]");
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveAttribute("role", "region");
  });

  it("Escape closes the Details sheet but leaves the trial on its result", async () => {
    const user = userEvent.setup();
    finishTrial(14);
    render(<SeaTrialResult />);
    await act(async () => {
      renderShortcuts();
    });
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(store().trial.status).toBe("result");
  });

  it("Escape with the sheet closed still ends the trial", async () => {
    const user = userEvent.setup();
    finishTrial(14);
    render(<SeaTrialResult />);
    renderShortcuts();
    await user.keyboard("{Escape}");
    expect(store().trial.status).toBe("idle");
  });

  it("has no below-deck picture in the result", () => {
    finishTrial(14);
    render(<SeaTrialResult />);
    expect(screen.queryByTestId("result-below-deck")).toBeNull();
  });

  it("opens the summary from Details and Close hands focus back", async () => {
    const user = userEvent.setup();
    finishTrial(14);
    render(<SeaTrialResult />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const details = screen.getByRole("button", { name: "Details" });
    await user.click(details);
    expect(screen.getByRole("dialog")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(details).toHaveFocus();
  });

  it("Try again repeats an iceberg trial at the same spot", async () => {
    const user = userEvent.setup();
    finishTrial(14);
    render(<SeaTrialResult />);
    await user.click(screen.getByRole("button", { name: "Details" }));
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
    await user.click(screen.getByRole("button", { name: "Details" }));
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

describe("SeaTrialResult replay controls", () => {
  it("offers Watch again and the scrubber after an iceberg trial only", () => {
    finishTrial();
    const { unmount } = render(<SeaTrialResult />);
    expect(screen.queryByRole("button", { name: "Watch again" })).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
    unmount();

    act(() => store().endTrial());
    finishTrial(5);
    render(<SeaTrialResult />);
    expect(screen.getByRole("button", { name: "Watch again" })).toBeVisible();
    expect(screen.getByRole("slider", { name: "Look back" })).toBeVisible();
  });

  it("Watch again plays the same trial from the start", async () => {
    const user = userEvent.setup();
    finishTrial(5);
    const before = store().trial;
    render(<SeaTrialResult />);
    await user.click(screen.getByRole("button", { name: "Watch again" }));
    const { trial } = store();
    expect(trial).toMatchObject({ status: "running", from: "start" });
    if (trial.status === "running" && before.status === "result") {
      expect(trial.input).toBe(before.input);
    }
  });

  it("offers Follow her down after she sank, and not once followed", async () => {
    const user = userEvent.setup();
    finishTrial(5);
    expect(store().trial).toMatchObject({ state: { outcome: "sank" } });
    const { unmount } = render(<SeaTrialResult />);
    await user.click(screen.getByRole("button", { name: "Follow her down" }));
    expect(store().trial).toMatchObject({
      status: "running",
      descending: true,
      from: "end",
    });
    unmount();

    const { trial } = store();
    if (trial.status !== "running") throw new Error("not running");
    act(() => store().finishTrial(runTrial(trial.input)));
    render(<SeaTrialResult />);
    expect(
      screen.queryByRole("button", { name: "Follow her down" })
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Watch again" })).toBeVisible();
  });

  it("does not offer Follow her down when she stayed afloat", () => {
    act(() => store().startTrial("calm", 5));
    const { trial } = store();
    if (trial.status !== "running") throw new Error("not running");
    act(() =>
      store().finishTrial({ ...runTrial(trial.input), outcome: "afloat" })
    );
    render(<SeaTrialResult />);
    expect(
      screen.queryByRole("button", { name: "Follow her down" })
    ).toBeNull();
  });
});

describe("extraSummaryLines", () => {
  it("reads any extra text fields after title, message and tips", () => {
    expect(
      extraSummaryLines({ title: "She sank", message: "Water.", tips: ["x"] })
    ).toEqual([]);
    const summary = {
      title: "She sank",
      message: "Water.",
      tips: [],
      power: "The lights flickered, then went out as she went down.",
      breakup: "She broke in two at 19°, just behind wall 3.",
      floor: "",
      lines: ["She came to rest on the sea floor."],
    };
    expect(extraSummaryLines(summary)).toEqual([
      summary.power,
      summary.breakup,
      "She came to rest on the sea floor.",
    ]);
  });
});
