import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { newSave } from "@/lib/ever-onward/engine/save";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import GameScreen from "../GameScreen";
import UpgradeList from "../UpgradeList";

class QuietObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  window.localStorage.clear();
  window.IntersectionObserver =
    QuietObserver as unknown as typeof IntersectionObserver;
  window.ResizeObserver = QuietObserver as unknown as typeof ResizeObserver;
});

function runWith(patch: Partial<RunState>): RunState {
  const base = newRun(lightUniverse);
  return {
    ...base,
    ...patch,
    resources: { ...base.resources, ...patch.resources },
  };
}

function renderScreen(run: RunState) {
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
}

describe("upgrade cards say whether you can buy them", () => {
  it("ends an unaffordable card with how much more it needs", () => {
    renderScreen(runWith({ resources: { coins: 1 } }));
    const card = within(
      screen.getByRole("region", { name: "Upgrades" })
    ).getAllByRole("button")[0];
    expect(card).toHaveAccessibleName(/Need [\d.,]+[KMB]? more coins$/);
  });

  it("ends an affordable card with Tap to buy and lists it first", () => {
    renderScreen(runWith({ resources: { coins: 100000 } }));
    const card = within(
      screen.getByRole("region", { name: "Upgrades" })
    ).getAllByRole("button")[0];
    expect(card).toHaveAttribute("aria-disabled", "false");
    expect(card).toHaveAccessibleName(/Tap to buy$/);
  });
});

describe("the shell", () => {
  it("opens the menu as a dialog that Escape closes", async () => {
    renderScreen(runWith({}));
    const user = userEvent.setup();
    const menuButton = screen.getByRole("button", { name: "Menu" });
    await user.click(menuButton);
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(
      within(dialog).getByRole("button", { name: "Back to all universes" })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: "Sound" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("lm-tap-fab")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 10));
    expect(menuButton).toHaveFocus();
  });

  it("shows the tap hint only at the very start", () => {
    renderScreen(runWith({ taps: 0 }));
    expect(
      screen.getByText(/Tap the button at the bottom/)
    ).toBeInTheDocument();
  });

  it("drops the tap hint once the button is learned", () => {
    renderScreen(runWith({ taps: 30 }));
    expect(
      screen.queryByText(/Tap the button at the bottom/)
    ).not.toBeInTheDocument();
  });

  it("names the HUD as a Status region", () => {
    renderScreen(runWith({}));
    expect(screen.getByRole("region", { name: "Status" })).toBeInTheDocument();
  });
});

describe("the shop list", () => {
  it("shows 3 cards and the rest behind a button", async () => {
    const run = runWith({
      resources: { coins: 1e12 },
      revealed: lightUniverse.upgrades.map((u) => u.id),
    });
    render(<UpgradeList def={lightUniverse} run={run} onBuy={jest.fn()} />);
    const list = screen.getByRole("region", { name: "Upgrades" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    const more = screen.getByRole("button", {
      name: /Show \d+ more upgrades?/,
    });
    await userEvent.click(more);
    expect(more).toBeInTheDocument();
    expect(more).toHaveFocus();
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(3);
  });

  it("offers a See all button for bought upgrades", async () => {
    const onShowBought = jest.fn();
    const lens = lightUniverse.upgrades.find((u) => u.id === "lens");
    const run = runWith({ owned: { lens: lens?.maxLevel ?? 1 } });
    render(
      <UpgradeList
        def={lightUniverse}
        run={run}
        onBuy={jest.fn()}
        onShowBought={onShowBought}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Bought this part: \d+ · See all/ })
    );
    expect(onShowBought).toHaveBeenCalled();
    expect(document.querySelector("details")).toBeNull();
  });
});

describe("the shop order", () => {
  it("keeps every card in place when affordability changes", () => {
    const ids = lightUniverse.upgrades.map((u) => u.id);
    const poor = runWith({ resources: { coins: 0 }, revealed: ids });
    const rich = runWith({ resources: { coins: 1e12 }, revealed: ids });
    const names = () =>
      within(screen.getByRole("region", { name: "Upgrades" }))
        .getAllByRole("listitem")
        .map((li) => li.id);
    const { rerender } = render(
      <UpgradeList def={lightUniverse} run={poor} onBuy={jest.fn()} />
    );
    const before = names();
    rerender(<UpgradeList def={lightUniverse} run={rich} onBuy={jest.fn()} />);
    expect(names()).toEqual(before);
  });
});
