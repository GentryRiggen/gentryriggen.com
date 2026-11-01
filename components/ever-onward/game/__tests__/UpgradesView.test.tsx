import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { newSave } from "@/lib/ever-onward/engine/save";
import type {
  RunState,
  UniverseDef,
  UniverseSave,
} from "@/lib/ever-onward/engine/types";
import { growUniverse } from "@/lib/ever-onward/universes/grow";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import {
  currentEffectText,
  ownedRunUpgradesByPhase,
} from "@/lib/ever-onward/engine/ownedUpgrades";
import EmberPanel from "../EmberPanel";
import GameScreen from "../GameScreen";
import UpgradesDialog from "../UpgradesDialog";
import type { Overlay } from "../useGame";

class QuietObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation();
  window.localStorage.clear();
  window.IntersectionObserver =
    QuietObserver as unknown as typeof IntersectionObserver;
  window.ResizeObserver = QuietObserver as unknown as typeof ResizeObserver;
});

function universeOf(
  def: UniverseDef,
  patch: {
    owned?: Record<string, number>;
    phase?: number;
    prestige?: Record<string, number>;
    embers?: number;
  } = {}
): UniverseSave {
  const run: RunState = {
    ...newRun(def),
    phase: patch.phase ?? 0,
    owned: patch.owned ?? {},
  };
  return {
    run,
    best: null,
    completions: 0,
    embers: patch.embers ?? 0,
    prestigeUpgrades: patch.prestige ?? {},
  };
}

function renderScreen(
  def: UniverseDef,
  universe: UniverseSave,
  overlay: Overlay = null
) {
  return render(
    <GameScreen
      def={def}
      universe={universe}
      overlay={overlay}
      onTap={jest.fn(() => 1)}
      onBuy={jest.fn()}
      onAction={jest.fn()}
      onGreet={jest.fn()}
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
}

const lightOwned = { lens: 2, keeper: 1 };

describe("the Your upgrades button", () => {
  it("is hidden until something is owned", () => {
    renderScreen(lightUniverse, universeOf(lightUniverse));
    expect(screen.queryByTestId("lm-upgrades-button")).not.toBeInTheDocument();
  });

  it("shows for an owned run upgrade", () => {
    renderScreen(
      lightUniverse,
      universeOf(lightUniverse, { owned: lightOwned })
    );
    expect(
      screen.getByRole("button", { name: "Your upgrades" })
    ).toBeInTheDocument();
  });

  it("shows for an owned permanent upgrade alone", () => {
    renderScreen(
      lightUniverse,
      universeOf(lightUniverse, { prestige: { "ember-tap": 1 } })
    );
    expect(screen.getByTestId("lm-upgrades-button")).toBeInTheDocument();
  });
});

describe("the Your upgrades dialog", () => {
  it("opens, closes every way, and restores focus", async () => {
    renderScreen(
      lightUniverse,
      universeOf(lightUniverse, { owned: lightOwned })
    );
    const opener = () => screen.getByTestId("lm-upgrades-button");
    for (const close of [
      () => userEvent.keyboard("{Escape}"),
      () =>
        userEvent.click(
          screen.getByRole("button", { name: "Close your upgrades" })
        ),
      () => userEvent.click(screen.getByTestId("lm-upgrades-backdrop")),
    ]) {
      await userEvent.click(opener());
      const dialog = screen.getByRole("dialog", { name: "Your upgrades" });
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(
        screen.getByRole("button", { name: "Close your upgrades" })
      ).toHaveFocus();
      await close();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(opener()).toHaveFocus();
    }
  });

  it("makes the game behind it inert while open", async () => {
    renderScreen(
      lightUniverse,
      universeOf(lightUniverse, { owned: lightOwned })
    );
    await userEvent.click(screen.getByTestId("lm-upgrades-button"));
    expect(screen.getByRole("main")).toHaveAttribute("inert");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("main")).not.toHaveAttribute("inert");
  });

  it("lists Embers for Light, Acorns for Grow, with level and what it does", () => {
    const light = universeOf(lightUniverse, { prestige: { "ember-tap": 2 } });
    const { unmount } = render(
      <UpgradesDialog
        def={lightUniverse}
        universe={light}
        onClose={jest.fn()}
      />
    );
    const item = screen.getByTestId("lm-upgrades-permanent-item");
    const tap = lightUniverse.prestige.upgrades.find(
      (u) => u.id === "ember-tap"
    )!;
    expect(item).toHaveTextContent(tap.name);
    expect(item).toHaveTextContent(tap.description);
    expect(item).toHaveTextContent(`Level 2 of ${tap.maxLevel}`);
    unmount();

    const grow = universeOf(growUniverse);
    render(
      <UpgradesDialog def={growUniverse} universe={grow} onClose={jest.fn()} />
    );
    expect(screen.getByTestId("lm-upgrades-permanent-empty")).toHaveTextContent(
      /acorns/
    );
  });

  it("explains how to earn the currency when nothing is owned", () => {
    render(
      <UpgradesDialog
        def={lightUniverse}
        universe={universeOf(lightUniverse)}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByTestId("lm-upgrades-permanent-empty")).toHaveTextContent(
      /earn embers/
    );
    expect(screen.queryByTestId("lm-upgrades-run-item")).toBeNull();
  });

  it("groups run upgrades by phase, newest first, with current values", () => {
    const universe = universeOf(growUniverse, {
      phase: 1,
      owned: { sprinkler: 3, tractor: 1 },
    });
    render(
      <UpgradesDialog
        def={growUniverse}
        universe={universe}
        onClose={jest.fn()}
      />
    );
    const groups = screen.getAllByTestId("lm-upgrades-group");
    expect(groups).toHaveLength(2);
    expect(
      within(groups[0]).getByText(/tractor/i, { selector: "p" })
    ).toBeInTheDocument();
    expect(
      within(groups[1]).getByText(/sprinkler/i, { selector: "p" })
    ).toBeInTheDocument();
    expect(within(groups[1]).getByText("Level 3 of 8")).toBeInTheDocument();
    const text = screen
      .getAllByTestId("lm-upgrades-run-item")
      .map((i) => i.textContent)
      .join(" ");
    expect(text).not.toMatch(/→|->/);
  });

  it("does not re-render its lists when only the clock moves", () => {
    const base = universeOf(lightUniverse, { owned: lightOwned });
    const onClose = jest.fn();
    const spy = jest.spyOn(
      lightUniverse.upgrades.find((u) => u.id === "lens")!,
      "effectPreview"
    );
    const { rerender } = render(
      <UpgradesDialog def={lightUniverse} universe={base} onClose={onClose} />
    );
    const calls = spy.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    rerender(
      <UpgradesDialog
        def={lightUniverse}
        universe={{ ...base, run: { ...base.run, time: base.run.time + 1 } }}
        onClose={onClose}
      />
    );
    expect(spy.mock.calls.length).toBe(calls);
    spy.mockRestore();
  });
});

describe("currentEffectText", () => {
  it("keeps the before side for levelled upgrades", () => {
    expect(currentEffectText("Coins/sec 12 → 17 · Per tap 2 -> 3", false)).toBe(
      "Coins/sec 12 · Per tap 2"
    );
  });
  it("keeps the after side for one-offs", () => {
    expect(
      currentEffectText("Probes: 0 → 1, and they copy themselves", true)
    ).toBe("Probes: 1, and they copy themselves");
    expect(currentEffectText(null, true)).toBeNull();
  });
});

describe("ownedRunUpgradesByPhase", () => {
  it("returns nothing for a fresh run", () => {
    expect(
      ownedRunUpgradesByPhase(lightUniverse, newRun(lightUniverse))
    ).toEqual([]);
  });
});

describe("the Active tag in the ember dialog", () => {
  it("marks only the permanent upgrades the player owns", () => {
    render(
      <EmberPanel
        def={lightUniverse}
        universe={universeOf(lightUniverse, {
          prestige: { "ember-tap": 1 },
          embers: 1,
        })}
        onBuy={jest.fn()}
        onRestart={jest.fn()}
      />
    );
    const tags = screen.getAllByTestId("lm-active-tag");
    expect(tags).toHaveLength(1);
    expect(tags[0]).toHaveTextContent("Active");
  });
});

describe("the background while a cutscene is open", () => {
  it("is inert, including the Next goal bar and the tap button", () => {
    renderScreen(
      lightUniverse,
      universeOf(lightUniverse, { owned: lightOwned }),
      "phase"
    );
    expect(screen.getByRole("main")).toHaveAttribute("inert");
    expect(screen.getByTestId("lm-hud")).toHaveAttribute("inert");
    expect(screen.getByTestId("lm-scene-frame").parentElement).toHaveAttribute(
      "inert"
    );
  });
});
