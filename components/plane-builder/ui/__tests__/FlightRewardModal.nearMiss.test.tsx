import { render, screen } from "@testing-library/react";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import type { FlightSummary } from "@/lib/plane-builder/state/store";
import { payout } from "@/lib/plane-builder/economy/payout";
import { LEVELS } from "@/lib/plane-builder/levels";
import FlightRewardModal from "../FlightRewardModal";

jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));

const result = {
  distance: 1000,
  coins: 5,
  rings: 0,
  nearMisses: 6,
  nearMissCoins: 30,
  bestCombo: 6,
  finished: false,
  finishTime: null,
  endReason: "crash" as const,
};

function summary(multiplier: number, isZeroed = false): FlightSummary {
  const paid = payout(LEVELS.meadow, result, multiplier, 1000);
  return {
    result,
    payout: isZeroed ? { ...paid, total: 0, nearMissEarned: 0 } : paid,
    isNewBest: false,
    previousBest: 1000,
    unlocked: null,
    bonus: null,
    seen: false,
  };
}

function show(flight: FlightSummary) {
  usePlaneBuilderStore.setState({ levelId: "meadow", screen: "hangar" });
  render(<FlightRewardModal flight={flight} levelId="meadow" />);
}

describe("FlightRewardModal near-miss line", () => {
  it("shows the near-miss coins after the plane multiplier", () => {
    show(summary(2));
    expect(screen.getByTestId("reward-near-misses")).toHaveTextContent(
      "Best combo ×5"
    );
    expect(screen.getByTestId("reward-near-misses")).toHaveTextContent(
      "+60 coins"
    );
  });

  it("drops the coin part when the flight paid nothing", () => {
    show(summary(1, true));
    const line = screen.getByTestId("reward-near-misses");
    expect(line).toHaveTextContent("Close calls 6");
    expect(line).not.toHaveTextContent("coins");
  });
});
