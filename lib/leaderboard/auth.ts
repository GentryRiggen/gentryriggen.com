import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase/config";
import type { FirebaseWebConfig } from "@/lib/firebase/config";

export const AUTH_STORAGE_KEY = "plane-builder:lb-auth";
const SIGN_UP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:signUp";
const REFRESH_URL = "https://securetoken.googleapis.com/v1/token";
/** Refresh this long before the token really expires. */
const EXPIRY_MARGIN_MS = 60_000;

export interface AuthSession {
  uid: string;
  idToken: string;
}

type TokenStorage = Pick<Storage, "getItem" | "setItem">;

export interface AuthDeps {
  /**
   * Where the refresh token lives. Each game that signs in keeps its own
   * anonymous account (and in-memory token), so its uid is not shared.
   */
  storageKey?: string;
  config?: FirebaseWebConfig;
  fetchImpl?: typeof fetch;
  storage?: TokenStorage | null;
  now?: () => number;
}

interface ResolvedDeps {
  storageKey: string;
  config: FirebaseWebConfig;
  fetchImpl: typeof fetch;
  storage: TokenStorage | null;
  now: () => number;
}

interface CachedToken extends AuthSession {
  expiresAt: number;
}

interface StoredAuth {
  uid: string;
  refreshToken: string;
}

const cachedByKey = new Map<string, CachedToken>();
const inFlightByKey = new Map<string, Promise<AuthSession | null>>();

/** Test hook: forget the in-memory tokens. */
export function resetAuthCache(): void {
  cachedByKey.clear();
  inFlightByKey.clear();
}

function defaultStorage(): TokenStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readStored(
  storage: TokenStorage | null,
  key: string
): StoredAuth | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { uid, refreshToken } = parsed as Record<string, unknown>;
    if (!isNonEmptyString(uid) || !isNonEmptyString(refreshToken)) return null;
    return { uid, refreshToken };
  } catch {
    return null;
  }
}

function writeStored(
  storage: TokenStorage | null,
  key: string,
  value: StoredAuth
): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or a full disk: the token just won't survive a reload.
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  body: string,
  contentType: string
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });
  let json: Record<string, unknown> = {};
  try {
    const parsed: unknown = await response.json();
    if (typeof parsed === "object" && parsed !== null) {
      json = parsed as Record<string, unknown>;
    }
  } catch {
    // Non-JSON error body.
  }
  return { ok: response.ok, status: response.status, json };
}

function remember(
  key: string,
  session: AuthSession,
  expiresInSeconds: unknown,
  now: number
): void {
  const seconds = Number(expiresInSeconds);
  cachedByKey.set(key, {
    ...session,
    expiresAt: now + (Number.isFinite(seconds) ? seconds : 0) * 1000,
  });
}

async function signUp(deps: ResolvedDeps): Promise<AuthSession | null> {
  const res = await postJson(
    deps.fetchImpl,
    `${SIGN_UP_URL}?key=${deps.config.apiKey}`,
    JSON.stringify({ returnSecureToken: true }),
    "application/json"
  );
  const { idToken, refreshToken, localId, expiresIn } = res.json;
  if (
    !res.ok ||
    !isNonEmptyString(idToken) ||
    !isNonEmptyString(refreshToken) ||
    !isNonEmptyString(localId)
  ) {
    return null;
  }
  writeStored(deps.storage, deps.storageKey, { uid: localId, refreshToken });
  const session = { uid: localId, idToken };
  remember(deps.storageKey, session, expiresIn, deps.now());
  return session;
}

async function refresh(
  deps: ResolvedDeps,
  stored: StoredAuth
): Promise<AuthSession | null | "expired"> {
  const res = await postJson(
    deps.fetchImpl,
    `${REFRESH_URL}?key=${deps.config.apiKey}`,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: stored.refreshToken,
    }).toString(),
    "application/x-www-form-urlencoded"
  );
  // A 400 means the refresh token itself is dead (user deleted, revoked).
  if (res.status === 400) return "expired";
  const {
    id_token: idToken,
    refresh_token: refreshToken,
    user_id: userId,
    expires_in: expiresIn,
  } = res.json;
  if (!res.ok || !isNonEmptyString(idToken) || !isNonEmptyString(userId)) {
    return null;
  }
  writeStored(deps.storage, deps.storageKey, {
    uid: userId,
    refreshToken: isNonEmptyString(refreshToken)
      ? refreshToken
      : stored.refreshToken,
  });
  const session = { uid: userId, idToken };
  remember(deps.storageKey, session, expiresIn, deps.now());
  return session;
}

/**
 * An anonymous Firebase id token (signing up the first time, refreshing
 * after). Resolves to null on any failure, including Anonymous sign-in being
 * disabled, so callers can hide leaderboard features.
 */
export async function getIdToken(
  deps: AuthDeps = {}
): Promise<AuthSession | null> {
  const config = deps.config ?? firebaseConfig;
  if (!isFirebaseConfigured(config)) return null;
  const storageKey = deps.storageKey ?? AUTH_STORAGE_KEY;
  const resolved: ResolvedDeps = {
    storageKey,
    config,
    fetchImpl: deps.fetchImpl ?? ((...args) => fetch(...args)),
    storage: deps.storage === undefined ? defaultStorage() : deps.storage,
    now: deps.now ?? Date.now,
  };

  const cached = cachedByKey.get(storageKey);
  if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > resolved.now()) {
    return { uid: cached.uid, idToken: cached.idToken };
  }
  const pending = inFlightByKey.get(storageKey);
  if (pending) return pending;

  const attempt = (async () => {
    try {
      const stored = readStored(resolved.storage, storageKey);
      if (stored) {
        const result = await refresh(resolved, stored);
        if (result !== "expired") return result;
      }
      return await signUp(resolved);
    } catch {
      return null;
    } finally {
      inFlightByKey.delete(storageKey);
    }
  })();
  inFlightByKey.set(storageKey, attempt);
  return attempt;
}
