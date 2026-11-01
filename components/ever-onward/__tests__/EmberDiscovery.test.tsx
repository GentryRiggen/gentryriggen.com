import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { newRun } from "@/lib/ever-onward/engine/engine";
import {
  SAVE_KEY,
  loadSave,
  newSave,
  writeSave,
} from "@/lib/ever-onward/engine/save";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import EverOnward from "../EverOnward";
import EndingOverlay from "../game/EndingOverlay";
import GameScreen from "../game/GameScreen";

class QuietObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

function saveWith(
  run: RunState,
  extra: { embers?: number; hasSeenEmberTip?: boolean } = {}
) {
  writeSave({
    ...newSave(),
    seenIntro: true,
    universes: {
      light: {
        run,
        best: null,
        completions: 0,
        embers: extra.embers ?? 0,
        prestigeUpgrades: {},
        ...(extra.hasSeenEmberTip ? { hasSeenEmberTip: true } : {}),
      },
    },
  });
}

const runAtPhase = (phase: number): RunState => ({
  ...newRun(lightUniverse),
  phase,
  taps: 1,
  time: 5,
});

async function openGame() {
  const user = userEvent.setup();
  const view = render(<EverOnward />);
  await user.click(await screen.findByTestId("eo-start-button"));
  await user.click(await screen.findByRole("button", { name: /Continue/ }));
  return { user, view };
}

beforeEach(() => {
  // jsdom does not play media; the game's music code calls these.
  jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation();
  window.localStorage.clear();
  window.IntersectionObserver =
    QuietObserver as unknown as typeof IntersectionObserver;
});

describe("the embers button in the header", () => {
  it("is hidden in the first part with no embers", async () => {
    saveWith(runAtPhase(0));
    await openGame();
    expect(screen.queryByTestId("lm-ember-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lm-ember-tip")).not.toBeInTheDocument();
  });

  it("appears once a restart is possible, with the embers waiting", async () => {
    saveWith(runAtPhase(1));
    await openGame();
    const button = screen.getByTestId("lm-ember-button");
    expect(button).toHaveAccessibleName(/Embers: \d+ waiting/);
    expect(button).toHaveTextContent(/^\+[1-9]\d*$/);
  });

  it("appears in the first part when embers are saved, showing the total", async () => {
    saveWith(runAtPhase(0), { embers: 5 });
    await openGame();
    expect(screen.getByTestId("lm-ember-button")).toHaveTextContent("5");
    expect(screen.queryByTestId("lm-ember-tip")).not.toBeInTheDocument();
  });

  it("opens the embers dialog and gives focus back when it closes", async () => {
    saveWith(runAtPhase(1), { hasSeenEmberTip: true });
    const { user } = await openGame();
    const button = screen.getByTestId("lm-ember-button");
    await user.click(button);
    const dialog = screen.getByRole("dialog", { name: "Embers" });
    expect(within(dialog).getByTestId("lm-embers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close embers" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(button).toHaveFocus();

    await user.click(button);
    await user.click(screen.getByTestId("lm-ember-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("no longer puts the embers panel inside the menu", async () => {
    saveWith(runAtPhase(1), { hasSeenEmberTip: true });
    const { user } = await openGame();
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.queryByTestId("lm-embers")).not.toBeInTheDocument();
  });
});

describe("the one-time embers explainer", () => {
  it("shows once restart is possible, and Show me opens the dialog", async () => {
    saveWith(runAtPhase(1));
    const { user } = await openGame();
    const tip = screen.getByTestId("lm-ember-tip");
    expect(tip).toHaveTextContent(/keep embers/i);
    await user.click(within(tip).getByRole("button", { name: "Show me" }));
    expect(screen.getByRole("dialog", { name: "Embers" })).toBeInTheDocument();
    expect(screen.queryByTestId("lm-ember-tip")).not.toBeInTheDocument();
  });

  it("stays gone after being dismissed, even after a reload", async () => {
    saveWith(runAtPhase(1));
    const { user, view } = await openGame();
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByTestId("lm-ember-tip")).not.toBeInTheDocument();
    expect(loadSave().save.universes.light.hasSeenEmberTip).toBe(true);

    view.unmount();
    await openGame();
    expect(screen.getByTestId("lm-ember-button")).toBeInTheDocument();
    expect(screen.queryByTestId("lm-ember-tip")).not.toBeInTheDocument();
  });

  it("shows for an old save that has no flag", async () => {
    saveWith(runAtPhase(2));
    const raw = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "{}");
    expect(raw.universes.light).not.toHaveProperty("hasSeenEmberTip");
    await openGame();
    expect(screen.getByTestId("lm-ember-tip")).toBeInTheDocument();
  });

  it("does not come back for the same universe after a restart", async () => {
    saveWith(runAtPhase(1), { hasSeenEmberTip: true });
    const { user } = await openGame();
    await user.click(screen.getByTestId("lm-ember-button"));
    await user.click(screen.getByRole("button", { name: /Restart for/ }));
    await user.click(screen.getByRole("button", { name: "Yes, restart" }));
    expect(screen.queryByRole("dialog", { name: "Embers" })).toBeNull();
    expect(loadSave().save.universes.light.hasSeenEmberTip).toBe(true);
    expect(screen.queryByTestId("lm-ember-tip")).not.toBeInTheDocument();
  });

  it("stays hidden while an intro overlay is up", () => {
    render(
      <GameScreen
        def={lightUniverse}
        universe={{
          run: runAtPhase(1),
          best: null,
          completions: 0,
          embers: 0,
          prestigeUpgrades: {},
        }}
        overlay="phase"
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
    expect(screen.queryByTestId("lm-ember-tip")).not.toBeInTheDocument();
  });
});

describe("the ending screen", () => {
  it("points to the embers earned and playing again", () => {
    render(
      <EndingOverlay lines={["The end."]} embers={12} onContinue={jest.fn()} />
    );
    expect(screen.getByTestId("lm-ending-embers")).toHaveTextContent(
      /12 embers.*play again/i
    );
  });
});

describe("the hub after a restart", () => {
  it("shows the saved embers even though the new run has not started", async () => {
    saveWith(newRun(lightUniverse), { embers: 9 });
    render(<EverOnward />);
    await userEvent.click(await screen.findByTestId("eo-start-button"));
    const facts = await screen.findByTestId("lm-facts-light");
    expect(within(facts).getByText("Embers")).toBeInTheDocument();
    expect(within(facts).getByText("9")).toBeInTheDocument();
  });
});
