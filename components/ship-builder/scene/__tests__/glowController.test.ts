import { createGlowController } from "../GlowContext";
import { environmentFor } from "../environmentModel";

describe("createGlowController", () => {
  it("notifies subscribers when the value moves and not when it doesn't", () => {
    const controller = createGlowController(0);
    const listener = jest.fn();
    controller.subscribe(listener);

    controller.set(0.5);
    controller.set(0.5);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(0.5);
    expect(controller.value).toBe(0.5);
  });

  it("stops notifying after unsubscribe", () => {
    const controller = createGlowController(0);
    const listener = jest.fn();
    const unsubscribe = controller.subscribe(listener);
    unsubscribe();

    controller.set(1);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("glow in the environment", () => {
  it("is off by day, partial at sunset and full at night in any sea", () => {
    expect(environmentFor("day", "stormy").numbers.glow).toBe(0);
    expect(environmentFor("sunset", "calm").numbers.glow).toBeGreaterThan(0);
    expect(environmentFor("night", "choppy").numbers.glow).toBe(1);
  });
});
