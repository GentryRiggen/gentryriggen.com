import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  recordBest,
  EMPTY_PROGRESS,
} from "@/lib/ship-builder/challenges/progress";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { challengeProgress } from "@/lib/ship-builder/challenges/progressStore";
import ChallengesDialog from "../ChallengesDialog";

beforeEach(() => {
  localStorage.clear();
  act(() => {
    challengeProgress.resetMemory();
    useShipBuilderStore.setState(createInitialState());
  });
});

describe("ChallengesDialog", () => {
  it("lists every challenge with no stars on a fresh ship", () => {
    render(<ChallengesDialog onClose={jest.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Outlast the Titanic" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Everyone off safely" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Shipshape" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Smooth sailing" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "0 of 3 stars" })).toHaveLength(
      4
    );
    expect(screen.getByTestId("total-stars")).toHaveTextContent("0");
  });

  it("shows this ship's stars and the total across ships", () => {
    act(() => {
      let progress = recordBest(EMPTY_PROGRESS, "unsaved", "outlast", 170);
      progress = recordBest(progress, "other-ship", "evacuation", 100);
      challengeProgress.set(progress);
    });
    render(<ChallengesDialog onClose={jest.fn()} />);
    expect(
      screen.getByRole("img", { name: "2 of 3 stars" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("total-stars")).toHaveTextContent("5");
    expect(
      screen.getByText(/Best: Stayed afloat 2 hours 50 minutes/)
    ).toBeInTheDocument();
  });

  it("runs the chosen challenge's trial and closes", async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<ChallengesDialog onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /Start Shipshape/ }));
    const { trial } = useShipBuilderStore.getState();
    expect(trial.status).toBe("running");
    if (trial.status !== "running") return;
    expect(trial.challenge).toBe("shipshape");
    expect(trial.input.sea).toBe("stormy");
    expect(onClose).toHaveBeenCalled();
  });

  it("strikes the iceberg trial at the fixed spot in a calm sea", async () => {
    const user = userEvent.setup();
    render(<ChallengesDialog onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: /Start Outlast/ }));
    const { trial } = useShipBuilderStore.getState();
    if (trial.status !== "running") throw new Error("expected a running trial");
    expect(trial.challenge).toBe("outlast");
    expect(trial.input.sea).toBe("calm");
    expect(trial.input.iceberg?.breakMode).toBe("real");
  });

  it("breaches the whole hull for the evacuation, so she really sinks", async () => {
    const user = userEvent.setup();
    render(<ChallengesDialog onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: /Start Everyone/ }));
    const { trial, ship } = useShipBuilderStore.getState();
    if (trial.status !== "running") throw new Error("expected a running trial");
    expect(trial.input.iceberg?.gashLength).toBe(trial.input.length);
    expect(trial.input.length).toBeGreaterThan(0);
    expect(ship.hull.lengthSegments).toBeGreaterThan(0);
  });

  it("leaves the Titanic challenge's gash at the usual size", async () => {
    const user = userEvent.setup();
    render(<ChallengesDialog onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: /Start Outlast/ }));
    const { trial } = useShipBuilderStore.getState();
    if (trial.status !== "running") throw new Error("expected a running trial");
    expect(trial.input.iceberg?.gashLength).toBeUndefined();
  });

  it("switches to the leaderboard tab (off in tests)", async () => {
    const user = userEvent.setup();
    render(<ChallengesDialog onClose={jest.fn()} />);
    await user.click(screen.getByRole("tab", { name: "Leaderboard" }));
    expect(screen.getByText(/leaderboard is switched off/)).toBeInTheDocument();
    const tabs = within(screen.getByRole("tablist"));
    expect(tabs.getByRole("tab", { name: "Leaderboard" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("closes on Escape", async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<ChallengesDialog onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
