/**
 * The app lock: a PIN (and, optionally, Face ID) in front of the chat on this
 * device. The PIN itself is never stored, only a salted PBKDF2-SHA-256 hash of
 * it, one record per signed-in user under `jim:lock:<uid>`, wiped on sign-out.
 *
 * This keeps a borrowed (unlocked) phone out of Jim. It is not a defense
 * against someone with the device's storage in hand: they could delete the
 * record, but they would still need the Firebase sign-in to reach the server.
 */

/** Stored record, version 1. */
export interface LockRecord {
  v: 1;
  /** 16 random bytes, base64. */
  salt: string;
  iterations: number;
  /** PBKDF2-SHA-256 of the PIN, 32 bytes, base64. */
  hash: string;
  /** Seconds away before it locks; 0 locks as soon as the app is left. */
  after: number;
  /** Wrong PINs in a row (counted before each check, cleared by a right one). */
  fails: number;
  /** Epoch ms before which no PIN is checked; 0 when there is no wait. */
  lockedUntil: number;
  /** Face ID: the platform credential's id, base64url. */
  credential?: string;
}

export const PIN_MIN = 4;
export const PIN_MAX = 8;
export const PIN_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

/** Wrong PINs in a row before this device is signed out and wiped. */
export const MAX_FAILS = 10;

export const LOCK_AFTER_CHOICES: readonly { seconds: number; label: string }[] =
  [
    { seconds: 0, label: "Immediately" },
    { seconds: 60, label: "1 minute" },
    { seconds: 300, label: "5 minutes" },
    { seconds: 900, label: "15 minutes" },
  ];

const PREFIX = "jim:lock:";
/** When the page was last hidden (sessionStorage), for the lock-after check. */
export const HIDDEN_KEY = "jim:lock-hidden";

export function lockKey(uid: string): string {
  return `${PREFIX}${uid}`;
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);
}

/** How long to wait after the `fails`-th wrong PIN in a row. */
export function penaltyMs(fails: number): number {
  if (fails >= 8) return 5 * 60_000;
  if (fails >= 5) return 30_000;
  return 0;
}

function local(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const raw = atob(text);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function knownAfter(value: unknown): number {
  return LOCK_AFTER_CHOICES.some((c) => c.seconds === value)
    ? (value as number)
    : 0;
}

/**
 * This user's lock, or null when none is set. A record that can't be read
 * fails closed: it still locks, no PIN matches it, and "Forgot PIN?" (sign
 * out) is the way out.
 */
export function loadLock(uid: string): LockRecord | null {
  let raw: string | null;
  try {
    raw = local()?.getItem(lockKey(uid)) ?? null;
  } catch {
    return null;
  }
  if (raw === null) return null;
  let value: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      value = parsed as Record<string, unknown>;
    }
  } catch {
    // Unreadable: the empty record below matches no PIN.
  }
  const valid = value.v === 1;
  return {
    v: 1,
    salt: valid && typeof value.salt === "string" ? value.salt : "",
    iterations: count(value.iterations),
    hash: valid && typeof value.hash === "string" ? value.hash : "",
    after: knownAfter(value.after),
    fails: count(value.fails),
    lockedUntil: count(value.lockedUntil),
    ...(valid && typeof value.credential === "string" && value.credential
      ? { credential: value.credential }
      : {}),
  };
}

/** Writes the record; false when storage refused it. */
export function saveLock(uid: string, record: LockRecord): boolean {
  try {
    const store = local();
    if (!store) return false;
    store.setItem(lockKey(uid), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/** Wipes this user's lock, or with no uid every lock kept on the device. */
export function clearLock(uid?: string): void {
  clearHidden();
  const store = local();
  if (!store) return;
  try {
    if (uid !== undefined) {
      store.removeItem(lockKey(uid));
      return;
    }
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  } catch {
    // Blocked storage holds nothing to wipe.
  }
}

/** WebCrypto is there (it needs a secure context: https or localhost). */
export function pinSupported(): boolean {
  return (
    typeof globalThis.crypto?.subtle?.deriveBits === "function" &&
    typeof TextEncoder === "function"
  );
}

export async function hashPin(
  pin: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<Uint8Array<ArrayBuffer>> {
  const { subtle } = globalThis.crypto;
  const key = await subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    HASH_BYTES * 8
  );
  return new Uint8Array(bits);
}

/** Compares every byte, whatever the first difference, so timing says nothing. */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** A fresh record for `pin`, with a new salt. */
export async function createLock(
  pin: string,
  after: number,
  iterations: number = PIN_ITERATIONS
): Promise<LockRecord> {
  if (!isValidPin(pin)) throw new Error("invalid PIN");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await hashPin(pin, salt, iterations);
  return {
    v: 1,
    salt: toBase64(salt),
    iterations,
    hash: toBase64(hash),
    after: knownAfter(after),
    fails: 0,
    lockedUntil: 0,
  };
}

/** Whether `pin` is the one `record` was made from. */
export async function pinMatches(
  record: LockRecord,
  pin: string
): Promise<boolean> {
  const salt = fromBase64(record.salt);
  const expected = fromBase64(record.hash);
  if (
    !isValidPin(pin) ||
    !salt ||
    salt.length !== SALT_BYTES ||
    !expected ||
    expected.length !== HASH_BYTES ||
    record.iterations < 1
  ) {
    return false;
  }
  return sameBytes(await hashPin(pin, salt, record.iterations), expected);
}

export type PinCheck =
  | { kind: "ok" }
  | { kind: "wrong"; attemptsLeft: number; waitUntil: number }
  | { kind: "wait"; until: number }
  /** Too many wrong PINs: sign out and wipe the device. */
  | { kind: "wipe" }
  /** No lock is set (it was wiped meanwhile). */
  | { kind: "missing" };

/**
 * Checks a PIN against this user's lock, with the attempt limits. The wrong
 * attempt is counted (and its wait written) before the hash is worked out, so
 * closing the app mid-check can't skip the count; a right PIN clears it.
 */
export async function checkPin(
  uid: string,
  pin: string,
  now: number = Date.now()
): Promise<PinCheck> {
  const record = loadLock(uid);
  if (!record) return { kind: "missing" };
  if (record.fails >= MAX_FAILS) return { kind: "wipe" };
  if (record.lockedUntil > now)
    return { kind: "wait", until: record.lockedUntil };
  const fails = record.fails + 1;
  const wait = penaltyMs(fails);
  const counted: LockRecord = {
    ...record,
    fails,
    lockedUntil: wait > 0 ? now + wait : 0,
  };
  saveLock(uid, counted);
  if (await pinMatches(record, pin)) {
    // Re-read: settings may have changed while hashing.
    const latest = loadLock(uid) ?? counted;
    saveLock(uid, { ...latest, fails: 0, lockedUntil: 0 });
    return { kind: "ok" };
  }
  if (fails >= MAX_FAILS) return { kind: "wipe" };
  return {
    kind: "wrong",
    attemptsLeft: MAX_FAILS - fails,
    waitUntil: counted.lockedUntil,
  };
}

/** Notes when the page was hidden (the earliest, if hidden twice). */
export function markHidden(at: number): void {
  try {
    const store = session();
    if (store && store.getItem(HIDDEN_KEY) === null) {
      store.setItem(HIDDEN_KEY, String(at));
    }
  } catch {
    // Memory still has it.
  }
}

export function readHidden(): number | null {
  try {
    const raw = session()?.getItem(HIDDEN_KEY) ?? null;
    if (raw === null) return null;
    const at = Number(raw);
    return Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
}

export function clearHidden(): void {
  try {
    session()?.removeItem(HIDDEN_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Away long enough to lock: `after` seconds or more. A clock that went
 * backwards while away locks too.
 */
export function awayTooLong(
  hiddenAt: number | null,
  now: number,
  after: number
): boolean {
  if (hiddenAt === null) return false;
  return now < hiddenAt || now - hiddenAt >= after * 1000;
}
