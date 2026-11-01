import { reloadPage } from "@/lib/jim/reload";
import { renderHook } from "@testing-library/react";
import useJimStaleChunkRecovery from "../useJimStaleChunkRecovery";

jest.mock("@/lib/jim/reload", () => ({ reloadPage: jest.fn() }));

const reload = reloadPage as jest.Mock;
beforeEach(() => {
  reload.mockReset();
  window.sessionStorage.clear();
});
afterEach(() => {});

function rejectWith(reason: unknown) {
  const event = new Event("unhandledrejection") as Event & { reason: unknown };
  event.reason = reason;
  window.dispatchEvent(event);
}

describe("useJimStaleChunkRecovery", () => {
  it("reloads once for a missing chunk, then not again within a minute", () => {
    renderHook(() => useJimStaleChunkRecovery());
    rejectWith(new Error("Loading chunk 12 failed."));
    rejectWith(new Error("Loading chunk 13 failed."));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("ignores unrelated errors", () => {
    renderHook(() => useJimStaleChunkRecovery());
    rejectWith(new Error("Cannot read properties of undefined"));
    expect(reload).not.toHaveBeenCalled();
  });
});
