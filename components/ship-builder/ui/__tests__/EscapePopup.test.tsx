import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ESCAPE_POPUPS } from "@/lib/ship-builder/escapeCopy";
import {
  publishEscape,
  resetEscape,
} from "@/lib/ship-builder/state/escapeLive";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { trialPlayback } from "../../scene/trialPlayback";
import EscapePopup from "../EscapePopup";

jest.mock("../../scene/trialTimeline", () => ({
  activeEvacuation: () => ({
    launches: [{ boatId: "b", kind: "davit", at: 10, departs: 10 }],
  }),
}));

const swimmer = { x: 0, z: 0, yaw: 0, warmth: 1, kick: 0 };
const publish = (phase: Parameters<typeof publishEscape>[0]["phase"]) =>
  act(() => publishEscape({ phase, boardable: null, pickup: null }));

beforeEach(() => {
  jest.useFakeTimers();
  trialPlayback.time = 0;
  act(() => {
    resetEscape();
    useShipBuilderStore.setState(createInitialState());
  });
});
afterEach(() => jest.useRealTimers());

describe("EscapePopup", () => {
  it("shows nothing aboard", () => {
    render(<EscapePopup />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the splash card, then closes itself after 4 s", () => {
    const onShow = jest.fn();
    render(<EscapePopup onShow={onShow} />);
    publish({ kind: "swimming", since: 1, swimmer, warned: false });
    expect(screen.getByText(ESCAPE_POPUPS.splash.title)).toBeTruthy();
    expect(screen.getByText(ESCAPE_POPUPS.splash.body)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Swim!" })).toBeTruthy();
    expect(onShow).toHaveBeenCalledWith("splash");
    act(() => jest.advanceTimersByTime(4100));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the frozen card and the swim rescue at once", () => {
    render(<EscapePopup />);
    publish({ kind: "frozen", since: 2, x: 0, z: 0 });
    expect(screen.getByText(ESCAPE_POPUPS.frozen.title)).toBeTruthy();
    publish({ kind: "in-boat", boatId: "b", since: 3, fromWater: true });
    expect(screen.getByText(ESCAPE_POPUPS["saved-swim"].title)).toBeTruthy();
  });

  it("holds the deck card until the boat is out", () => {
    render(<EscapePopup />);
    publish({ kind: "in-boat", boatId: "b", since: 9, fromWater: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    trialPlayback.time = 10 + 6 + 5;
    act(() => jest.advanceTimersByTime(200));
    expect(screen.getByText(ESCAPE_POPUPS["saved-deck"].title)).toBeTruthy();
    expect(screen.getByText(ESCAPE_POPUPS["saved-deck"].body)).toBeTruthy();
  });

  it("closes on Keep watching and does not return for the same phase", async () => {
    jest.useRealTimers();
    render(<EscapePopup />);
    publish({ kind: "frozen", since: 2, x: 0, z: 0 });
    await userEvent.click(
      screen.getByRole("button", { name: "Keep watching" })
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stops walking on See how she did", async () => {
    jest.useRealTimers();
    const stopWalk = jest.fn();
    act(() => useShipBuilderStore.setState({ stopWalk }));
    render(<EscapePopup />);
    publish({ kind: "frozen", since: 2, x: 0, z: 0 });
    await userEvent.click(
      screen.getByRole("button", { name: "See how she did" })
    );
    expect(stopWalk).toHaveBeenCalled();
  });
});
