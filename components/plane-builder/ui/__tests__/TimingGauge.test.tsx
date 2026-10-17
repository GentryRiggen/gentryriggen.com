import { act, render, screen } from "@testing-library/react";
import TimingGauge from "../TimingGauge";
import { stubFrames } from "../../testing/frames";
import { GAUGE_PERIOD } from "@/lib/plane-builder/minigame/gauge";

afterEach(() => jest.restoreAllMocks());

describe("TimingGauge", () => {
  it("renders the zones and a labelled meter", () => {
    stubFrames();
    render(
      <TimingGauge
        isRunning
        positionRef={{ current: 0 }}
        ariaLabel="Coin bonus timing"
      />
    );
    expect(
      screen.getByRole("meter", { name: "Coin bonus timing" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("gauge-zone-yellow")).toBeInTheDocument();
    expect(screen.getByTestId("gauge-zone-green")).toBeInTheDocument();
    expect(screen.getByTestId("gauge-marker")).toBeInTheDocument();
  });

  it("writes the marker position and names the zone", () => {
    const frames = stubFrames();
    const positionRef = { current: 0.9 };
    render(<TimingGauge isRunning positionRef={positionRef} ariaLabel="t" />);
    expect(positionRef.current).toBe(0);

    act(() => frames.at(GAUGE_PERIOD * 250));
    expect(positionRef.current).toBeCloseTo(0.5);
    expect(screen.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      "green zone"
    );
    expect(screen.getByTestId("gauge-marker").style.left).toBe("50%");

    act(() => frames.at(250));
    expect(screen.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      "yellow zone"
    );
  });

  it("stops moving when it is no longer running", () => {
    const frames = stubFrames();
    const positionRef = { current: 0 };
    const { rerender } = render(
      <TimingGauge isRunning positionRef={positionRef} ariaLabel="t" />
    );
    act(() => frames.at(GAUGE_PERIOD * 250));
    rerender(
      <TimingGauge isRunning={false} positionRef={positionRef} ariaLabel="t" />
    );
    act(() => frames.at(GAUGE_PERIOD * 500));
    expect(positionRef.current).toBeCloseTo(0.5);
  });
});
