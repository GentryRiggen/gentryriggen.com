import { act, render, screen } from "@testing-library/react";
import { newSave } from "@/lib/ever-onward/engine/save";
import { newRun } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import GameScreen from "../GameScreen";

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

let callbacks: ObserverCallback[] = [];

class MockIntersectionObserver {
  constructor(callback: ObserverCallback) {
    callbacks.push(callback);
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

function setIntersecting(isIntersecting: boolean) {
  act(() => {
    callbacks.forEach((cb) => cb([{ isIntersecting }]));
  });
}

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
      onBuyEmber={jest.fn()}
      onRestart={jest.fn()}
      onLeave={jest.fn()}
      onDismissOverlay={jest.fn()}
      currentSave={newSave()}
      onReplaceSave={jest.fn()}
    />
  );
  return onTap;
}

describe("sticky HUD", () => {
  beforeEach(() => {
    callbacks = [];
    window.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  it("is hidden while the main readout is on screen", () => {
    const run = { ...newRun(lightUniverse), taps: 1, time: 5 };
    renderScreen(run);
    setIntersecting(true);
    expect(screen.getByTestId("lm-hud")).toHaveAttribute("aria-hidden", "true");
  });

  it("slides in with the currency once the readout leaves", () => {
    const run = { ...newRun(lightUniverse), taps: 1, time: 5 };
    run.resources.coins = 1234;
    renderScreen(run);
    setIntersecting(false);

    const hud = screen.getByTestId("lm-hud");
    expect(hud).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByTestId("lm-hud-value")).toHaveTextContent("1.23K");
    expect(screen.getByTestId("lm-hud-rate")).toHaveTextContent("/s");
  });

  it("keeps the one tap button reachable at all times", () => {
    const run = { ...newRun(lightUniverse), taps: 1, time: 5 };
    const onTap = renderScreen(run);
    setIntersecting(false);
    expect(screen.queryByTestId("lm-hud-tap")).toBeNull();
    screen.getByRole("button", { name: "Flash the light" }).click();
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("shows how far along the next upgrade is", () => {
    const run = { ...newRun(lightUniverse), taps: 1, time: 5 };
    run.revealed = lightUniverse.upgrades
      .filter((u) => !u.phases || u.phases.includes("coast"))
      .map((u) => u.id);
    renderScreen(run);
    setIntersecting(false);
    expect(screen.getByTestId("lm-hud-next")).toHaveAccessibleName(
      /Next goal: .*0%/
    );
  });
});
