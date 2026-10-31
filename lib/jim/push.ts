import { getIdToken } from "@/lib/firebase/client";
import { JIM_API } from "@/lib/jim/api";
import { JIM_SW_SCOPE } from "@/lib/jim/serviceWorker";
import { callJim, CALL_TIMEOUT_MS } from "@/lib/jim/view";

/**
 * The morning briefing: Web Push through /jim's service worker. The server
 * keeps the subscription; this side asks permission, subscribes with the
 * server's VAPID key and hands the subscription over. Endpoints and keys are
 * never logged.
 */

type GetToken = (force?: boolean) => Promise<string | null>;

/** How long to wait for the service worker to be active. */
export const READY_TIMEOUT_MS = 10_000;

/** This browser can receive pushes for /jim. */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iPhone or iPad (iPadOS reports itself as a Mac with touch). */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

/** Opened from the Home Screen, not in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    nav.standalone === true
  );
}

/** iOS only delivers pushes to a Home Screen app. */
export function needsHomeScreen(): boolean {
  return isIos() && !isStandalone();
}

export type PushResult =
  | { ok: true }
  | {
      ok: false;
      /**
       * home-screen: iOS in a browser tab; unsupported: no push here;
       * denied: notifications are blocked; dismissed: the prompt was closed
       * without an answer; failed: the worker, the server or the push
       * service didn't come through.
       */
      reason: "home-screen" | "unsupported" | "denied" | "dismissed" | "failed";
    };

async function registration(): Promise<ServiceWorkerRegistration | null> {
  try {
    return (
      (await navigator.serviceWorker.getRegistration(JIM_SW_SCOPE)) ?? null
    );
  } catch {
    return null;
  }
}

/** The active worker's registration, or null when there isn't one in time. */
async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!(await registration())) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), READY_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** This device's subscription, or null. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    return (
      (await (await registration())?.pushManager.getSubscription()) ?? null
    );
  } catch {
    return null;
  }
}

/** base64url (the server's VAPID public key) to bytes. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const view = new Uint8Array(a);
  return view.every((byte, i) => byte === b[i]);
}

async function serverKey(
  getToken: GetToken,
  fetchFn: typeof fetch | undefined,
  api: string
): Promise<Uint8Array<ArrayBuffer> | null> {
  const res = await callJim(
    "/api/push/key",
    { method: "GET" },
    getToken,
    fetchFn,
    api,
    CALL_TIMEOUT_MS
  );
  if (!res.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  const key =
    typeof body === "object" && body !== null
      ? (body as { publicKey?: unknown }).publicKey
      : undefined;
  if (typeof key !== "string" || !key) return null;
  try {
    return keyBytes(key);
  } catch {
    return null;
  }
}

/**
 * Turns the morning briefing on: permission (asked first, inside the tap,
 * which iOS requires), then a subscription with the server's key, handed to
 * the server, then a test push. Never throws.
 */
export async function enablePush(
  getToken: GetToken = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API
): Promise<PushResult> {
  if (needsHomeScreen()) return { ok: false, reason: "home-screen" };
  if (!pushSupported()) return { ok: false, reason: "unsupported" };

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return { ok: false, reason: "failed" };
  }
  if (permission === "denied") return { ok: false, reason: "denied" };
  if (permission !== "granted") return { ok: false, reason: "dismissed" };

  let subscription: PushSubscription | null = null;
  try {
    const reg = await readyRegistration();
    if (!reg) return { ok: false, reason: "failed" };
    const key = await serverKey(getToken, fetchFn, api);
    if (!key) return { ok: false, reason: "failed" };

    subscription = await reg.pushManager.getSubscription();
    // Made with another key (the server's changed): start over.
    if (
      subscription &&
      !sameKey(subscription.options?.applicationServerKey, key)
    ) {
      await subscription.unsubscribe();
      subscription = null;
    }
    subscription ??= await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });

    const res = await callJim(
      "/api/push/subscribe",
      { method: "POST", body: subscription.toJSON() },
      getToken,
      fetchFn,
      api,
      CALL_TIMEOUT_MS
    );
    if (!res.ok) throw new Error("not saved");
  } catch {
    // The server doesn't have it: don't leave this device looking "on".
    await subscription?.unsubscribe().catch(() => false);
    return { ok: false, reason: "failed" };
  }

  // The test push is a nicety; the briefing is on either way.
  await callJim(
    "/api/push/test",
    { method: "POST" },
    getToken,
    fetchFn,
    api,
    CALL_TIMEOUT_MS
  ).catch(() => null);
  return { ok: true };
}

/**
 * Turns the morning briefing off on this device: the server forgets it and
 * the browser drops the subscription. A device that never subscribed leaves
 * the server alone (signing out on a laptop mustn't stop the phone's).
 * Never throws; the local unsubscribe happens even when the server can't
 * be reached.
 */
export async function disablePush(
  getToken: GetToken = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API
): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await Promise.allSettled([
    callJim(
      "/api/push/subscribe",
      // The endpoint lets the server drop only this device's subscription.
      { method: "DELETE", body: { endpoint: subscription.endpoint } },
      getToken,
      fetchFn,
      api,
      CALL_TIMEOUT_MS
    ),
    subscription.unsubscribe(),
  ]);
}
