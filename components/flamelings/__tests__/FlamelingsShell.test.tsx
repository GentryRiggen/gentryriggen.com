import { act, fireEvent, render, screen } from "@testing-library/react";
import { reloadPage } from "@/lib/update/reloadPage";
import { resetClock, setNow } from "@/lib/flamelings/clock";
import { useFlamelings } from "@/lib/flamelings/store";
import Flamelings from "../Flamelings";
import FireflyCatch from "../FireflyCatch";

jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));
jest.mock("@/lib/update/reloadPage", () => ({ reloadPage: jest.fn() }));
const mockUpdate = jest.fn();
jest.mock("@/components/update/useUpdateCheck", () => ({
  useUpdateCheck: () => mockUpdate(),
}));

const NOON = new Date(2026, 10, 17, 12).getTime();

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOON, advanceTimers: true });
  window.localStorage.clear();
  resetClock();
  setNow(NOON);
  useFlamelings.setState(useFlamelings.getInitialState(), true);
  mockUpdate.mockReturnValue({ isUpdateReady: false });
});
afterEach(() => {
  setVisibility("visible");
  jest.useRealTimers();
  resetClock();
});

describe("the game shell", () => {
  it("fills the screen like a home-screen game", () => {
    render(<Flamelings />);
    expect(screen.getByTestId("flamelings-root")).toHaveClass(
      "h-[100dvh]",
      "overscroll-none",
      "select-none"
    );
  });

  it("offers an update pill that saves and reloads on tap", () => {
    mockUpdate.mockReturnValue({ isUpdateReady: true });
    render(<Flamelings />);
    fireEvent.click(screen.getByTestId("flamelings-update"));
    expect(reloadPage).toHaveBeenCalled();
  });

  it("says plainly that nothing is saving when the save is from a newer build", () => {
    window.localStorage.setItem(
      "flamelings:v1",
      JSON.stringify({
        v: 1,
        schema: 999,
        pets: [],
        memorial: [],
        collection: [],
        updatedAt: NOON,
      })
    );
    render(<Flamelings />);
    const banner = screen.getByTestId("flamelings-unsaved");
    expect(banner).toHaveTextContent(/not saving/i);
    fireEvent.click(banner.querySelector("button")!);
    expect(reloadPage).toHaveBeenCalled();
  });

  it("shows no update pill when the build is current", () => {
    render(<Flamelings />);
    expect(screen.queryByTestId("flamelings-update")).toBeNull();
  });

  it("stops its two timers while hidden, and restarts them when back", () => {
    render(<Flamelings />);
    const running = jest.getTimerCount();
    act(() => setVisibility("hidden"));
    expect(jest.getTimerCount()).toBe(running - 2);
    act(() => setVisibility("visible"));
    expect(jest.getTimerCount()).toBe(running);
  });
});

describe("Firefly Catch and the page hiding", () => {
  it("does not lose time while the page is hidden", () => {
    render(<FireflyCatch onDone={jest.fn()} />);
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    act(() => setVisibility("hidden"));
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    act(() => setVisibility("visible"));
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByRole("timer")).toHaveAccessibleName(
      /1[4-5] seconds left/
    );
  });
});
