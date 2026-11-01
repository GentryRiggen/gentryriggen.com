import { reloadPage } from "@/lib/jim/reload";
import { act, renderHook, waitFor } from "@testing-library/react";
import useJimUpdate from "../useJimUpdate";

jest.mock("@/lib/jim/reload", () => ({ reloadPage: jest.fn() }));

function mockVersionFile(build: string) {
  const fetchMock = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ build }) });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function setContainer(value: unknown) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value,
  });
}

/** A fake container, registration and waiting worker. */
function fakeWorkers(waiting: boolean) {
  const listeners = new Map<string, () => void>();
  const postMessage = jest.fn();
  const registration = {
    waiting: waiting ? { postMessage } : null,
    installing: null,
    update: jest.fn(async () => {}),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  const container = {
    controller: {},
    getRegistration: jest.fn(async () => registration),
    addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
  };
  setContainer(container);
  return { registration, container, listeners, postMessage };
}

function showTab() {
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

const reload = reloadPage as jest.Mock;
beforeEach(() => {
  reload.mockReset();
  setContainer(undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("useJimUpdate: version file", () => {
  it("shows the pill state when the deployed build differs, without reloading", async () => {
    const fetchMock = mockVersionFile("new");
    const { result } = renderHook(() =>
      useJimUpdate({ current: "old", enabled: true })
    );
    await waitFor(() => expect(result.current.isUpdateReady).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/jim/version.json", {
      cache: "no-store",
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it("stays quiet on the same build and when disabled", async () => {
    const fetchMock = mockVersionFile("same");
    const { result } = renderHook(() =>
      useJimUpdate({ current: "same", enabled: true })
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.isUpdateReady).toBe(false);
    fetchMock.mockClear();
    renderHook(() => useJimUpdate({ current: "x", enabled: false }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stays quiet when the fetch fails", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error("offline"));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() =>
      useJimUpdate({ current: "old", enabled: true })
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.isUpdateReady).toBe(false);
  });

  it("throttles to one check per interval across visibility and pageshow", async () => {
    jest.useFakeTimers({ now: 5_000_000 });
    const fetchMock = mockVersionFile("same");
    renderHook(() =>
      useJimUpdate({ current: "same", enabled: true, intervalMs: 1_000 })
    );
    await act(async () => {});
    await act(async () => {
      showTab();
      window.dispatchEvent(new Event("pageshow"));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    jest.setSystemTime(5_000_000 + 2_000);
    await act(async () => {
      showTab();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("useJimUpdate: service worker", () => {
  it("shows the pill for a waiting worker and updates the worker on return", async () => {
    const { registration } = fakeWorkers(true);
    mockVersionFile("same");
    const { result } = renderHook(() =>
      useJimUpdate({ current: "same", enabled: true })
    );
    await waitFor(() => expect(result.current.isUpdateReady).toBe(true));
    expect(registration.update).toHaveBeenCalled();
  });

  it("does not show the pill without a waiting worker", async () => {
    const { registration } = fakeWorkers(false);
    mockVersionFile("same");
    const { result } = renderHook(() =>
      useJimUpdate({ current: "same", enabled: true })
    );
    await waitFor(() => expect(registration.update).toHaveBeenCalled());
    expect(result.current.isUpdateReady).toBe(false);
  });

  it("tap posts SKIP_WAITING and reloads once on controllerchange", async () => {
    const { listeners, postMessage } = fakeWorkers(true);
    mockVersionFile("same");
    const { result } = renderHook(() =>
      useJimUpdate({ current: "same", enabled: true })
    );
    await waitFor(() => expect(result.current.isUpdateReady).toBe(true));
    await act(async () => result.current.update());
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).not.toHaveBeenCalled();
    act(() => {
      listeners.get("controllerchange")?.();
      listeners.get("controllerchange")?.();
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("a plain reload when only the version file changed", async () => {
    mockVersionFile("new");
    const { result } = renderHook(() =>
      useJimUpdate({ current: "old", enabled: true })
    );
    await waitFor(() => expect(result.current.isUpdateReady).toBe(true));
    await act(async () => result.current.update());
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it.each([
    ["a stub with no methods", {}],
    ["a stub with only addEventListener", { addEventListener: () => {} }],
  ])("survives %s", async (_label, stub) => {
    setContainer(stub);
    const fetchMock = mockVersionFile("same");
    const { result } = renderHook(() =>
      useJimUpdate({ current: "same", enabled: true })
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.isUpdateReady).toBe(false);
  });
});
