import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newSave } from "@/lib/ever-onward/engine/save";
import { newRun } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import { tankCapacity } from "@/lib/ever-onward/universes/light/tick";
import GameScreen from "../GameScreen";

function renderScreen(run: RunState, onTap = jest.fn(() => 1)) {
  render(
    <GameScreen
      def={lightUniverse}
      universe={{
        run,
        best: null,
        completions: 0,
        embers: 0,
        prestigeUpgrades: {},
      }}
      overlay={null}
      onTap={onTap}
      onBuy={jest.fn()}
      onAction={jest.fn()}
      onGreet={jest.fn()}
      onChooseLantern={jest.fn()}
      onBuyEmber={jest.fn()}
      onDismissEmberTip={jest.fn()}
      onRestart={jest.fn()}
      onStartOver={jest.fn()}
      onLeave={jest.fn()}
      onDismissOverlay={jest.fn()}
      currentSave={newSave()}
      onReplaceSave={jest.fn()}
    />
  );
  return onTap;
}

describe("sticky HUD", () => {
  it("is always there, with the currency and the rate", () => {
    const run = { ...newRun(lightUniverse), taps: 1, time: 5 };
    run.resources.coins = 1234;
    renderScreen(run);
    expect(screen.getByTestId("lm-hud")).toHaveAttribute(
      "aria-hidden",
      "false"
    );
    expect(screen.getByTestId("lm-hud-value")).toHaveTextContent("1.23K");
    expect(screen.getByTestId("lm-hud-rate")).toHaveTextContent("/s");
  });

  it("is the only place the main currency is shown", () => {
    const run = { ...newRun(lightUniverse), taps: 1, time: 5 };
    renderScreen(run);
    expect(screen.queryByTestId("lm-res-coins")).toBeNull();
    // Secondary figures remain available behind More details.
    expect(screen.getByTestId("lm-res-ships")).not.toBeVisible();
  });

  it("shows the part's goal as a small icon and count, explained on a tap", async () => {
    const run = { ...newRun(lightUniverse), taps: 1, time: 5 };
    run.owned = { lighthouse: 2 };
    run.resources.lighthouses = 3;
    renderScreen(run);
    const goal = within(screen.getByTestId("lm-hud")).getByTestId("lm-goal");
    expect(screen.getByTestId("lm-goal-count")).toHaveTextContent("3/8");
    expect(goal).toHaveAccessibleName(/Goal: light the coast\. 3 of 8/);
    await userEvent.setup().click(goal);
    expect(screen.getByTestId("lm-hud-explain")).toHaveTextContent(
      /Next lighthouse: .* coins/
    );
  });

  it("says what the money is for when it is tapped", async () => {
    renderScreen({ ...newRun(lightUniverse), taps: 1, time: 5 });
    await userEvent.setup().click(screen.getByTestId("lm-hud-money"));
    expect(screen.getByTestId("lm-hud-explain")).toHaveTextContent(
      /Coins: buys keepers/
    );
  });

  it("never picks an upgrade for the player", () => {
    const run = { ...newRun(lightUniverse), taps: 1, time: 5 };
    run.revealed = lightUniverse.upgrades.map((u) => u.id);
    renderScreen(run);
    expect(screen.queryByTestId("lm-hud-next")).toBeNull();
  });

  it("keeps the one tap button reachable at all times", () => {
    const run = { ...newRun(lightUniverse), taps: 1, time: 5 };
    const onTap = renderScreen(run);
    expect(screen.queryByTestId("lm-hud-tap")).toBeNull();
    screen.getByRole("button", { name: "Flash the light" }).click();
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  describe("the oil gauge", () => {
    const withKeeper = (oil: number) => {
      const run = { ...newRun(lightUniverse), taps: 30, time: 5 };
      run.owned = { keeper: 2 };
      run.resources.oil = oil;
      return run;
    };

    it("stays on the HUD with the oil and the tank size", () => {
      const full = withKeeper(0);
      full.resources.oil = tankCapacity(full);
      renderScreen(full);
      const gauge = within(screen.getByTestId("lm-hud")).getByTestId(
        "lm-hud-gauge"
      );
      expect(gauge).toHaveAttribute("data-tone", "ok");
      expect(gauge).toHaveAccessibleName(/^Oil: \d+ \/ \d/);
    });

    it("turns red and says it is nearly empty when the tank is dry", () => {
      renderScreen(withKeeper(0));
      const gauge = screen.getByTestId("lm-hud-gauge");
      expect(gauge).toHaveAttribute("data-tone", "critical");
      expect(gauge).toHaveAccessibleName(/Nearly empty!/);
    });

    it("is not there before the first keeper", () => {
      renderScreen({ ...newRun(lightUniverse), taps: 1, time: 5 });
      expect(screen.queryByTestId("lm-hud-gauge")).toBeNull();
    });

    it("keeps Buy Oil on its own full-width row, above the warning", () => {
      renderScreen(withKeeper(0));
      const buy = screen.getByTestId("lm-buy-oil");
      expect(buy).toHaveClass("w-full", "h-12");
      const lamp = screen.getByTestId("lm-lamp");
      const alert = screen.getByTestId("lm-alert");
      expect(
        lamp.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });
  });
});
