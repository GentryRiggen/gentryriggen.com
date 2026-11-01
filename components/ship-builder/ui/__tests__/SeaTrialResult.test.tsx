import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { testShip } from "@/lib/ship-builder/testing";
import { runTrial } from "@/lib/ship-builder/sim/seaTrial";
import { analyzeShip } from "@/lib/ship-builder/model/analysis";
import { lifeboatCount } from "@/lib/ship-builder/crowd/lifeboatCount";
import { trialChoicesSetting } from "../../hooks/useTrialChoices";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import useKeyboardShortcuts from "../../hooks/useKeyboardShortcuts";
import { ESCAPE_RESULT_LINES } from "@/lib/ship-builder/escapeCopy";
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
    expect(store().trial).toEqual({
      status: "aiming",
      look: { sea: "calm", time: "day" },
    });
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
    expect(trial).toMatchObject({ status: "running" });
    if (trial.status === "running" && before.status === "result") {
      expect(trial.input).toBe(before.input);
    }
  });

  it("never offers Follow her down: she sinks all the way by herself", () => {
    finishTrial(5);
    expect(store().trial).toMatchObject({
      state: { outcome: "sank" },
      descending: true,
    });
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

describe("SeaTrialResult while walking", () => {
  it("waits for the walk to stop, then shows the card", () => {
    act(() => {
      store().loadShip(testShip(), null);
      store().startWalk();
      store().sinkWhileWalking();
    });
    const { trial } = store();
    if (trial.status !== "running") throw new Error("not running");
    act(() => store().finishTrial({ ...runTrial(trial.input), events: [] }));
    expect(store().trial.status).toBe("result");
    render(<SeaTrialResult />);
    expect(
      screen.queryByRole("region", { name: "Sea trial result" })
    ).toBeNull();

    act(() => store().stopWalk());
    expect(
      screen.getByRole("region", { name: "Sea trial result" })
    ).toBeInTheDocument();
  });
});

describe("SeaTrialResult storm", () => {
  function finishStorm(template: string, lifeboats: "fill" | "titanic") {
    trialChoicesSetting.set({ lifeboats });
    act(() => store().newShipFromTemplate(template));
    act(() => store().openTrialSetup("storm"));
    act(() => store().startSetupTrial());
    const { trial } = store();
    if (trial.status !== "running") throw new Error("not running");
    act(() => store().finishTrial(runTrial(trial.input)));
  }

  afterEach(() => window.localStorage.clear());

  it("Try again runs the same storm again", async () => {
    const user = userEvent.setup();
    finishStorm("little-hopper", "fill");
    const before = store().trial;
    render(<SeaTrialResult />);
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.click(screen.getByRole("button", { name: "Try again" }));
    const { trial } = store();
    expect(trial.status).toBe("running");
    if (trial.status === "running" && before.status === "result") {
      expect(trial.input.storm).toBeDefined();
      expect(trial.input.sea).toBe("wild");
      expect(trial.input).toEqual(before.input);
    }
  });

  it("says everyone fit when the seats were enough", () => {
    finishStorm("little-hopper", "fill");
    const ship = store().ship;
    const { seats, people } = lifeboatCount(ship, analyzeShip(ship).stats);
    expect(seats).toBeGreaterThanOrEqual(people);
    render(<SeaTrialResult />);
    const line = screen.getByTestId("lifeboat-line");
    expect(line).toHaveTextContent("Everyone fit in the lifeboats!");
    expect(line).toHaveTextContent(
      `Lifeboat seats: ${seats.toLocaleString()}. People aboard: ${people.toLocaleString()}.`
    );
  });

  it("counts who was left when the seats ran short", () => {
    finishStorm("titanic", "fill");
    render(<SeaTrialResult />);
    const line = screen.getByTestId("lifeboat-line");
    // 18 davit boats: 1,098 seats for 2,300 people.
    expect(line).toHaveTextContent(
      `Not enough lifeboats: ${(1202).toLocaleString()} people were left on board.`
    );
    expect(line).toHaveTextContent(
      `Lifeboat seats: ${(1098).toLocaleString()}. People aboard: ${(2300).toLocaleString()}.`
    );
  });

  it("says some boats left half-empty in Titanic mode", () => {
    finishStorm("little-hopper", "titanic");
    render(<SeaTrialResult />);
    const line = screen.getByTestId("lifeboat-line");
    expect(line).toHaveTextContent(
      "Some boats left half-empty, like the Titanic."
    );
    expect(line).toHaveTextContent(/Lifeboat seats: .*\. People aboard: .*\./);
  });

  it("has no lifeboat line when she did not sink", () => {
    finishTrial();
    render(<SeaTrialResult />);
    expect(store().trial).toMatchObject({ state: { outcome: "steady" } });
    expect(screen.queryByTestId("lifeboat-line")).toBeNull();
  });
});

describe("SeaTrialResult escape line", () => {
  it("shows how the player got away, once they have", () => {
    finishTrial();
    const { rerender } = render(<SeaTrialResult />);
    expect(screen.queryByTestId("escape-line")).toBeNull();
    act(() =>
      useShipBuilderStore.setState({
        lastEscape: { ending: "frozen", boat: "none" },
      })
    );
    rerender(<SeaTrialResult />);
    expect(screen.getByTestId("escape-line")).toHaveTextContent(
      ESCAPE_RESULT_LINES.frozen
    );
  });
});
