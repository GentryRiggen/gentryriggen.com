import { act, renderHook, waitFor } from "@testing-library/react";
import { useUpdateCheck } from "../useUpdateCheck";

const URL = "/ever-onward/version.json";

function mockVersionFile(build: string) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ version: "1.1.0", build }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function showTab() {
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("useUpdateCheck", () => {
  it("reports an update when the deployed build differs", async () => {
    const fetchMock = mockVersionFile("new");
    const { result } = renderHook(() =>
      useUpdateCheck({ versionUrl: URL, current: "old", enabled: true })
    );
    await waitFor(() => expect(result.current.isUpdateReady).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/ever-onward/version.json", {
      cache: "no-store",
    });
  });

  it("stays quiet when the build is the same", async () => {
    const fetchMock = mockVersionFile("same");
    const { result } = renderHook(() =>
      useUpdateCheck({ versionUrl: URL, current: "same", enabled: true })
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.isUpdateReady).toBe(false);
  });

  it("also re-checks on pageshow (iOS home-screen resume)", async () => {
    jest.useFakeTimers({ now: 5_000_000 });
    const fetchMock = mockVersionFile("same");
    renderHook(() =>
      useUpdateCheck({
        versionUrl: URL,
        current: "same",
        enabled: true,
        intervalMs: 1_000,
      })
    );
    await act(async () => {});
    jest.setSystemTime(5_000_000 + 2_000);
    await act(async () => {
      window.dispatchEvent(new Event("pageshow"));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does nothing when disabled", async () => {
    const fetchMock = mockVersionFile("new");
    renderHook(() =>
      useUpdateCheck({ versionUrl: URL, current: "old", enabled: false })
    );
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stays quiet when the check fails", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error("offline"));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() =>
      useUpdateCheck({ versionUrl: URL, current: "old", enabled: true })
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.isUpdateReady).toBe(false);
  });

  it("re-checks when the tab returns, at most once a minute", async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    const fetchMock = mockVersionFile("same");
    renderHook(() =>
      useUpdateCheck({
        versionUrl: URL,
        current: "same",
        enabled: true,
        intervalMs: 60_000,
      })
    );
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => showTab());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    jest.setSystemTime(1_000_000 + 61_000);
    await act(async () => showTab());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
