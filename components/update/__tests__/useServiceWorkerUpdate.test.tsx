import { act, renderHook, waitFor } from "@testing-library/react";
import { reloadPage } from "@/lib/update/reloadPage";
import {
  SW_TAKEOVER_TIMEOUT_MS,
  useServiceWorkerUpdate,
} from "../useServiceWorkerUpdate";

type Listener = () => void;

class Emitter {
  private listeners = new Map<string, Set<Listener>>();
  addEventListener(type: string, fn: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners.get(type)?.delete(fn);
  }
  emit(type: string) {
    this.listeners.get(type)?.forEach((fn) => fn());
  }
}

class MockWorker extends Emitter {
  state = "installed";
  postMessage = jest.fn();
}

class MockRegistration extends Emitter {
  waiting: MockWorker | null = null;
  installing: MockWorker | null = null;
  update = jest.fn().mockResolvedValue(undefined);
}

class MockContainer extends Emitter {
  controller: object | null = {};
  ready: Promise<MockRegistration>;
  constructor(registration: MockRegistration) {
    super();
    this.ready = Promise.resolve(registration);
  }
}

jest.mock("@/lib/update/reloadPage", () => ({ reloadPage: jest.fn() }));

const reload = jest.mocked(reloadPage);

function install(container: MockContainer) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: container,
  });
}

beforeEach(() => {
  reload.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

function setup(configure?: (registration: MockRegistration) => void) {
  const registration = new MockRegistration();
  configure?.(registration);
  const container = new MockContainer(registration);
  install(container);
  const hook = renderHook(() => useServiceWorkerUpdate({ enabled: true }));
  return { registration, container, ...hook };
}

describe("useServiceWorkerUpdate", () => {
  it("does nothing when disabled", async () => {
    const registration = new MockRegistration();
    install(new MockContainer(registration));
    const { result } = renderHook(() =>
      useServiceWorkerUpdate({ enabled: false })
    );
    await act(async () => {});
    expect(registration.update).not.toHaveBeenCalled();
    expect(result.current.isUpdateReady).toBe(false);
  });

  it("asks for a new worker on load", async () => {
    const { registration } = setup();
    await waitFor(() => expect(registration.update).toHaveBeenCalledTimes(1));
  });

  it("is ready when a worker is already waiting", async () => {
    const { result } = setup((r) => {
      r.waiting = new MockWorker();
    });
    await waitFor(() => expect(result.current.isUpdateReady).toBe(true));
  });

  it("becomes ready when a found worker finishes installing", async () => {
    const { registration, result } = setup();
    await waitFor(() => expect(registration.update).toHaveBeenCalled());
    const worker = new MockWorker();
    worker.state = "installing";
    registration.installing = worker;
    act(() => registration.emit("updatefound"));
    expect(result.current.isUpdateReady).toBe(false);
    worker.state = "installed";
    registration.waiting = worker;
    act(() => worker.emit("statechange"));
    expect(result.current.isUpdateReady).toBe(true);
  });

  it("does not treat the first install as an update", async () => {
    const registration = new MockRegistration();
    const container = new MockContainer(registration);
    container.controller = null;
    install(container);
    const { result } = renderHook(() =>
      useServiceWorkerUpdate({ enabled: true })
    );
    await waitFor(() => expect(registration.update).toHaveBeenCalled());
    act(() => {
      container.controller = {};
      container.emit("controllerchange");
    });
    expect(result.current.isUpdateReady).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("is ready when a worker took over an already controlled page", async () => {
    const { container, result } = setup();
    await act(async () => {});
    act(() => container.emit("controllerchange"));
    expect(result.current.isUpdateReady).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });

  it("on apply, tells the waiting worker to skip waiting and reloads once", async () => {
    const worker = new MockWorker();
    const { container, result } = setup((r) => {
      r.waiting = worker;
    });
    await waitFor(() => expect(result.current.isUpdateReady).toBe(true));

    act(() => result.current.applyUpdate());
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(reload).not.toHaveBeenCalled();

    act(() => container.emit("controllerchange"));
    act(() => container.emit("controllerchange"));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads anyway if the worker never takes over", async () => {
    const { result } = setup((r) => {
      r.waiting = new MockWorker();
    });
    await waitFor(() => expect(result.current.isUpdateReady).toBe(true));
    jest.useFakeTimers();
    act(() => result.current.applyUpdate());
    act(() => {
      jest.advanceTimersByTime(SW_TAKEOVER_TIMEOUT_MS);
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("just reloads when nothing is waiting", async () => {
    const { result } = setup();
    await act(async () => {});
    act(() => result.current.applyUpdate());
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("re-checks when the tab returns, at most once a minute", async () => {
    jest.useFakeTimers({ now: 1_000_000, doNotFake: ["queueMicrotask"] });
    const { registration } = setup();
    await act(async () => {});
    expect(registration.update).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(registration.update).toHaveBeenCalledTimes(1);
    jest.setSystemTime(1_000_000 + 61_000);
    act(() => {
      window.dispatchEvent(new Event("pageshow"));
    });
    expect(registration.update).toHaveBeenCalledTimes(2);
  });

  it("ignores a failing update check", async () => {
    const { registration, result } = setup((r) => {
      r.update.mockRejectedValue(new Error("offline"));
    });
    await waitFor(() => expect(registration.update).toHaveBeenCalled());
    expect(result.current.isUpdateReady).toBe(false);
  });
});
