import { fireEvent, render, screen } from "@testing-library/react";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { newUniverseSave } from "@/lib/ever-onward/engine/prestige";
import { newSave } from "@/lib/ever-onward/engine/save";
import type { UniverseSave } from "@/lib/ever-onward/engine/types";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import GameScreen from "../../GameScreen";

class QuietObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation();
  window.IntersectionObserver =
    QuietObserver as unknown as typeof IntersectionObserver;
});

function renderGame(universe: UniverseSave) {
  const onStep = jest.fn();
  render(
    <GameScreen
      def={def}
      universe={universe}
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
      onStep={onStep}
      onToggleArtifact={jest.fn()}
      onLeave={jest.fn()}
      onDismissOverlay={jest.fn()}
      currentSave={newSave()}
      onReplaceSave={jest.fn()}
    />
  );
  return { onStep };
}

describe("the map in Keep the Light On", () => {
  it("has a Map button and no embers button, even mid-run with embers", () => {
    renderGame({
      ...newUniverseSave(def),
      embers: 7,
      run: { ...newRun(def), phase: 1, time: 5, taps: 1 },
    });
    expect(screen.queryByTestId("lm-ember-button")).toBeNull();
    expect(screen.queryByTestId("lm-ember-tip")).toBeNull();
    fireEvent.click(screen.getByTestId("eo-map-button"));
    expect(screen.getByTestId("eo-map-dialog").dataset.mode).toBe("view");
  });

  it("a finished run opens the map to choose, and stepping closes it", () => {
    const { onStep } = renderGame({
      ...newUniverseSave(def),
      run: { ...newRun(def), complete: true, time: 4000 },
    });
    expect(screen.getByTestId("eo-map-dialog").dataset.mode).toBe("choose");
    expect(screen.queryByTestId("lm-embers")).toBeNull();
    fireEvent.click(screen.getByTestId("eo-map-square-1,0"));
    fireEvent.click(screen.getByTestId("eo-map-go"));
    expect(onStep).toHaveBeenCalledWith("1,0");
    expect(screen.queryByTestId("eo-map-dialog")).toBeNull();
    fireEvent.click(screen.getByTestId("eo-map-open-choose"));
    expect(screen.getByTestId("eo-map-dialog").dataset.mode).toBe("choose");
  });
});
