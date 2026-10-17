/**
 * Stubs requestAnimationFrame and performance.now so a test can place a
 * timing gauge's marker at an exact moment.
 */
export function stubFrames() {
  let now = 0;
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  jest.spyOn(performance, "now").mockImplementation(() => now);
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    const id = nextId++;
    callbacks.set(id, cb);
    return id;
  });
  jest
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation((id) => void callbacks.delete(id));

  return {
    /** Moves the clock to `ms` and runs the frames queued so far. */
    at(ms: number) {
      now = ms;
      const due = [...callbacks.values()];
      callbacks.clear();
      due.forEach((cb) => cb(now));
    },
  };
}
