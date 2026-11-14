/**
 * Keeps /jim's service worker fresh and tells the page when a new one is
 * waiting. Every browser API is guarded: navigator.serviceWorker can be
 * missing or a partial stub (some browsers, e2e).
 */

import { JIM_SW_SCOPE } from "@/lib/jim/serviceWorker";

interface WorkerContainer {
  controller?: ServiceWorker | null;
  getRegistration: (
    scope?: string
  ) => Promise<ServiceWorkerRegistration | undefined>;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

/** A failed check may try again after this long, not a whole interval. */
export const RETRY_AFTER_FAILURE_MS = 10_000;
/** How long a tap waits for a worker that is still installing. */
export const INSTALL_WAIT_MS = 10_000;
/** After SKIP_WAITING, how long before giving up on controllerchange. */
export const CONTROLLER_CHANGE_WAIT_MS = 4_000;

/** Workers already told to take over: never offered as an update again. */
const activatedWorkers = new WeakSet<object>();
let isActivating = false;

function workerContainer(): WorkerContainer | null {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  const container = navigator.serviceWorker as unknown as
    Partial<WorkerContainer> | undefined;
  if (
    typeof container?.addEventListener !== "function" ||
    typeof container.removeEventListener !== "function" ||
    typeof container.getRegistration !== "function"
  ) {
    return null;
  }
  return container as WorkerContainer;
}

/**
 * Calls `onWaiting` when a new worker is installed and waiting (or becomes
 * so) while another controls the page. Asks the browser to look for a new
 * worker now, on every return to the page, at most once per `intervalMs`.
 * Returns a cleanup.
 */
export function watchForWaitingWorker(
  onWaiting: () => void,
  intervalMs: number
): () => void {
  const container = workerContainer();
  if (!container) return () => {};
  let isCancelled = false;
  let lastCheck = 0;
  let isChecking = false;
  let tracked: ServiceWorkerRegistration | undefined;
  const cleanups: Array<() => void> = [];

  const flagIfWaiting = (registration: ServiceWorkerRegistration) => {
    const { waiting } = registration;
    if (waiting && container.controller && !activatedWorkers.has(waiting))
      onWaiting();
  };

  const trackInstalling = (registration: ServiceWorkerRegistration) => {
    const worker = registration.installing;
    if (!worker || typeof worker.addEventListener !== "function") return;
    const onState = () => {
      if (
        worker.state === "installed" &&
        container.controller &&
        !activatedWorkers.has(worker)
      )
        onWaiting();
    };
    worker.addEventListener("statechange", onState);
    cleanups.push(() => worker.removeEventListener("statechange", onState));
  };

  const attach = (registration: ServiceWorkerRegistration) => {
    if (tracked === registration) return;
    tracked = registration;
    flagIfWaiting(registration);
    trackInstalling(registration);
    if (typeof registration.addEventListener === "function") {
      const onUpdateFound = () => trackInstalling(registration);
      registration.addEventListener("updatefound", onUpdateFound);
      cleanups.push(() =>
        registration.removeEventListener("updatefound", onUpdateFound)
      );
    }
  };

  const check = async () => {
    const now = Date.now();
    if (isChecking || (lastCheck && now - lastCheck < intervalMs)) return;
    isChecking = true;
    try {
      const registration = await container.getRegistration(JIM_SW_SCOPE);
      if (isCancelled || !registration) return;
      attach(registration);
      if (typeof registration.update === "function") {
        await registration.update();
        if (!isCancelled) flagIfWaiting(registration);
      }
      lastCheck = Date.now();
    } catch {
      // Offline or a refused update: try again soon, not a whole interval.
      lastCheck = Date.now() - Math.max(0, intervalMs - RETRY_AFTER_FAILURE_MS);
    } finally {
      isChecking = false;
    }
  };

  const handleVisibility = () => {
    if (document.visibilityState === "visible") void check();
  };
  const handlePageShow = () => void check();

  void check();
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("pageshow", handlePageShow);
  return () => {
    isCancelled = true;
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("pageshow", handlePageShow);
    cleanups.forEach((cleanup) => cleanup());
  };
}

/** Resolves true once `worker` is installed, false on failure or timeout. */
function untilInstalled(worker: ServiceWorker): Promise<boolean> {
  if (worker.state === "installed") return Promise.resolve(true);
  if (typeof worker.addEventListener !== "function")
    return Promise.resolve(false);
  return new Promise((resolve) => {
    const done = (value: boolean) => {
      clearTimeout(timer);
      worker.removeEventListener("statechange", onState);
      resolve(value);
    };
    const onState = () => {
      if (worker.state === "installed") done(true);
      else if (worker.state === "redundant") done(false);
    };
    const timer = setTimeout(() => done(false), INSTALL_WAIT_MS);
    worker.addEventListener("statechange", onState);
  });
}

/**
 * Tells the waiting worker to take over, and reloads once when it does (or
 * after a few seconds if the browser never says). A worker still installing
 * is waited for first. Returns false when there is no new worker (the
 * caller should just reload). Repeated taps while one is under way do
 * nothing more. The reload happens only because the person tapped: a first
 * install's controllerchange never reloads.
 */
export async function activateWaitingWorker(
  reload: () => void
): Promise<boolean> {
  const container = workerContainer();
  if (!container) return false;
  if (isActivating) return true;
  let waiting: ServiceWorker | null | undefined;
  try {
    const registration = await container.getRegistration(JIM_SW_SCOPE);
    if (!registration) return false;
    if (
      !registration.waiting &&
      !registration.installing &&
      typeof registration.update === "function"
    ) {
      // The new worker may not have been found yet: look now.
      await registration.update();
    }
    if (!registration.waiting && registration.installing) {
      await untilInstalled(registration.installing);
    }
    waiting = registration.waiting;
  } catch {
    return false;
  }
  if (!waiting) return false;
  if (isActivating) return true;
  isActivating = true;
  activatedWorkers.add(waiting);
  let hasReloaded = false;
  const finish = () => {
    if (hasReloaded) return;
    hasReloaded = true;
    clearTimeout(fallback);
    container.removeEventListener("controllerchange", finish);
    isActivating = false;
    reload();
  };
  const fallback = setTimeout(finish, CONTROLLER_CHANGE_WAIT_MS);
  container.addEventListener("controllerchange", finish);
  waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}
