import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import {
  awayTooLong,
  checkPin,
  clearHidden,
  clearLock,
  createLock,
  fromBase64,
  HIDDEN_KEY,
  isValidPin,
  loadLock,
  lockKey,
  markHidden,
  MAX_FAILS,
  PIN_ITERATIONS,
  pinMatches,
  readHidden,
  sameBytes,
  saveLock,
  type LockRecord,
} from "@/lib/jim/appLock";

// jsdom has neither; the browser's are the same API.
Object.defineProperty(globalThis.crypto, "subtle", {
  value: webcrypto.subtle,
  configurable: true,
});
Object.assign(globalThis, { TextEncoder });

const UID = "uid-1";
/** Fewer rounds than the real lock, to keep the tests quick. */
const FAST = 1_000;

async function setLock(pin = "1234", after = 0): Promise<LockRecord> {
  const record = await createLock(pin, after, FAST);
  saveLock(UID, record);
  return record;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("PINs", () => {
  it("takes 4 to 8 digits only", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("12345678")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("123456789")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
    expect(isValidPin("")).toBe(false);
  });

  it("stores a PBKDF2 hash with a 16-byte salt, never the PIN", async () => {
    const record = await createLock("4821", 60);
    expect(record).toMatchObject({
      v: 1,
      iterations: PIN_ITERATIONS,
      after: 60,
      fails: 0,
      lockedUntil: 0,
    });
    expect(PIN_ITERATIONS).toBe(310_000);
    expect(fromBase64(record.salt)).toHaveLength(16);
    expect(fromBase64(record.hash)).toHaveLength(32);
    expect(JSON.stringify(record)).not.toContain("4821");
    // The same hash the browser would make.
    const expected = await webcrypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: fromBase64(record.salt)!,
        iterations: PIN_ITERATIONS,
      },
      await webcrypto.subtle.importKey(
        "raw",
        new TextEncoder().encode("4821"),
        "PBKDF2",
        false,
        ["deriveBits"]
      ),
      256
    );
    expect(sameBytes(new Uint8Array(expected), fromBase64(record.hash)!)).toBe(
      true
    );
  });

  it("matches the right PIN and not a wrong one", async () => {
    const record = await createLock("1234", 0, FAST);
    expect(await pinMatches(record, "1234")).toBe(true);
    expect(await pinMatches(record, "1235")).toBe(false);
    expect(await pinMatches(record, "12345")).toBe(false);
    expect(await pinMatches(record, "")).toBe(false);
  });

  it("uses a new salt each time a PIN is set", async () => {
    const a = await createLock("1234", 0, FAST);
    const b = await createLock("1234", 0, FAST);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("compares every byte", () => {
    expect(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(
      true
    );
    expect(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(
      false
    );
    expect(sameBytes(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});

describe("the record", () => {
  it("is kept per user under jim:lock:<uid>", async () => {
    const record = await setLock();
    expect(lockKey(UID)).toBe("jim:lock:uid-1");
    expect(loadLock(UID)).toEqual(record);
    expect(loadLock("someone-else")).toBeNull();
  });

  it("fails closed when it can't be read: still locked, no PIN matches", async () => {
    window.localStorage.setItem(lockKey(UID), "{not json");
    const record = loadLock(UID);
    expect(record).not.toBeNull();
    expect(await pinMatches(record!, "1234")).toBe(false);
  });

  it("is wiped for one user, or for everyone on sign-out", async () => {
    await setLock();
    saveLock("other", await createLock("9999", 0, FAST));
    window.localStorage.setItem("jim:speed", "1.5");
    markHidden(5);
    clearLock("other");
    expect(loadLock("other")).toBeNull();
    expect(loadLock(UID)).not.toBeNull();
    saveLock("other", await createLock("9999", 0, FAST));
    clearLock();
    expect(loadLock(UID)).toBeNull();
    expect(loadLock("other")).toBeNull();
    expect(window.sessionStorage.getItem(HIDDEN_KEY)).toBeNull();
    expect(window.localStorage.getItem("jim:speed")).toBe("1.5");
  });

  it("survives blocked storage", () => {
    const spy = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(loadLock(UID)).toBeNull();
    expect(readHidden()).toBeNull();
    spy.mockRestore();
    const set = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("full");
      });
    expect(() => markHidden(1)).not.toThrow();
    set.mockRestore();
  });
});

describe("attempt limits", () => {
  const NOW = 1_800_000_000_000;

  it("a right PIN passes and clears the count", async () => {
    await setLock();
    expect(await checkPin(UID, "0000", NOW)).toMatchObject({
      kind: "wrong",
      attemptsLeft: 9,
    });
    expect(loadLock(UID)?.fails).toBe(1);
    expect(await checkPin(UID, "1234", NOW)).toEqual({ kind: "ok" });
    expect(loadLock(UID)).toMatchObject({ fails: 0, lockedUntil: 0 });
  });

  it("waits 30 s after 5 wrong, 5 min after 8, and wipes after 10", async () => {
    await setLock();
    let now = NOW;
    for (let i = 1; i <= 4; i++) {
      expect(await checkPin(UID, "0000", now)).toEqual({
        kind: "wrong",
        attemptsLeft: MAX_FAILS - i,
        waitUntil: 0,
      });
    }
    expect(await checkPin(UID, "0000", now)).toEqual({
      kind: "wrong",
      attemptsLeft: 5,
      waitUntil: now + 30_000,
    });
    // During the wait not even the right PIN is checked.
    expect(await checkPin(UID, "1234", now + 29_000)).toEqual({
      kind: "wait",
      until: now + 30_000,
    });
    expect(loadLock(UID)?.fails).toBe(5);
    for (const i of [6, 7]) {
      now += 30_000;
      expect(await checkPin(UID, "0000", now)).toMatchObject({
        attemptsLeft: MAX_FAILS - i,
        waitUntil: now + 30_000,
      });
    }
    for (const i of [8, 9]) {
      now += 30_000 * 10;
      expect(await checkPin(UID, "0000", now)).toMatchObject({
        attemptsLeft: MAX_FAILS - i,
        waitUntil: now + 300_000,
      });
    }
    now += 300_000;
    expect(await checkPin(UID, "0000", now)).toEqual({ kind: "wipe" });
    // Even the right PIN can't come back from there.
    expect(await checkPin(UID, "1234", now + 10 ** 9)).toEqual({
      kind: "wipe",
    });
  });

  it("keeps the count and the wait through a reload", async () => {
    await setLock();
    for (let i = 0; i < 5; i++) await checkPin(UID, "0000", NOW);
    // A reload reads the same record.
    const reloaded = JSON.parse(
      window.localStorage.getItem(lockKey(UID)) ?? "{}"
    ) as LockRecord;
    expect(reloaded).toMatchObject({ fails: 5, lockedUntil: NOW + 30_000 });
    expect(await checkPin(UID, "1234", NOW + 1_000)).toMatchObject({
      kind: "wait",
    });
  });

  it("counts the attempt before the hash is done", async () => {
    await setLock();
    const pending = checkPin(UID, "0000", NOW);
    expect(loadLock(UID)?.fails).toBe(1);
    await pending;
  });

  it("says when there is no lock", async () => {
    expect(await checkPin(UID, "1234", NOW)).toEqual({ kind: "missing" });
  });
});

describe("time away", () => {
  it("locks once away for `after` seconds or more", () => {
    expect(awayTooLong(null, 10_000, 0)).toBe(false);
    expect(awayTooLong(0, 0, 0)).toBe(true);
    expect(awayTooLong(0, 59_999, 60)).toBe(false);
    expect(awayTooLong(0, 60_000, 60)).toBe(true);
    // A clock that went backwards locks.
    expect(awayTooLong(10_000, 5_000, 900)).toBe(true);
  });

  it("keeps the hidden time in sessionStorage", () => {
    markHidden(1234);
    expect(readHidden()).toBe(1234);
    clearHidden();
    expect(readHidden()).toBeNull();
  });
});
