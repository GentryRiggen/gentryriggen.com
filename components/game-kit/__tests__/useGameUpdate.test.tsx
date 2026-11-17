import { act, renderHook } from "@testing-library/react";
import { useGameUpdate } from "../useGameUpdate";
import { reloadPage } from "@/lib/update/reloadPage";

jest.mock("@/lib/update/reloadPage", () => ({ reloadPage: jest.fn() }));
const mockCheck = jest.fn();
jest.mock("@/components/update/useUpdateCheck", () => ({
  useUpdateCheck: (options: unknown) => mockCheck(options),
}));
jest.mock("@/components/update/useStaleChunkRecovery", () => ({
  useStaleChunkRecovery: jest.fn(),
}));

describe("useGameUpdate", () => {
  it("watches the game's own version file", () => {
    mockCheck.mockReturnValue({ isUpdateReady: false });
    const { result } = renderHook(() =>
      useGameUpdate("pip", { saveNow: jest.fn() })
    );
    expect(mockCheck).toHaveBeenCalledWith({ versionUrl: "/pip/version.json" });
    expect(result.current.isUpdateReady).toBe(false);
  });

  it("saves, then reloads, when the player taps update", () => {
    mockCheck.mockReturnValue({ isUpdateReady: true });
    const saveNow = jest.fn();
    const { result } = renderHook(() => useGameUpdate("pip", { saveNow }));
    expect(result.current.isUpdateReady).toBe(true);
    act(() => result.current.update());
    expect(saveNow).toHaveBeenCalled();
    expect(reloadPage).toHaveBeenCalled();
    expect(saveNow.mock.invocationCallOrder[0]).toBeLessThan(
      (reloadPage as jest.Mock).mock.invocationCallOrder[0]
    );
  });
});
