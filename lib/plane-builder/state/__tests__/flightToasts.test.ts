import {
  clearFlightToasts,
  flightToasts,
  toastForEvent,
} from "../flightToasts";

describe("toastForEvent", () => {
  it("words the events that deserve a pop-up", () => {
    expect(toastForEvent({ type: "ring", index: 0 })).toBe("Boost!");
    expect(toastForEvent({ type: "fuel", index: 0 })).toBe("+Fuel");
    expect(toastForEvent({ type: "milestone", share: 0.25 })).toBe("25%!");
    expect(toastForEvent({ type: "milestone", share: 0.5 })).toBe("Halfway!");
    expect(toastForEvent({ type: "milestone", share: 0.75 })).toBe("75%!");
  });

  it("stays quiet for everything else", () => {
    expect(toastForEvent({ type: "coin", index: 0 })).toBeNull();
    expect(toastForEvent({ type: "milestone", share: 0.1 })).toBeNull();
  });
});

describe("flightToasts", () => {
  afterEach(() => clearFlightToasts());

  it("replaces the toast, bumps the id and tells subscribers", () => {
    const listener = jest.fn();
    const unsubscribe = flightToasts.subscribe(listener);
    flightToasts.push("Boost!");
    const first = flightToasts.get();
    flightToasts.push("+Fuel");
    const second = flightToasts.get();
    expect(first?.text).toBe("Boost!");
    expect(second?.text).toBe("+Fuel");
    expect(second!.id).toBeGreaterThan(first!.id);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    flightToasts.push("Halfway!");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("clears and notifies", () => {
    flightToasts.push("Boost!");
    const listener = jest.fn();
    const unsubscribe = flightToasts.subscribe(listener);
    clearFlightToasts();
    expect(flightToasts.get()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
