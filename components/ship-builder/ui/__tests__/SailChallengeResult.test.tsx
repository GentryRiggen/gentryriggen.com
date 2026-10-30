import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { bestValue } from "@/lib/ship-builder/challenges/progress";
import { challengeProgress } from "@/lib/ship-builder/challenges/progressStore";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { findTemplate } from "@/lib/ship-builder/templates";
import SailChallengeResult from "../SailChallengeResult";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  localStorage.clear();
  act(() => {
    challengeProgress.resetMemory();
    useShipBuilderStore.setState(createInitialState());
    store().loadShip(findTemplate("titanic")!.build(), "titanic-save");
  });
});

describe("the Smooth sailing challenge", () => {
  it("starts a sail in the fixed field, marked as a challenge", () => {
    act(() => store().startChallenge("smooth"));
    const { drive } = store();
    expect(drive.status).toBe("sailing");
    if (drive.status !== "sailing") return;
    expect(drive.config.challenge).toBe("smooth");
    expect(drive.config.kinds).not.toContain("buoy");
  });

  it("does not start while a trial is running", () => {
    act(() => store().startTrial("calm"));
    act(() => store().startChallenge("smooth"));
    expect(store().drive.status).toBe("idle");
  });

  it("ignores finishSail outside a challenge sail", () => {
    act(() => store().finishSail({ reach: 200, status: "hit" }));
    expect(store().sailResult).toBeNull();
  });

  it("ends the sail and keeps the result when it finishes", () => {
    act(() => store().startChallenge("smooth"));
    act(() =>
      store().finishSail({ reach: 220, status: "hit", hitKind: "rock" })
    );
    expect(store().drive.status).toBe("idle");
    expect(store().sailResult).toMatchObject({
      challenge: "smooth",
      run: { reach: 220, status: "hit" },
    });
  });

  it("turns a stop-sailing into a gave-up result", () => {
    act(() => store().startChallenge("smooth"));
    act(() => store().finishSail({ reach: 40, status: "sailing" }));
    expect(store().sailResult?.run.status).toBe("gave-up");
  });
});

describe("SailChallengeResult", () => {
  function sail(reach: number, status: "hit" | "finished" = "hit") {
    act(() => store().startChallenge("smooth"));
    act(() =>
      store().finishSail({
        reach,
        status,
        ...(status === "hit" ? { hitKind: "iceberg" as const } : {}),
      })
    );
  }

  it("renders nothing without a result", () => {
    const { container } = render(<SailChallengeResult />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows stars, what she hit, and saves the best", () => {
    sail(220);
    render(<SailChallengeResult />);
    expect(
      screen.getByRole("region", { name: "Challenge: Smooth sailing" })
    ).toHaveTextContent("Got 220 cells from the start without a bump");
    expect(
      screen.getByRole("img", { name: "2 of 3 stars" })
    ).toBeInTheDocument();
    expect(screen.getByText("She ran into an iceberg.")).toBeInTheDocument();
    expect(screen.getByText("New best!")).toBeInTheDocument();
    expect(bestValue(challengeProgress.get(), "titanic-save", "smooth")).toBe(
      220
    );
  });

  it("gives three stars for the finish line", () => {
    sail(350, "finished");
    render(<SailChallengeResult />);
    expect(
      screen.getByRole("img", { name: "3 of 3 stars" })
    ).toBeInTheDocument();
    expect(screen.getByText(/crossed the finish line/)).toBeInTheDocument();
  });

  it("sails again from the card", async () => {
    const user = userEvent.setup();
    sail(100);
    render(<SailChallengeResult />);
    await user.click(
      screen.getByRole("button", { name: /Try the challenge again/ })
    );
    expect(store().drive.status).toBe("sailing");
    expect(store().sailResult).toBeNull();
  });

  it("says so, and keeps nothing, for a ship that cannot sail", () => {
    act(() => store().startChallenge("smooth"));
    act(() => store().finishSail({ reach: 0, status: "cannot-sail" }));
    render(<SailChallengeResult />);
    expect(screen.getByText(/no way to sail/)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /of 3 stars/ })).toBeNull();
    expect(
      bestValue(challengeProgress.get(), "titanic-save", "smooth")
    ).toBeNull();
  });

  it("goes back to building", async () => {
    const user = userEvent.setup();
    sail(100);
    render(<SailChallengeResult />);
    await user.click(screen.getByRole("button", { name: "Back to building" }));
    expect(store().sailResult).toBeNull();
  });
});
