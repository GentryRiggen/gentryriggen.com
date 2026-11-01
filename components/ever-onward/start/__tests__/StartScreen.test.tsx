import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SEASONS } from "@/lib/ever-onward/season";
import {
  WEATHER_CACHE_KEY,
  WEATHER_TOGGLE_KEY,
} from "@/lib/ever-onward/weather";
import StartScreen from "../StartScreen";

const autumn = SEASONS[0];

describe("StartScreen", () => {
  it("offers START to a new player", () => {
    render(<StartScreen hasSave={false} startedIds={[]} onStart={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Ever Onward" })
    ).toBeInTheDocument();
  });

  it("offers CONTINUE when a game exists, and lights its universe", () => {
    render(<StartScreen hasSave startedIds={["light"]} onStart={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: "Continue" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Keep the Light On, lit/)).toBeInTheDocument();
  });

  it("starts once on click, Enter or Space", async () => {
    const user = userEvent.setup();
    const onStart = jest.fn();
    const { unmount } = render(
      <StartScreen hasSave={false} startedIds={[]} onStart={onStart} />
    );
    await user.keyboard("{Enter}");
    expect(onStart).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(onStart).toHaveBeenCalledTimes(1);
    unmount();

    const again = jest.fn();
    render(<StartScreen hasSave={false} startedIds={[]} onStart={again} />);
    await user.keyboard(" ");
    expect(again).toHaveBeenCalledTimes(1);
  });

  it("starts once when the focused button is activated by keyboard", async () => {
    const user = userEvent.setup();
    const onStart = jest.fn();
    render(<StartScreen hasSave={false} startedIds={[]} onStart={onStart} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("starts when tapping the background but not the footer links", async () => {
    const user = userEvent.setup();
    const onStart = jest.fn();
    render(<StartScreen hasSave={false} startedIds={[]} onStart={onStart} />);
    await user.click(screen.getByRole("link", { name: /what's new/ }));
    expect(onStart).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("eo-start"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("dresses the robot for the season", () => {
    render(
      <StartScreen
        hasSave={false}
        startedIds={[]}
        onStart={jest.fn()}
        season={autumn}
      />
    );
    expect(screen.getByTestId("eo-robot")).toHaveAttribute(
      "data-season",
      "autumn"
    );
  });

  describe("sky and weather", () => {
    const originalGeolocation = Object.getOwnPropertyDescriptor(
      navigator,
      "geolocation"
    );

    beforeEach(() => window.localStorage.clear());
    afterEach(() => {
      jest.useRealTimers();
      if (originalGeolocation) {
        Object.defineProperty(navigator, "geolocation", originalGeolocation);
      } else {
        Reflect.deleteProperty(navigator, "geolocation");
      }
    });

    function stubGeolocation(getCurrentPosition: jest.Mock) {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: { getCurrentPosition },
      });
    }

    it("shows clear skies and never asks for a position by default", () => {
      const getCurrentPosition = jest.fn();
      stubGeolocation(getCurrentPosition);
      render(
        <StartScreen hasSave={false} startedIds={[]} onStart={jest.fn()} />
      );
      expect(screen.getByTestId("eo-weather")).toHaveAttribute(
        "data-weather",
        "clear"
      );
      expect(screen.getByTestId("eo-weather-toggle")).toHaveAttribute(
        "aria-pressed",
        "false"
      );
      expect(getCurrentPosition).not.toHaveBeenCalled();
    });

    it("renders START immediately while the weather is still loading", () => {
      stubGeolocation(jest.fn()); // never answers
      window.localStorage.setItem(WEATHER_TOGGLE_KEY, "1");
      render(
        <StartScreen hasSave={false} startedIds={[]} onStart={jest.fn()} />
      );
      expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
      expect(screen.getByTestId("eo-weather")).toHaveAttribute(
        "data-weather",
        "clear"
      );
    });

    it("toggling on asks once, persists, and tapping it does not start", async () => {
      const user = userEvent.setup();
      const onStart = jest.fn();
      const getCurrentPosition = jest.fn(
        (_ok: PositionCallback, fail?: PositionErrorCallback | null) =>
          fail?.({ code: 1 } as GeolocationPositionError)
      );
      stubGeolocation(getCurrentPosition);
      render(<StartScreen hasSave={false} startedIds={[]} onStart={onStart} />);
      await user.click(screen.getByTestId("eo-weather-toggle"));
      expect(onStart).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(WEATHER_TOGGLE_KEY)).toBe("1");
      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
      // Denied: still clear skies.
      expect(screen.getByTestId("eo-weather")).toHaveAttribute(
        "data-weather",
        "clear"
      );
    });

    it("turning it off clears the cache and the weather", async () => {
      const user = userEvent.setup();
      stubGeolocation(jest.fn());
      window.localStorage.setItem(WEATHER_TOGGLE_KEY, "1");
      window.localStorage.setItem(
        WEATHER_CACHE_KEY,
        JSON.stringify({
          weather: { kind: "snow", heat: "cold" },
          at: Date.now(),
        })
      );
      render(
        <StartScreen hasSave={false} startedIds={[]} onStart={jest.fn()} />
      );
      expect(screen.getByTestId("eo-weather")).toHaveAttribute(
        "data-weather",
        "snow"
      );
      await user.click(screen.getByTestId("eo-weather-toggle"));
      expect(window.localStorage.getItem(WEATHER_CACHE_KEY)).toBeNull();
      expect(window.localStorage.getItem(WEATHER_TOGGLE_KEY)).toBeNull();
      expect(screen.getByTestId("eo-weather")).toHaveAttribute(
        "data-weather",
        "clear"
      );
    });

    it("follows the clock and rechecks each minute", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 2, 15, 12, 59, 30));
      render(
        <StartScreen hasSave={false} startedIds={[]} onStart={jest.fn()} />
      );
      expect(screen.getByTestId("eo-sky")).toHaveAttribute("data-phase", "day");
      jest.setSystemTime(new Date(2026, 2, 15, 22, 0, 0));
      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      expect(screen.getByTestId("eo-sky")).toHaveAttribute(
        "data-phase",
        "night"
      );
    });
  });
});
