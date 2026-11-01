import { normalizeView, type ViewData } from "@/lib/jim/view";

/**
 * The last Notes payload kept on this device, so Notes opens without
 * signal. IndexedDB `jim`, store `kv`, one entry per signed-in user
 * (`view:<uid>`), wiped on sign-out. Every call is best effort: blocked or
 * missing storage just means nothing is kept.
 */

export interface SavedView {
  payload: ViewData;
  /** When it was saved (Date.now()). */
  savedAt: number;
}

/** The few operations the store needs; IndexedDB in the page, a Map in tests. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = "jim";
const STORE = "kv";

export function viewKey(uid: string): string {
  return `view:${uid}`;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * iOS WebKit can leave an IndexedDB open or request without any event until
 * the app goes to the background and back. Nothing may wait on it forever:
 * Notes would sit on its skeleton. A stuck call fails after this.
 */
export const IDB_TIMEOUT_MS = 2000;

function timed<T>(promise: Promise<T>, onTimeout?: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error("IndexedDB timed out"));
    }, IDB_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  }).catch((err: unknown) => {
    // Try again next time (private mode can refuse once, then allow).
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

async function run<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const opening = openDb();
  // A stuck open is dropped, so the next call opens afresh.
  const db = await timed(opening, () => {
    if (dbPromise === opening) dbPromise = null;
  });
  return timed(request(op(db.transaction(STORE, mode).objectStore(STORE))));
}

const indexedDbStore: KeyValueStore = {
  get: (key) => run("readonly", (s) => s.get(key)),
  set: async (key, value) => {
    await run("readwrite", (s) => s.put(value, key));
  },
  clear: async () => {
    await run("readwrite", (s) => s.clear());
  },
};

let backend: KeyValueStore | null = null;

function store(): KeyValueStore | null {
  if (backend) return backend;
  return typeof indexedDB === "undefined" ? null : indexedDbStore;
}

/** Tests swap in their own store; null goes back to IndexedDB. */
export function setOfflineBackend(next: KeyValueStore | null): void {
  backend = next;
}

/** Keeps this payload as the user's last good one. */
export async function saveView(uid: string, payload: ViewData): Promise<void> {
  try {
    await store()?.set(viewKey(uid), { payload, savedAt: Date.now() });
  } catch {
    // Full or blocked: Notes still works online.
  }
}

/** The user's last good payload, or null when none (or it doesn't parse). */
export async function loadView(uid: string): Promise<SavedView | null> {
  let raw: unknown;
  try {
    raw = await store()?.get(viewKey(uid));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const { payload, savedAt } = raw as Record<string, unknown>;
  const data = normalizeView(payload);
  if (!data || typeof savedAt !== "number") return null;
  return { payload: data, savedAt };
}

/** Wipes everything kept for every user (sign-out on a lent phone). */
export async function clearAll(): Promise<void> {
  try {
    await store()?.clear();
  } catch {
    // Blocked storage holds nothing to wipe.
  }
}
