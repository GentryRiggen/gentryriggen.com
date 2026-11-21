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
});
