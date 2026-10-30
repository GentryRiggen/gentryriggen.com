import { clearNearMissPop, nearMissPop, nearMissText } from "../nearMissPop";

describe("nearMissText", () => {
  it("shows the multiplier from the second near miss in a row", () => {
    expect(nearMissText(1)).toBe("Close call!");
    expect(nearMissText(3)).toBe("Close call! ×3");
  });
});

describe("nearMissPop", () => {
  afterEach(() => clearNearMissPop());

  it("holds the newest pop with a fresh id and tells subscribers", () => {
    const listener = jest.fn();
    const unsubscribe = nearMissPop.subscribe(listener);
    nearMissPop.push(2, 2);
    const first = nearMissPop.get();
    nearMissPop.push(3, 3);
    expect(nearMissPop.get()).toMatchObject({ multiplier: 3, coins: 3 });
    expect(nearMissPop.get()!.id).toBeGreaterThan(first!.id);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    clearNearMissPop();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(nearMissPop.get()).toBeNull();
  });
});
