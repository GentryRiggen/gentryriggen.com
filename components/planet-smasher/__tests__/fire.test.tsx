import { act, render, screen } from "@testing-library/react";
import PlanetSmasher from "../PlanetSmasher";
import useWebGLSupport from "@/components/ship-builder/hooks/useWebGLSupport";
import { useGameStore } from "@/lib/planet-smasher/store";
import { resetCooldowns } from "@/lib/planet-smasher/cooldown";

interface StageLike {
  effects: unknown[];
  onFire(u: number, v: number): void;
  onHoldStart(u: number, v: number, point: [number, number, number]): void;
}
let stage: StageLike | null = null;

jest.mock(
  "next/dynamic",
  () => () =>
    function Stage(props: StageLike) {
      stage = props;
      return <div data-testid="planet-stage" />;
    }
);
jest.mock("@/components/ship-builder/hooks/useWebGLSupport", () => jest.fn());
jest.mock("../scene/planetTextures", () => ({
  loadPlanetTextures: () =>
    Promise.resolve({
      id: "earth",
      day: document.createElement("canvas"),
      night: null,
      population: { w: 2, h: 1, weights: new Float32Array([0.5, 0.5]) },
    }),
}));

describe("PlanetSmasher fire path", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetCooldowns();
    (useWebGLSupport as jest.Mock).mockReturnValue(true);
  });

  it("never fires a locked tool, but fires an unlocked one", async () => {
    render(<PlanetSmasher />);
    await screen.findByTestId("planet-stage");
    // Force a locked selection past the store's own guard.
    act(() => {
      useGameStore.setState({
        progress: { ...useGameStore.getState().progress, toolId: "nuke" },
      });
    });
    act(() => stage!.onFire(0.5, 0.5));
    expect(stage!.effects).toHaveLength(0);

    act(() => {
      useGameStore.setState({
        progress: { ...useGameStore.getState().progress, toolId: "asteroid" },
      });
    });
    act(() => stage!.onFire(0.5, 0.5));
    expect(stage!.effects).toHaveLength(1);
  });

  it("does not start the laser once the planet has ended", async () => {
    render(<PlanetSmasher />);
    await screen.findByTestId("planet-stage");
    act(() => {
      useGameStore.setState({
        progress: {
          ...useGameStore.getState().progress,
          points: 5200,
          toolId: "alienLaser",
        },
      });
    });
    act(() => useGameStore.setState({ phase: "ended" }));
    act(() => stage!.onHoldStart(0.5, 0.5, [0, 0, 1]));
    expect(stage!.effects).toHaveLength(0);

    act(() => useGameStore.setState({ phase: "playing" }));
    act(() => stage!.onHoldStart(0.5, 0.5, [0, 0, 1]));
    expect(stage!.effects).toHaveLength(1);
  });
});
