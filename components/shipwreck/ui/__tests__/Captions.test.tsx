import { act, render, screen } from "@testing-library/react";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { carpathia } from "@/lib/shipwreck/ships/carpathia";
import { torpedoHits, whatIfRealIds } from "@/lib/shipwreck/sim/run";
import Captions from "../Captions";

describe("Captions", () => {
  it("opens with the collision at the start of a run", () => {
    render(<Captions store={createPlaybackStore()} />);
    expect(screen.getByTestId("shipwreck-caption").textContent).toMatch(
      /iceberg/i
    );
  });

  it("shows no stale caption when mounted late in the night", () => {
    const store = createPlaybackStore();
    act(() => store.setState({ t: 2 * 3600 + 35 * 60 }));
    render(<Captions store={store} />);
    expect(screen.queryByTestId("shipwreck-caption")).toBeNull();
  });

  it("opens a torpedo's run-in with the torpedo coming, then the hit at 2:10", () => {
    const store = createPlaybackStore();
    act(() => store.setState({ ship: "lusitania", t: -40, minT: -40 }));
    render(<Captions store={store} />);
    expect(screen.getByTestId("shipwreck-caption").textContent).toMatch(
      /^2:09 PM — A torpedo is coming/
    );
    const track = {
      frames: [],
      events: [{ kind: "collision" as const, t: 0, realT: 0 }],
      outcome: "sank" as const,
      sankAtT: null,
      brokeAtT: null,
      breakX: null,
      endT: 100,
    };
    act(() => store.setState({ track, t: -0.5 }));
    act(() => store.setState({ t: 0.5 }));
    expect(screen.getByTestId("shipwreck-caption").textContent).toMatch(
      /^2:10 PM — A torpedo hits the starboard side/
    );
  });

  it("runs the Carpathia's two 9:15 AM torpedoes in, not her 10:50 one", () => {
    const store = createPlaybackStore();
    const torpedoes = torpedoHits(carpathia, whatIfRealIds(carpathia));
    act(() =>
      store.getState().start(carpathia, carpathia.realNight, { torpedoes })
    );
    expect(store.getState().t).toBe(-40);
    render(<Captions store={store} />);
    expect(screen.getByTestId("shipwreck-caption").textContent).toMatch(
      /^9:14 AM — Two torpedoes are coming!.*port side/
    );
  });

  it("says how many torpedoes are coming and hit (a What if, 1.3)", () => {
    const store = createPlaybackStore();
    act(() =>
      store.setState({ ship: "lusitania", t: -40, minT: -40, hits: [1, 2] })
    );
    render(<Captions store={store} />);
    expect(screen.getByTestId("shipwreck-caption").textContent).toMatch(
      /^2:09 PM — Two torpedoes are coming!/
    );
    const track = {
      frames: [],
      events: [{ kind: "collision" as const, t: 0, realT: 0 }],
      outcome: "sank" as const,
      sankAtT: null,
      brokeAtT: null,
      breakX: null,
      endT: 100,
    };
    act(() => store.setState({ track, t: -0.5 }));
    act(() => store.setState({ t: 0.5 }));
    expect(screen.getByTestId("shipwreck-caption").textContent).toBe(
      "2:10 PM — Two torpedoes hit the starboard side. Water rushes in."
    );
  });

  it("captions only the first of the Fitzgerald's hatch covers to go", () => {
    const store = createPlaybackStore();
    const ev = (t: number, index: number) => ({
      kind: "hatch-fails" as const,
      t,
      realT: t,
      index,
    });
    const track = {
      frames: [],
      events: [ev(100, 15), ev(101, 16), ev(110, 3)],
      outcome: "sank" as const,
      sankAtT: null,
      brokeAtT: null,
      breakX: null,
      endT: 200,
    };
    act(() => store.setState({ ship: "fitzgerald", t: 99.5, track }));
    render(<Captions store={store} />);
    act(() => store.setState({ t: 100.5 }));
    expect(screen.getByTestId("shipwreck-caption").textContent).toMatch(
      /A hatch cover gives way/
    );
    const first = screen.getByTestId("shipwreck-caption").textContent;
    act(() => store.setState({ t: 111 }));
    // The later covers add no caption of their own.
    expect(screen.getByTestId("shipwreck-caption").textContent).toBe(first);
  });

  it("shows the run-in again whenever time goes back before the hit", () => {
    const store = createPlaybackStore();
    act(() => store.setState({ ship: "lusitania", t: 600, minT: -40 }));
    render(<Captions store={store} />);
    expect(screen.queryByTestId("shipwreck-caption")).toBeNull();
    // Replay from the end, or scrub back into the run-in.
    act(() => store.setState({ t: -40 }));
    expect(screen.getByTestId("shipwreck-caption").textContent).toMatch(
      /^2:09 PM — A torpedo is coming/
    );
    // Not for the Titanic (no run-in).
    const night = createPlaybackStore();
    act(() => night.setState({ t: 600 }));
    render(<Captions store={night} />);
    act(() => night.setState({ t: -1 }));
    expect(screen.getAllByTestId("shipwreck-caption")).toHaveLength(1);
  });

  describe("after a seek", () => {
    const track = {
      frames: [],
      events: [
        { kind: "collision" as const, t: 0, realT: 0 },
        { kind: "lights-out" as const, t: 1000, realT: 1000 },
      ],
      outcome: "sank" as const,
      sankAtT: null,
      brokeAtT: null,
      breakX: null,
      endT: 3000,
    };
    const caption = () =>
      screen.queryByTestId("shipwreck-caption")?.textContent ?? null;

    it("shows the earlier event after a backward seek, never the later one", () => {
      const store = createPlaybackStore();
      act(() => store.setState({ track, t: 999 }));
      render(<Captions store={store} />);
      act(() => store.setState({ t: 1001 }));
      expect(caption()).toMatch(/lights/i);
      // Back to just after the collision.
      act(() => store.setState({ t: 5 }));
      expect(caption()).toMatch(/iceberg/i);
      expect(caption()).not.toMatch(/lights/i);
    });

    it("shows nothing after a seek back to a quiet moment", () => {
      const store = createPlaybackStore();
      act(() => store.setState({ track, t: 999 }));
      render(<Captions store={store} />);
      act(() => store.setState({ t: 1001 }));
      expect(caption()).not.toBeNull();
      act(() => store.setState({ t: 500 }));
      expect(caption()).toBeNull();
    });

    it("shows the latest recent event after a long forward jump", () => {
      const store = createPlaybackStore();
      act(() => store.setState({ track, t: 5 }));
      render(<Captions store={store} />);
      act(() => store.setState({ t: 1010 }));
      expect(caption()).toMatch(/lights/i);
      act(() => store.setState({ t: 2500 }));
      expect(caption()).toBeNull();
    });
  });
});
