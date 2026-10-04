import {
  CLICK_GUARD_RELEASE_MS,
  holdClickGuard,
  notePointerDown,
  releaseClickGuard,
  resetClickGuard,
  shouldSwallowClick,
} from "../clickGuard";

describe("clickGuard", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetClickGuard();
  });

  afterEach(() => {
    resetClickGuard();
    jest.useRealTimers();
  });

  it("lets clicks through by default", () => {
    expect(shouldSwallowClick()).toBe(false);
  });

  it("swallows the click that follows the release", () => {
    holdClickGuard();
    releaseClickGuard();
    expect(shouldSwallowClick()).toBe(true);
  });

  it("swallows only one click", () => {
    holdClickGuard();
    releaseClickGuard();
    shouldSwallowClick();
    expect(shouldSwallowClick()).toBe(false);
  });

  it("stays armed however long the pointer is held", () => {
    holdClickGuard();
    jest.advanceTimersByTime(10_000);
    releaseClickGuard();
    expect(shouldSwallowClick()).toBe(true);
  });

  it("disarms shortly after the release when no click follows", () => {
    holdClickGuard();
    releaseClickGuard();
    jest.advanceTimersByTime(CLICK_GUARD_RELEASE_MS);
    expect(shouldSwallowClick()).toBe(false);
  });

  it("clears a guard left armed when a new gesture starts", () => {
    // A hold fired but its pointerup was lost (or aborted by a second finger).
    holdClickGuard();
    notePointerDown(true);
    expect(shouldSwallowClick()).toBe(false);
  });

  it("keeps the guard for extra fingers within the same gesture", () => {
    holdClickGuard();
    notePointerDown(false);
    releaseClickGuard();
    expect(shouldSwallowClick()).toBe(true);
  });

  it("ignores a release without a hold", () => {
    releaseClickGuard();
    expect(shouldSwallowClick()).toBe(false);
  });
});
