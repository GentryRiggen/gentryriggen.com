import { renderHook, waitFor } from "@testing-library/react";
import {
  serviceWorkerScope,
  serviceWorkerUrl,
  useGameServiceWorker,
} from "../useGameServiceWorker";

const ORIGIN = window.location.origin;

function installServiceWorker() {
  const postMessage = jest.fn();
  const register = jest.fn().mockResolvedValue({});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register, ready: Promise.resolve({ active: { postMessage } }) },
  });
  return { register, postMessage };
}

function setEnv(env: Record<string, string>) {
  jest.replaceProperty(process, "env", {
    ...process.env,
    ...env,
  } as NodeJS.ProcessEnv);
}

afterEach(() => {
  jest.restoreAllMocks();
  Reflect.deleteProperty(navigator, "serviceWorker");
  Reflect.deleteProperty(performance, "getEntriesByType");
  window.history.pushState({}, "", "/");
});

describe("useGameServiceWorker", () => {
  it("names the worker and its scope without a trailing slash", () => {
    expect(serviceWorkerUrl("pip")).toBe("/pip-sw.js");
    expect(serviceWorkerScope("pip")).toBe("/pip");
  });

  it("does nothing outside production", async () => {
    const { register } = installServiceWorker();
    renderHook(() => useGameServiceWorker("pip"));
    await Promise.resolve();
    expect(register).not.toHaveBeenCalled();
  });

  it("stays off in the e2e build unless the page asks with ?offline", async () => {
    setEnv({ NODE_ENV: "production", NEXT_PUBLIC_E2E: "1" });
    const { register } = installServiceWorker();
    renderHook(() => useGameServiceWorker("pip"));
    await Promise.resolve();
    expect(register).not.toHaveBeenCalled();

    window.history.pushState({}, "", "/?offline");
    renderHook(() => useGameServiceWorker("pip"));
    await waitFor(() => expect(register).toHaveBeenCalled());
  });

  it("registers in production and caches the page, manifest and icons", async () => {
    setEnv({ NODE_ENV: "production", NEXT_PUBLIC_E2E: "" });
    const { register, postMessage } = installServiceWorker();
    Object.defineProperty(performance, "getEntriesByType", {
      configurable: true,
      value: () => [
        { name: `${ORIGIN}/_next/static/chunks/a.js` },
        { name: "https://cdn.example.com/x.js" },
      ],
    });

    renderHook(() => useGameServiceWorker("pip"));

    await waitFor(() => expect(postMessage).toHaveBeenCalled());
    expect(register).toHaveBeenCalledWith("/pip-sw.js", { scope: "/pip" });
    const { type, urls } = postMessage.mock.calls[0][0] as {
      type: string;
      urls: string[];
    };
    expect(type).toBe("CACHE_URLS");
    expect(urls).toContain(`${ORIGIN}/_next/static/chunks/a.js`);
    expect(urls).toContain(`${ORIGIN}/pip.webmanifest`);
    expect(urls).toContain(`${ORIGIN}/pip-icons/icon-192-v1.png`);
    expect(urls.some((url) => url.includes("cdn.example.com"))).toBe(false);
  });

  it("ignores a failed registration", async () => {
    setEnv({ NODE_ENV: "production", NEXT_PUBLIC_E2E: "" });
    const { register } = installServiceWorker();
    register.mockRejectedValue(new Error("nope"));
    renderHook(() => useGameServiceWorker("pip"));
    await waitFor(() => expect(register).toHaveBeenCalled());
  });
});
