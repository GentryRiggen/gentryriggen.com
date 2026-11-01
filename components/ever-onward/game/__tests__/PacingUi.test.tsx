import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { newSave } from "@/lib/ever-onward/engine/save";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import GameScreen from "../GameScreen";
import RateReadout from "../RateReadout";

class QuietObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

function renderScreen(
  run: RunState,
  onAction = jest.fn(),
  onGreet = jest.fn()
) {
  window.IntersectionObserver =
    QuietObserver as unknown as typeof IntersectionObserver;
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
      onTap={jest.fn(() => 1)}
      onBuy={jest.fn()}
      onAction={onAction}
      onGreet={onGreet}
      onChooseLantern={jest.fn()}
      onBuyEmber={jest.fn()}
      onDismissEmberTip={jest.fn()}
      onRestart={jest.fn()}
      onLeave={jest.fn()}
      onDismissOverlay={jest.fn()}
      currentSave={newSave()}
      onReplaceSave={jest.fn()}
    />
  );
  return onAction;
}

const coastRun = (resources: Record<string, number>): RunState => {
  const run = newRun(lightUniverse);
  return {
    ...run,
    taps: 1,
    time: 5,
    revealed: ["lens", "keeper"],
    resources: { ...run.resources, ...resources },
  };
};

describe("upgrade cards", () => {
  it("show what the upgrade will change", () => {
    renderScreen(coastRun({ ships: 30, coins: 0 }));
    const list = screen.getByRole("region", { name: "Upgrades" });
    expect(
      within(list).getAllByTestId("lm-effect-preview")[0]
    ).toHaveTextContent("Ships per flash 1 → 2");
  });

  it("hint that more will unlock, and never mention boons", () => {
    renderScreen(coastRun({ ships: 30 }));
    expect(
      screen.getByText("More upgrades unlock as you grow…")
    ).toBeInTheDocument();
    expect(screen.queryByText(/boon/i)).not.toBeInTheDocument();
  });
});

describe("the oil button", () => {
  it("is hidden before the first ships", () => {
    renderScreen(coastRun({ ships: 0 }));
    expect(screen.queryByRole("region", { name: "Actions" })).toBeNull();
  });

  it("shows the price, a hint and the tank, and buys on click", async () => {
    const onAction = renderScreen(
      coastRun({ ships: 30, coins: 500, oil: 5, oilPrice: 1.2 })
    );
    const actions = screen.getByRole("region", { name: "Actions" });
    expect(within(actions).getByTestId("lm-action-hint")).toHaveTextContent(
      "cheap!"
    );
    expect(actions).toHaveTextContent("1.20 a barrel");
    expect(actions).toHaveTextContent("tank 5 of 40");
    await userEvent.click(
      within(actions).getByRole("button", { name: /Buy oil/ })
    );
    expect(onAction).toHaveBeenCalledWith("buy-oil");
  });

  it("flags a pricey day, and can't be clicked without coins", async () => {
    const onAction = renderScreen(
      coastRun({ ships: 30, coins: 1, oil: 5, oilPrice: 4 })
    );
    const actions = screen.getByRole("region", { name: "Actions" });
    expect(within(actions).getByTestId("lm-action-hint")).toHaveTextContent(
      "pricey"
    );
    await userEvent.click(within(actions).getByRole("button"));
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("net rate readout", () => {
  it("is signed, and green while it rises", () => {
    render(<RateReadout rate={12.5} trend="up" testId="r" />);
    expect(screen.getByTestId("r")).toHaveTextContent("+12");
    expect(screen.getByTestId("r").className).toMatch(/emerald/);
  });

  it("goes red and minus when the lamp costs more than it earns", () => {
    render(<RateReadout rate={-3} trend="flat" testId="r" />);
    expect(screen.getByTestId("r")).toHaveTextContent("−3/s");
    expect(screen.getByTestId("r").className).toMatch(/red/);
  });
});
