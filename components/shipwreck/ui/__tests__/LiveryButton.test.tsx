import { act, fireEvent, render, screen } from "@testing-library/react";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { getShip } from "@/lib/shipwreck/ships";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { funLiveries, realLiveries } from "@/lib/shipwreck/ships/types";
import type { SimRunner } from "@/lib/shipwreck/sim/run";
import type { SimFrame } from "@/lib/shipwreck/sim/track";
import Hud from "../Hud";
import { LIVERY_HELP_MS } from "../LiveryButton";
import TitleScreen from "../TitleScreen";

function frame(t: number): SimFrame {
  return {
    t,
    realT: t,
    bodies: [{ part: "whole", x: 0, y: 0, z: 0, pitch: 0, roll: 0, yaw: 0 }],
    water: [],
    waterAboardT: 0,
    trimDeg: 0,
    listDeg: 0,
    power: 1,
    groundedParts: [],
  };
}
const runner: SimRunner = {
  advance: () => true,
  done: true,
  progress: () => 1,
  track: () => ({
    frames: [0, 600, 1200].map(frame),
    events: [],
    outcome: "sank",
    sankAtT: null,
    brokeAtT: null,
    breakX: null,
    endT: 1200,
  }),
};

function hud(ship: "titanic" | "fitzgerald" | "lusitania" | "carpathia") {
  const store = createPlaybackStore({ createRunner: () => runner });
  const onLivery = jest.fn();
  store.getState().setShip(ship);
  render(<Hud store={store} onBack={() => {}} runId={1} onLivery={onLivery} />);
  return { store, onLivery };
}

describe("the paint tray in the HUD (1.7)", () => {
  it.each(["titanic", "fitzgerald", "lusitania", "carpathia"] as const)(
    "%s: a big brush opens real paints over fun ones, each a little ship",
    (ship) => {
      hud(ship);
      const b = screen.getByTestId("shipwreck-livery");
      // size-16: 64 px, over the 56 px floor.
      expect(b.className).toMatch(/\bsize-16\b/);
      expect(b).toHaveAccessibleName("Paint: change her colours");
      expect(screen.queryByTestId("shipwreck-paint-tray")).toBeNull();
      fireEvent.click(b);
      const spec = getShip(ship);
      const ids = (row: string) =>
        [
          ...screen
            .getByTestId(`shipwreck-paint-${row}`)
            .querySelectorAll("[data-livery]"),
        ].map((e) => e.getAttribute("data-livery"));
      expect(ids("real")).toEqual(realLiveries(spec).map((l) => l.id));
      expect(ids("fun")).toEqual(funLiveries(spec).map((l) => l.id));
      expect(ids("fun").length).toBeGreaterThanOrEqual(5);
      // Every paint: 56 px, named, its own colours on a little ship.
      for (const p of screen.getAllByTestId("shipwreck-paint")) {
        expect(p.className).toMatch(/\bsize-14\b/);
        const l = spec.liveries!.find((x) => x.id === p.dataset.livery)!;
        expect(p).toHaveAccessibleName(`Paint: ${l.label}`);
        expect(p.querySelector("[data-hull]")).toHaveAttribute(
          "fill",
          `#${l.look.hull.toString(16).padStart(6, "0")}`
        );
      }
      // Her paint now is the one pressed.
      const pressed = screen
        .getAllByTestId("shipwreck-paint")
        .filter((p) => p.getAttribute("aria-pressed") === "true");
      expect(pressed.map((p) => p.dataset.livery)).toEqual([
        realLiveries(spec).find((l) => l.default)!.id,
      ]);
      // The brush or the cross closes it.
      fireEvent.click(screen.getByTestId("shipwreck-paint-close"));
      expect(screen.queryByTestId("shipwreck-paint-tray")).toBeNull();
      fireEvent.click(b);
      fireEvent.click(b);
      expect(screen.queryByTestId("shipwreck-paint-tray")).toBeNull();
    }
  );

  it("paints her live, says what each is, and stays open to compare", () => {
    jest.useFakeTimers();
    const { store, onLivery } = hud("lusitania");
    act(() => {
      store.getState().start(lusitania, lusitania.realNight);
      store.getState().pump();
      store.getState().play();
      store.getState().tick(30, 0);
    });
    const before = store.getState();
    fireEvent.click(screen.getByTestId("shipwreck-livery"));
    const paint = (id: string) =>
      screen
        .getAllByTestId("shipwreck-paint")
        .find((p) => p.dataset.livery === id)!;

    fireEvent.click(paint("cunard-1907"));
    const after = store.getState();
    expect(after.livery).toBe("cunard-1907");
    expect(onLivery).toHaveBeenLastCalledWith("cunard-1907");
    expect(after.t).toBe(before.t);
    expect(after.playing).toBe(true);
    expect(after.track).toBe(before.track);
    expect(screen.getByTestId("shipwreck-livery-help")).toHaveTextContent(
      "Her first Cunard colours, 1907"
    );
    expect(paint("cunard-1907")).toHaveAttribute("aria-pressed", "true");
    expect(paint("war-1915")).toHaveAttribute("aria-pressed", "false");

    // A fun one: still open, its words say it is just for fun.
    fireEvent.click(paint("fun-blue-funnel"));
    expect(store.getState().livery).toBe("fun-blue-funnel");
    expect(screen.getByTestId("shipwreck-paint-tray")).toBeTruthy();
    expect(screen.getByTestId("shipwreck-livery-help")).toHaveTextContent(
      /Just for fun/
    );
    act(() => jest.advanceTimersByTime(LIVERY_HELP_MS + 10));
    expect(screen.queryByTestId("shipwreck-livery-help")).toBeNull();
    jest.useRealTimers();
  });
});

describe("the paint brush on the title", () => {
  it("is beside the choices for every ship, and paints her", () => {
    const onLivery = jest.fn();
    const { rerender } = render(
      <TitleScreen
        ship="carpathia"
        onShip={() => {}}
        onRealNight={() => {}}
        onWhatIf={() => {}}
        livery={null}
        onLivery={onLivery}
      />
    );
    fireEvent.click(screen.getByTestId("shipwreck-livery"));
    fireEvent.click(
      screen
        .getAllByTestId("shipwreck-paint")
        .find((p) => p.dataset.livery === "cunard-1912")!
    );
    expect(onLivery).toHaveBeenCalledWith("cunard-1912");
    // Her picture's funnel follows her paint.
    rerender(
      <TitleScreen
        ship="carpathia"
        onShip={() => {}}
        onRealNight={() => {}}
        onWhatIf={() => {}}
        livery="cunard-1912"
        onLivery={onLivery}
      />
    );
    const funnel = () =>
      screen
        .getByTestId("shipwreck-ship-picture-carpathia")
        .querySelector("[data-funnel]");
    expect(funnel()).toHaveAttribute("fill", "#cc5a28");
    // The Titanic has paints now too: a fun one shows on her picture.
    rerender(
      <TitleScreen
        ship="titanic"
        onShip={() => {}}
        onRealNight={() => {}}
        onWhatIf={() => {}}
        livery="fun-blue-funnel"
        onLivery={onLivery}
      />
    );
    expect(screen.getByTestId("shipwreck-livery")).toBeTruthy();
  });
});
