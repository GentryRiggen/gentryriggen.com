import { act, fireEvent, render, screen } from "@testing-library/react";
import LaunchOverlay from "../LaunchOverlay";
import { newProgress } from "@/lib/plane-builder/economy/progress";
import {
  GAUGE_PERIOD,
  LAUNCH_ZONE_BOOST,
} from "@/lib/plane-builder/minigame/gauge";
import { flightToasts } from "@/lib/plane-builder/state/flightToasts";
import { launchAim } from "@/lib/plane-builder/state/launchAim";
import { usePlaneBuilderStore as store } from "@/lib/plane-builder/state/store";
import { stubFrames } from "../../testing/frames";

const beginFlight = jest.fn();

function setLauncherTier(tier: number) {
  const progress = newProgress();
  progress.levels.meadow.tiers.launcher = tier;
  store.setState({ progress, levelId: "meadow", beginFlight });
}

beforeEach(() => {
  store.setState(store.getInitialState(), true);
  beginFlight.mockClear();
});

afterEach(() => jest.restoreAllMocks());

describe("LaunchOverlay", () => {
  it("has no gauge below the gauge tier", () => {
    const frames = stubFrames();
    setLauncherTier(2);
    render(<LaunchOverlay />);
    fireEvent.keyDown(window, { key: " " });
    act(() => frames.at(100));
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.queryByText(/in the green/)).not.toBeInTheDocument();
    fireEvent.keyUp(window, { key: " " });
    expect(beginFlight).toHaveBeenCalledTimes(1);
    expect(beginFlight.mock.calls[0][0].boost).toBeUndefined();
  });

  it("shows the gauge while pulling at the gauge tier and fires with a boost", () => {
    const frames = stubFrames();
    setLauncherTier(3);
    const toast = jest.spyOn(flightToasts, "push");
    render(<LaunchOverlay />);
    expect(screen.getByText(/Let go in the green/)).toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByRole("meter", { name: "Launch timing" })).toBeVisible();
    expect(launchAim.power).toBe(1);

    act(() => frames.at(GAUGE_PERIOD * 250));
    fireEvent.keyUp(window, { key: " " });

    expect(beginFlight).toHaveBeenCalledTimes(1);
    expect(beginFlight.mock.calls[0][0]).toMatchObject({
      power: 1,
      boost: LAUNCH_ZONE_BOOST.green,
    });
    expect(toast).toHaveBeenCalledWith("Perfect launch! +25% speed 🚀");
    // Pushed after the flight starts, which clears earlier pop-ups.
    expect(toast.mock.invocationCallOrder[0]).toBeGreaterThan(
      beginFlight.mock.invocationCallOrder[0]
    );
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });

  it("gives the red boost at the ends of the gauge", () => {
    const frames = stubFrames();
    setLauncherTier(4);
    const toast = jest.spyOn(flightToasts, "push");
    render(<LaunchOverlay />);
    fireEvent.keyDown(window, { key: " " });
    act(() => frames.at(GAUGE_PERIOD * 500));
    fireEvent.keyUp(window, { key: " " });
    expect(beginFlight.mock.calls[0][0].boost).toBe(LAUNCH_ZONE_BOOST.red);
    expect(toast).toHaveBeenCalledWith("Oops! Weak launch 😬");
  });
});
