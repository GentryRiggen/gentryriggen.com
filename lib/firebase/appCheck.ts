import { isExcluded } from "@/lib/analytics/exclude";
import {
  safeLocalStorage,
  type KeyValueStorage,
} from "@/lib/analytics/storage";
import { isBot } from "@/lib/analytics/ua";
import { LOCAL_HOSTS } from "@/lib/analytics/event";
import { firebaseConfig, type FirebaseWebConfig } from "./config";

/**
 * Firebase App Check for the SDK-free REST writes. A reCAPTCHA Enterprise
 * token is exchanged for an App Check token, which rides along as the
 * `X-Firebase-AppCheck` header. Everything fails open: no token means the
 * request goes out without the header (Firestore decides what that means).
 */

export const APP_CHECK_HEADER = "X-Firebase-AppCheck";
export type AppCheckAction = "pageview" | "game_event" | "leaderboard";

const EXCHANGE_BASE = "https://firebaseappcheck.googleapis.com";
const RECAPTCHA_SRC = "https://www.google.com/recaptcha/enterprise.js";
/** Renew this long before the token really expires. */
export const EXPIRY_MARGIN_MS = 5 * 60_000;
export const TIMEOUT_MS = 3000;

interface Grecaptcha {
  enterprise: {
    ready: (cb: () => void) => void;
    execute: (key: string, options: { action: string }) => Promise<string>;
  };
}

export interface AppCheckEnv {
  hostname: string;
  userAgent: string;
  webdriver: boolean;
  isProduction: boolean;
  storage: KeyValueStorage | null;
}

export interface AppCheckDeps {
  config?: FirebaseWebConfig;
  fetchImpl?: typeof fetch;
  /** Resolves to a reCAPTCHA Enterprise token, or rejects. */
  getRecaptchaToken?: (key: string, action: string) => Promise<string>;
  getEnv?: () => AppCheckEnv | null;
  now?: () => number;
  timeoutMs?: number;
  /** Only return an already-cached token; never start a request. */
  cachedOnly?: boolean;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;
let inFlight: Promise<string | null> | null = null;

/** Test hook: forget the cached token and any request in flight. */
export function resetAppCheck(): void {
  cached = null;
  inFlight = null;
}

function browserEnv(): AppCheckEnv | null {
  if (typeof window === "undefined") return null;
  return {
    hostname: window.location.hostname,
    userAgent: navigator.userAgent,
    webdriver: navigator.webdriver === true,
    isProduction: process.env.NODE_ENV === "production",
    storage: safeLocalStorage(),
  };
}

/** Same skips as analytics: dev/e2e builds, localhost, bots, the owner. */
export function canUseAppCheck(env: AppCheckEnv | null): boolean {
  if (!env || !env.isProduction) return false;
  if (LOCAL_HOSTS.has(env.hostname)) return false;
  if (isExcluded(env.storage)) return false;
  return !isBot(env.userAgent, env.webdriver);
}

let scriptPromise: Promise<void> | null = null;

function loadScript(key: string): Promise<void> {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = `${RECAPTCHA_SRC}?render=${encodeURIComponent(key)}`;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      scriptPromise = null;
      reject(new Error("reCAPTCHA script failed to load"));
    };
    document.head.appendChild(el);
  });
  return scriptPromise;
}

async function defaultRecaptchaToken(
  key: string,
  action: string
): Promise<string> {
  await loadScript(key);
  const grecaptcha = (window as unknown as { grecaptcha?: Grecaptcha })
    .grecaptcha;
  if (!grecaptcha?.enterprise) throw new Error("reCAPTCHA unavailable");
  await new Promise<void>((resolve) => grecaptcha.enterprise.ready(resolve));
  return grecaptcha.enterprise.execute(key, { action });
}

function parseTtlMs(ttl: unknown): number | null {
  if (typeof ttl !== "string") return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(ttl);
  return match ? Number(match[1]) * 1000 : null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function acquire(
  action: AppCheckAction,
  config: FirebaseWebConfig,
  key: string,
  deps: AppCheckDeps,
  now: () => number
): Promise<string | null> {
  try {
    const fetchImpl = deps.fetchImpl ?? ((...args) => fetch(...args));
    const getRecaptcha = deps.getRecaptchaToken ?? defaultRecaptchaToken;
    return await withTimeout(
      (async () => {
        const recaptchaToken = await getRecaptcha(key, action);
        const response = await fetchImpl(
          `${EXCHANGE_BASE}/v1/projects/${config.projectId}/apps/${config.appId}:exchangeRecaptchaEnterpriseToken?key=${config.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recaptchaEnterpriseToken: recaptchaToken }),
          }
        );
        if (!response.ok) return null;
        const json = (await response.json()) as {
          token?: unknown;
          ttl?: unknown;
        };
        const ttlMs = parseTtlMs(json.ttl);
        if (typeof json.token !== "string" || !json.token || ttlMs === null) {
          return null;
        }
        cached = { token: json.token, expiresAt: now() + ttlMs };
        return json.token;
      })(),
      deps.timeoutMs ?? TIMEOUT_MS
    );
  } catch {
    return null;
  }
}

/**
 * An App Check token for a Firestore request, or null. Never throws. Cached
 * until ~5 minutes before expiry; concurrent callers share one request.
 */
export async function getAppCheckToken(
  action: AppCheckAction,
  deps: AppCheckDeps = {}
): Promise<string | null> {
  try {
    const config = deps.config ?? firebaseConfig;
    const key = config.recaptchaSiteKey;
    if (!key || !config.apiKey || !config.appId) return null;
    if (!canUseAppCheck((deps.getEnv ?? browserEnv)())) return null;

    const now = deps.now ?? Date.now;
    if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > now()) {
      return cached.token;
    }
    if (deps.cachedOnly) return null;

    inFlight ??= acquire(action, config, key, deps, now).finally(() => {
      inFlight = null;
    });
    return await inFlight;
  } catch {
    return null;
  }
}

/** `{ "X-Firebase-AppCheck": token }`, or `{}` when there is no token. */
export async function appCheckHeaders(
  action: AppCheckAction,
  deps: AppCheckDeps = {}
): Promise<Record<string, string>> {
  const token = await getAppCheckToken(action, deps);
  return token ? { [APP_CHECK_HEADER]: token } : {};
}
