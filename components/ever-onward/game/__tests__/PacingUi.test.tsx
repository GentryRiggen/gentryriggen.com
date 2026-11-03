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
      onStartOver={jest.fn()}
      onLeave={jest.fn()}
      onDismissOverlay={jest.fn()}
      currentSave={newSave()}
      onReplaceSave={jest.fn()}
    />
  );
  return onAction;
}

const coastRun = (
  resources: Record<string, number>,
  owned: Record<string, number> = {}
): RunState => {
  const run = newRun(lightUniverse);
  return {
    ...run,
    taps: 1,
    time: 5,
    owned,
    revealed: ["lens", "keeper"],
    resources: { ...run.resources, ...resources },
  };
};

describe("upgrade cards", () => {
  it("show what the upgrade will change", () => {
    renderScreen(coastRun({ ships: 30, coins: 0 }));
    const list = screen.getByRole("region", { name: "Upgrades" });
    const lines = within(list)
      .getAllByTestId("lm-effect-preview")
      .map((el) => el.textContent);
    expect(lines).toContain("×2 ships per flash");
    expect(lines.some((t) => t?.startsWith("+1 keeper (+"))).toBe(true);
  });

  it("hint that more will unlock, and never mention boons", () => {
    renderScreen(coastRun({ ships: 30 }));
    expect(
      screen.getByText("More upgrades unlock as you grow…")
    ).toBeInTheDocument();
    expect(screen.queryByText(/boon/i)).not.toBeInTheDocument();
  });
});

describe("the lamp panel (oil and brightness together)", () => {
  it("is hidden until the first keeper", () => {
    renderScreen(coastRun({ ships: 30 }));
    expect(screen.queryByTestId("lm-lamp")).toBeNull();
    // and the old oil list is gone: the panel absorbed it
    expect(screen.queryByRole("region", { name: "Actions" })).toBeNull();
  });

  it("shows the tank, the price and a hint, and buys oil on click", async () => {
    const onAction = renderScreen(
      coastRun({ ships: 30, coins: 500, oil: 5, oilPrice: 1.2 }, { keeper: 2 })
    );
    const lamp = screen.getByTestId("lm-lamp");
    expect(within(lamp).getByTestId("lm-oil-price")).toHaveTextContent(
      "1.20 each"
    );
    expect(within(lamp).getByTestId("lm-oil-price")).toHaveTextContent(
      "cheap!"
    );
    expect(within(lamp).getByTestId("lm-oil-gauge-count")).toHaveTextContent(
      /^5 \/ \d+/
    );
    await userEvent.click(within(lamp).getByTestId("lm-buy-oil"));
    expect(onAction).toHaveBeenCalledWith("buy-oil");
  });

  it("flags a pricey day, and can't buy oil without coins", async () => {
    const onAction = renderScreen(
      coastRun({ ships: 30, coins: 1, oil: 5, oilPrice: 4 }, { keeper: 2 })
    );
    const lamp = screen.getByTestId("lm-lamp");
    expect(within(lamp).getByTestId("lm-oil-price")).toHaveTextContent(
      "pricey"
    );
    await userEvent.click(within(lamp).getByTestId("lm-buy-oil"));
    expect(onAction).not.toHaveBeenCalled();
  });

  it("lets you pick a brightness, and shows what each would earn", async () => {
    const onAction = renderScreen(
      coastRun({ ships: 30, coins: 500, oil: 20, oilPrice: 1 }, { keeper: 5 })
    );
    const lamp = screen.getByTestId("lm-lamp");
    const radios = within(lamp).getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/Dim.*net.*tank lasts/),
      expect.stringMatching(/Normal.*net.*tank lasts/),
      expect.stringMatching(/Bright.*net.*tank lasts/),
      expect.stringMatching(/Blazing.*net.*tank lasts/),
    ]);
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    // oil at 1 is cheap: a brighter lamp is the better pick, and is marked
    expect(within(lamp).getByTestId("lm-lamp-best")).toBeInTheDocument();
    await userEvent.click(radios[3]);
    expect(onAction).toHaveBeenCalledWith("lamp-3");
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
