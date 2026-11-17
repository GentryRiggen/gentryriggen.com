import { createTestHooks } from "../testHooks";

describe("createTestHooks", () => {
  it("puts the hooks on window and removes them", () => {
    const hooks = { ping: () => "pong" };
    const remove = createTestHooks("__kitTest", hooks, true);
    expect((window as unknown as { __kitTest: typeof hooks }).__kitTest).toBe(
      hooks
    );
    remove();
    expect("__kitTest" in window).toBe(false);
  });

  it("exposes nothing when the gate is off", () => {
    createTestHooks("__kitOff", { a: 1 }, false)();
    expect("__kitOff" in window).toBe(false);
  });
});
