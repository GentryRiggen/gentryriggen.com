import { act, StrictMode } from "react";
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

  it("removes parts that no longer fit from a shared ship and says so", () => {
    const broken = testShip([
      gridPart("a", "deck-1x1", 0, 0, 0),
      gridPart("floating", "deck-1x1", 3, 0, 0),
    ]);
    window.history.replaceState(
      null,
      "",
      `/ship-builder#ship=${encodeShip(broken)}`
    );
    render(<Harness />);
    expect(store().ship.parts.map((p) => p.id)).toEqual(["a"]);
    expect(store().notice?.text).toBe(
      "1 part didn't fit any more and was removed"
    );
  });

  it("removes parts that no longer fit from the autosave and says so", () => {
    const broken = testShip([
      gridPart("a", "deck-1x1", 0, 0, 0),
      gridPart("floating", "deck-1x1", 3, 0, 0),
    ]);
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ ship: broken, savedId: null })
    );
    render(<Harness />);
    expect(store().ship.parts.map((p) => p.id)).toEqual(["a"]);
    expect(store().notice?.text).toBe(
      "1 part didn't fit any more and was removed"
    );
  });

  it("shows a notice for an invalid hash and restores the autosave", () => {
    saveAutosave(shared, "ship-3");
    window.history.replaceState(null, "", "/ship-builder#ship=garbage");
    render(<Harness />);
    expect(store().notice?.text).toBe("Couldn't load that ship");
    expect(store().ship).toEqual(shared);
    expect(store().savedId).toBe("ship-3");
    expect(window.location.hash).toBe("");
  });

  it("restores the autosave after an invalid hash under StrictMode", () => {
    saveAutosave(shared, "ship-3");
    window.history.replaceState(null, "", "/ship-builder#ship=garbage");
    render(
      <StrictMode>
        <Harness />
      </StrictMode>
    );
    expect(store().notice?.text).toBe("Couldn't load that ship");
    expect(store().ship).toEqual(shared);
    expect(store().savedId).toBe("ship-3");
  });

  it("keeps the current ship when an invalid hash arrives mid-session", () => {
    render(<Harness />);
    act(() => store().rename("Current"));
    const before = store().ship;
    act(() => {
      window.location.hash = "ship=garbage";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(store().notice?.text).toBe("Couldn't load that ship");
    expect(store().ship).toBe(before);
    expect(window.location.hash).toBe("");
  });

  it("still loads a shared ship on hashchange under StrictMode", () => {
    render(
      <StrictMode>
        <Harness />
      </StrictMode>
    );
    act(() => {
      window.history.replaceState(
        null,
        "",
        `/ship-builder#ship=${encodeShip(shared)}`
      );
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(store().ship).toEqual(shared);
  });

  it("loads a shared ship on hashchange as an undoable edit", () => {
    render(<Harness />);
    const pastBefore = store().past.length;
    act(() => {
      window.location.hash = `ship=${encodeShip(shared)}`;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(store().ship).toEqual(shared);
    expect(store().past).toHaveLength(pastBefore + 1);
    expect(window.location.hash).toBe("");
  });

  it("restores the autosave when there is no hash", () => {
    saveAutosave(shared, "ship-3");
    render(<Harness />);
    expect(store().ship).toEqual(shared);
    expect(store().savedId).toBe("ship-3");
    expect(store().past).toHaveLength(0);
  });

  it("shows a notice when the autosave can't be read, leaving it stored", () => {
    localStorage.setItem(AUTOSAVE_KEY, "{not json");
    render(<Harness />);
    expect(store().notice?.text).toBe("Couldn't restore your last ship");
    expect(store().ship.parts).toHaveLength(0);
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBe("{not json");
  });

  it("shows no notice when there is no autosave", () => {
    render(<Harness />);
    expect(store().notice).toBeNull();
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

  it("flushes a pending save on pagehide", () => {
    render(<Harness />);
    act(() => store().rename("Closing"));
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull();
    window.dispatchEvent(new Event("pagehide"));
    expect(JSON.parse(localStorage.getItem(AUTOSAVE_KEY)!).ship.name).toBe(
      "Closing"
    );
  });

  it("does not write on pagehide when nothing is pending", () => {
    render(<Harness />);
    window.dispatchEvent(new Event("pagehide"));
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull();
  });

  it("warns once when storage fails", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    render(<Harness />);
    act(() => store().rename("One"));
    act(() => jest.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(store().notice?.text).toMatch(/won't be saved/);
    act(() => store().setNotice(null));
    act(() => store().rename("Two"));
    act(() => jest.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(store().notice).toBeNull();
  });
});

describe("a share link opened during a sea trial", () => {
  it("ends the trial and replaces the ship", () => {
    act(() => {
      store().startTrial("calm");
    });
    expect(store().trial.status).toBe("running");
    window.history.replaceState(
      null,
      "",
      `/ship-builder#ship=${encodeShip(shared)}`
    );
    render(<Harness />);
    expect(store().trial.status).toBe("idle");
    expect(store().ship).toEqual(shared);
    expect(window.location.hash).toBe("");
  });

  it("also handles a link that arrives later, on hashchange", () => {
    render(<Harness />);
    act(() => {
      store().startTrial("calm");
    });
    act(() => {
      window.history.replaceState(
        null,
        "",
        `/ship-builder#ship=${encodeShip(shared)}`
      );
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(store().trial.status).toBe("idle");
    expect(store().ship).toEqual(shared);
  });
});
