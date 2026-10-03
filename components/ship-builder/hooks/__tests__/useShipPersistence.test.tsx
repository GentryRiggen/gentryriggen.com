import { act } from "react";
import { render } from "@testing-library/react";
import useShipPersistence, { AUTOSAVE_DELAY_MS } from "../useShipPersistence";
import { AUTOSAVE_KEY, saveAutosave } from "@/lib/ship-builder/persist/local";
import { encodeShip } from "@/lib/ship-builder/persist/share";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { gridPart, testShip } from "@/lib/ship-builder/testing";

function Harness() {
  useShipPersistence();
  return null;
}

const store = () => useShipBuilderStore.getState();
const shared = testShip([gridPart("a", "deck-1x1", 0, 0, 0)], 6);

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  window.history.replaceState(null, "", "/ship-builder");
  act(() => useShipBuilderStore.setState(createInitialState()));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("useShipPersistence", () => {
  it("loads a shared ship from the hash and clears it", () => {
    window.history.replaceState(
      null,
      "",
      `/ship-builder#ship=${encodeShip(shared)}`
    );
    render(<Harness />);
    expect(store().ship).toEqual(shared);
    expect(store().savedId).toBeNull();
    expect(window.location.hash).toBe("");
  });

  it("shows a notice for an invalid hash and keeps a fresh hull", () => {
    saveAutosave(shared, null);
    window.history.replaceState(null, "", "/ship-builder#ship=garbage");
    render(<Harness />);
    expect(store().notice).toBe("Couldn't load that ship");
    expect(store().ship.parts).toHaveLength(0);
  });

  it("restores the autosave when there is no hash", () => {
    saveAutosave(shared, "ship-3");
    render(<Harness />);
    expect(store().ship).toEqual(shared);
    expect(store().savedId).toBe("ship-3");
  });

  it("autosaves after changes, debounced", () => {
    render(<Harness />);
    act(() => store().rename("Britannic"));
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull();
    act(() => jest.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(JSON.parse(localStorage.getItem(AUTOSAVE_KEY)!).ship.name).toBe(
      "Britannic"
    );
  });

  it("flushes a pending save on unmount", () => {
    const { unmount } = render(<Harness />);
    act(() => store().rename("Flushed"));
    unmount();
    expect(JSON.parse(localStorage.getItem(AUTOSAVE_KEY)!).ship.name).toBe(
      "Flushed"
    );
  });

  it("warns once when storage fails", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    render(<Harness />);
    act(() => store().rename("One"));
    act(() => jest.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(store().notice).toMatch(/won't be saved/);
    act(() => store().setNotice(null));
    act(() => store().rename("Two"));
    act(() => jest.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(store().notice).toBeNull();
  });
});
