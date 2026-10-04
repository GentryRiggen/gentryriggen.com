import {
  createLongPress,
  LONG_PRESS_MS,
  MOVE_CANCEL_PX,
  type LongPress,
} from "../longPress";

describe("createLongPress", () => {
  let onFire: jest.Mock<void, [string]>;
  let onCancel: jest.Mock<void, []>;
  let press: LongPress;

  beforeEach(() => {
    jest.useFakeTimers();
    onFire = jest.fn();
    onCancel = jest.fn();
    press = createLongPress({ onFire, onCancel });
  });

  afterEach(() => {
    press.dispose();
    jest.useRealTimers();
  });

  /** A first finger or mouse button going down on a part. */
  function pressPart(partId = "p1", pointerId = 1, x = 100, y = 100) {
    press.pointerDown(pointerId, true);
    return press.start(partId, pointerId, x, y);
  }

  it("fires for the pressed part after the hold time", () => {
    expect(pressPart("p7")).toBe(true);
    jest.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(onFire).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledWith("p7");
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("reports the fire on the pointer-up that follows", () => {
    pressPart();
    jest.advanceTimersByTime(LONG_PRESS_MS);
    expect(press.end(1)).toBe("fired");
    expect(press.end(1)).toBe("idle");
  });

  it("tolerates small wobbles", () => {
    pressPart("p1", 1, 100, 100);
    press.move(1, 100 + MOVE_CANCEL_PX, 100);
    press.move(1, 100, 100 - MOVE_CANCEL_PX);
    jest.advanceTimersByTime(LONG_PRESS_MS);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("cancels when the pointer moves more than the slop", () => {
    pressPart("p1", 1, 100, 100);
    press.move(1, 106, 106);
    expect(onCancel).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(LONG_PRESS_MS * 2);
    expect(onFire).not.toHaveBeenCalled();
  });

  it("ignores moves from other pointers", () => {
    pressPart("p1", 1);
    press.move(2, 500, 500);
    jest.advanceTimersByTime(LONG_PRESS_MS);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("cancels on an early pointer-up", () => {
    pressPart();
    jest.advanceTimersByTime(LONG_PRESS_MS / 2);
    expect(press.end(1)).toBe("cancelled");
    expect(onCancel).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(LONG_PRESS_MS);
    expect(onFire).not.toHaveBeenCalled();
  });

  it("cancels when a second pointer goes down", () => {
    pressPart("p1", 1);
    press.pointerDown(2, false);
    expect(onCancel).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(LONG_PRESS_MS);
    expect(onFire).not.toHaveBeenCalled();
  });

  it("cancels on pointercancel", () => {
    pressPart("p1", 1);
    press.cancel(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(LONG_PRESS_MS);
    expect(onFire).not.toHaveBeenCalled();
  });

  it("does not start while another pointer is already down", () => {
    press.pointerDown(1, true);
    press.pointerDown(2, false);
    expect(press.start("p1", 2, 0, 0)).toBe(false);
    jest.advanceTimersByTime(LONG_PRESS_MS);
    expect(onFire).not.toHaveBeenCalled();
  });

  it("forgets lifted pointers, so the next press can start", () => {
    press.pointerDown(1, true);
    press.pointerDown(2, false);
    press.end(2);
    expect(press.start("p1", 1, 0, 0)).toBe(true);
  });

  it("drops stale pointers when a new primary pointer goes down", () => {
    press.pointerDown(1, true);
    press.pointerDown(2, false);
    // Both lifts were lost (e.g. released outside the window).
    expect(pressPart("p1", 3)).toBe(true);
  });

  it("restarts the timer for a new press", () => {
    pressPart("p1", 1);
    jest.advanceTimersByTime(LONG_PRESS_MS / 2);
    press.end(1);
    pressPart("p2", 1);
    jest.advanceTimersByTime(LONG_PRESS_MS / 2);
    expect(onFire).not.toHaveBeenCalled();
    jest.advanceTimersByTime(LONG_PRESS_MS / 2);
    expect(onFire).toHaveBeenCalledWith("p2");
  });

  it("doesn't cancel after firing", () => {
    pressPart("p1", 1, 0, 0);
    jest.advanceTimersByTime(LONG_PRESS_MS);
    press.move(1, 300, 300);
    expect(onCancel).not.toHaveBeenCalled();
    expect(press.end(1)).toBe("fired");
  });

  it("dispose stops a pending press silently", () => {
    pressPart();
    press.dispose();
    jest.advanceTimersByTime(LONG_PRESS_MS);
    expect(onFire).not.toHaveBeenCalled();
  });
});
