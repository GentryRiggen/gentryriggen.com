import { act, render, screen } from "@testing-library/react";
import { createPlaybackStore } from "@/lib/shipwreck/playback";
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
});
