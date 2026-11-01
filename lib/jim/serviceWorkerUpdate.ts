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
  let tracked: ServiceWorkerRegistration | undefined;
  const cleanups: Array<() => void> = [];

  const flagIfWaiting = (registration: ServiceWorkerRegistration) => {
    if (registration.waiting && container.controller) onWaiting();
  };

  const trackInstalling = (registration: ServiceWorkerRegistration) => {
    const worker = registration.installing;
    if (!worker || typeof worker.addEventListener !== "function") return;
    const onState = () => {
      if (worker.state === "installed" && container.controller) onWaiting();
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
    if (lastCheck && now - lastCheck < intervalMs) return;
    lastCheck = now;
    try {
      const registration = await container.getRegistration(JIM_SW_SCOPE);
      if (isCancelled || !registration) return;
      attach(registration);
      if (typeof registration.update === "function") {
        await registration.update();
        if (!isCancelled) flagIfWaiting(registration);
      }
    } catch {
      // Offline or a refused update: try again on the next return.
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

/**
 * Tells the waiting worker to take over, and reloads once when it does.
 * Returns false when there is no waiting worker (the caller should just
 * reload). The reload happens at most once per call, and only because the
 * person tapped: a first install's controllerchange never reloads.
 */
export async function activateWaitingWorker(
  reload: () => void
): Promise<boolean> {
  const container = workerContainer();
  if (!container) return false;
  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration = await container.getRegistration(JIM_SW_SCOPE);
  } catch {
    return false;
  }
  const waiting = registration?.waiting;
  if (!waiting) return false;
  let hasReloaded = false;
  const onChange = () => {
    if (hasReloaded) return;
    hasReloaded = true;
    container.removeEventListener("controllerchange", onChange);
    reload();
  };
  container.addEventListener("controllerchange", onChange);
  waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}
