import { renderHook, waitFor } from "@testing-library/react";
import useServiceWorker, {
  SERVICE_WORKER_SCOPE,
  SERVICE_WORKER_URL,
} from "../useServiceWorker";

interface MockContainer {
  register: jest.Mock;
  ready: Promise<{ active: { postMessage: jest.Mock } | null }>;
}

const ORIGIN = window.location.origin;

function installServiceWorker(container: MockContainer) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: container,
  });
}

function makeContainer() {
  const postMessage = jest.fn();
  const container: MockContainer = {
    register: jest.fn().mockResolvedValue({}),
    ready: Promise.resolve({ active: { postMessage } }),
  };
  return { container, postMessage };
}

// jsdom's Performance has no getEntriesByType, so it is defined per test.
function mockResources(names: string[]) {
  Object.defineProperty(performance, "getEntriesByType", {
    configurable: true,
    value: jest.fn(() => names.map((name) => ({ name }))),
  });
}

function setNodeEnv(value: NodeJS.ProcessEnv["NODE_ENV"]) {
  jest.replaceProperty(process, "env", { ...process.env, NODE_ENV: value });
}

afterEach(() => {
  jest.restoreAllMocks();
  Reflect.deleteProperty(navigator, "serviceWorker");
  Reflect.deleteProperty(performance, "getEntriesByType");
});

describe("useServiceWorker", () => {
  it("does nothing outside production", async () => {
    const { container } = makeContainer();
    installServiceWorker(container);

    renderHook(() => useServiceWorker());
    await Promise.resolve();

    expect(container.register).not.toHaveBeenCalled();
  });

  it("does nothing when service workers are unsupported", () => {
    setNodeEnv("production");

    expect(() => renderHook(() => useServiceWorker())).not.toThrow();
  });

  it("registers the scoped worker and posts the loaded same-origin URLs", async () => {
    setNodeEnv("production");
    const { container, postMessage } = makeContainer();
    installServiceWorker(container);
    mockResources([
      `${ORIGIN}/_next/static/chunks/app.js`,
      "https://fonts.example.com/font.woff2",
    ]);

    renderHook(() => useServiceWorker());

    // jsdom may fire its own window load event, which posts a second time.
    await waitFor(() => expect(postMessage).toHaveBeenCalled());
    expect(container.register).toHaveBeenCalledWith(SERVICE_WORKER_URL, {
      scope: SERVICE_WORKER_SCOPE,
    });
    expect(SERVICE_WORKER_URL).toBe("/ship-builder-sw.js");
    expect(SERVICE_WORKER_SCOPE).toBe("/ship-builder");
    expect(postMessage).toHaveBeenCalledWith({
      type: "CACHE_URLS",
      urls: [`${ORIGIN}/_next/static/chunks/app.js`, window.location.href],
    });
  });

  it("posts again once the page finishes loading", async () => {
    setNodeEnv("production");
    const { container, postMessage } = makeContainer();
    installServiceWorker(container);
    mockResources([]);

    renderHook(() => useServiceWorker());
    await waitFor(() => expect(postMessage).toHaveBeenCalled());
    const callsBeforeLoad = postMessage.mock.calls.length;

    window.dispatchEvent(new Event("load"));

    expect(postMessage).toHaveBeenCalledTimes(callsBeforeLoad + 1);
  });

  it("swallows registration failures", async () => {
    setNodeEnv("production");
    const { container, postMessage } = makeContainer();
    container.register.mockRejectedValue(new Error("blocked"));
    installServiceWorker(container);

    renderHook(() => useServiceWorker());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(postMessage).not.toHaveBeenCalled();
  });

  it("does not post after unmounting", async () => {
    setNodeEnv("production");
    const { container, postMessage } = makeContainer();
    installServiceWorker(container);
    mockResources([]);

    const { unmount } = renderHook(() => useServiceWorker());
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(postMessage).not.toHaveBeenCalled();
  });
});

describe("useServiceWorker late resources", () => {
  it("posts resources that load after the worker is ready", async () => {
    setNodeEnv("production");
    const { container, postMessage } = makeContainer();
    installServiceWorker(container);
    mockResources([`${ORIGIN}/_next/static/chunks/app.js`]);

    let observerCallback:
      ((list: { getEntries(): { name: string }[] }) => void) | null = null;
    class FakeObserver {
      constructor(cb: typeof observerCallback) {
        observerCallback = cb;
      }
      observe() {}
      disconnect() {}
    }
    Object.defineProperty(window, "PerformanceObserver", {
      configurable: true,
      value: FakeObserver,
    });

    renderHook(() => useServiceWorker());
    await waitFor(() => expect(postMessage).toHaveBeenCalled());
    postMessage.mockClear();

    const lateChunk = `${ORIGIN}/_next/static/chunks/scene.js`;
    observerCallback!({
      getEntries: () => [
        { name: lateChunk },
        { name: "https://cdn.example.com/x.js" },
      ],
    });

    expect(postMessage).toHaveBeenCalledWith({
      type: "CACHE_URLS",
      urls: [lateChunk],
    });
    Reflect.deleteProperty(window, "PerformanceObserver");
  });
});
