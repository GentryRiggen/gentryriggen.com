import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import {
  awayTooLong,
  checkPin,
  clearHidden,
  clearLock,
  clearWipePending,
  createLock,
  fromBase64,
  HIDDEN_KEY,
  isValidPin,
  isWipePending,
  markWipePending,
  loadLock,
  lockKey,
  markHidden,
  MAX_FAILS,
  PIN_ITERATIONS,
  pinMatches,
  readHidden,
  sameBytes,
  saveLock,
  waitEnds,
  WIPE_KEY,
  type LockRecord,
  hasJimData,
  idleLimitMs,
  loadLockState,
  markLockOffIfAbsent,
  saveLockState,
} from "@/lib/jim/appLock";
import { historyKey } from "@/lib/jim/history";
import {
  clearAll,
  lockStateKey,
  setOfflineBackend,
  viewKey,
  type KeyValueStore,
} from "@/lib/jim/offlineStore";

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
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(loadLock(UID)?.fails).toBe(1);
    await pending;
  });

  it("counts checks made at the same time one by one", async () => {
    await setLock();
    const results = await Promise.all([
      checkPin(UID, "0000", NOW),
      checkPin(UID, "0001", NOW),
      checkPin(UID, "0002", NOW),
    ]);
    expect(results.map((r) => r.kind === "wrong" && r.attemptsLeft)).toEqual([
      9, 8, 7,
    ]);
    expect(loadLock(UID)?.fails).toBe(3);
  });

  it("a clock set backwards doesn't end a wait early", async () => {
    await setLock();
    for (let i = 0; i < 5; i++) await checkPin(UID, "0000", NOW);
    expect(loadLock(UID)).toMatchObject({
      lastFail: NOW,
      lockedUntil: NOW + 30_000,
    });
    // An hour back: the wait starts over from the new now.
    const back = NOW - 3_600_000;
    expect(await checkPin(UID, "1234", back)).toEqual({
      kind: "wait",
      until: back + 30_000,
    });
    expect(loadLock(UID)).toMatchObject({
      lastFail: back,
      lockedUntil: back + 30_000,
    });
    // Once it has passed by the new clock, PINs are checked again.
    expect(await checkPin(UID, "1234", back + 30_000)).toEqual({ kind: "ok" });
  });

  it("a wait longer than any penalty (clock moved) is cut to the penalty", () => {
    const base = {
      v: 1 as const,
      salt: "",
      iterations: 1,
      hash: "",
      after: 0,
      fails: 5,
      lastFail: NOW,
    };
    expect(waitEnds({ ...base, lockedUntil: NOW + 30_000 }, NOW + 1)).toBe(
      NOW + 30_000
    );
    expect(waitEnds({ ...base, lockedUntil: NOW + 10 ** 9 }, NOW)).toBe(
      NOW + 30_000
    );
    expect(waitEnds({ ...base, lockedUntil: NOW + 30_000 }, NOW - 5)).toBe(
      NOW - 5 + 30_000
    );
    expect(waitEnds({ ...base, fails: 2, lockedUntil: 0 }, NOW)).toBe(0);
  });

  it("says when there is no lock", async () => {
    expect(await checkPin(UID, "1234", NOW)).toEqual({ kind: "missing" });
  });
});

describe("the PIN's length", () => {
  const NOW = 1_800_000_000_000;

  it("is kept with the hash when a PIN is set", async () => {
    expect((await createLock("1234", 0, FAST)).length).toBe(4);
    expect((await createLock("86420", 0, FAST)).length).toBe(5);
    await setLock("2468013");
    expect(loadLock(UID)?.length).toBe(7);
  });

  it("is read back only when it is a PIN's length", () => {
    const base = { v: 1, salt: "", iterations: 1, hash: "", after: 0 };
    for (const [length, kept] of [
      [4, 4],
      [8, 8],
      [3, undefined],
      [9, undefined],
      [4.5, undefined],
      ["4", undefined],
    ] as const) {
      window.localStorage.setItem(
        lockKey(UID),
        JSON.stringify({ ...base, length })
      );
      expect(loadLock(UID)?.length).toBe(kept);
    }
  });

  it("is added to an older lock by a right PIN, never by a wrong one", async () => {
    const { length: _drop, ...older } = await createLock("123456", 0, FAST);
    void _drop;
    saveLock(UID, older);
    expect(loadLock(UID)?.length).toBeUndefined();
    await checkPin(UID, "000000", NOW);
    expect(loadLock(UID)?.length).toBeUndefined();
    expect(await checkPin(UID, "123456", NOW)).toEqual({ kind: "ok" });
    expect(loadLock(UID)?.length).toBe(6);
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

  it("also counts time away on the monotonic clock", () => {
    // The wall clock says a second; performance.now() says a minute.
    expect(awayTooLong(0, 1_000, 60, 60_000)).toBe(true);
    expect(awayTooLong(0, 1_000, 60, 59_000)).toBe(false);
    expect(awayTooLong(null, 0, 60, 60_000)).toBe(true);
    // Either one is enough.
    expect(awayTooLong(0, 60_000, 60, 1_000)).toBe(true);
  });

  it("keeps the hidden time in sessionStorage", () => {
    markHidden(1234);
    expect(readHidden()).toBe(1234);
    clearHidden();
    expect(readHidden()).toBeNull();
  });
});

describe("the wipe marker", () => {
  it("is set, read and cleared, apart from the lock records", async () => {
    await setLock();
    expect(isWipePending()).toBe(false);
    markWipePending();
    expect(isWipePending()).toBe(true);
    expect(window.localStorage.getItem(WIPE_KEY)).not.toBeNull();
    // Wiping the locks leaves the marker for its own step.
    clearLock();
    expect(isWipePending()).toBe(true);
    clearWipePending();
    expect(isWipePending()).toBe(false);
  });
});

/** A Map standing in for IndexedDB. */
function memoryStore(): KeyValueStore & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, value);
    },
    clear: async () => map.clear(),
  };
}

describe("the lock-on marker (IndexedDB)", () => {
  afterEach(() => setOfflineBackend(null));

  it("is missing until written, then on or off; sign-out wipes it", async () => {
    const store = memoryStore();
    setOfflineBackend(store);
    expect(await loadLockState(UID)).toBe("missing");
    expect(await saveLockState(UID, true)).toBe(true);
    expect(store.map.get(lockStateKey(UID))).toBe(true);
    expect(lockStateKey(UID)).toBe(`lockOn:${UID}`);
    expect(await loadLockState(UID)).toBe("on");
    await saveLockState(UID, false);
    expect(await loadLockState(UID)).toBe("off");
    // Another user's marker is their own.
    expect(await loadLockState("uid-2")).toBe("missing");
    await clearAll();
    expect(await loadLockState(UID)).toBe("missing");
  });

  it("reads a damaged entry as on (fails closed)", async () => {
    const store = memoryStore();
    setOfflineBackend(store);
    store.map.set(lockStateKey(UID), "junk");
    expect(await loadLockState(UID)).toBe("on");
    store.map.set(lockStateKey(UID), 0);
    expect(await loadLockState(UID)).toBe("on");
  });

  it("tries a failed read once more, then says missing", async () => {
    let calls = 0;
    const flaky: KeyValueStore = {
      get: async () => {
        calls += 1;
        if (calls === 1) throw new Error("timed out");
        return true;
      },
      set: async () => {},
      clear: async () => {},
    };
    setOfflineBackend(flaky);
    expect(await loadLockState(UID)).toBe("on");
    const broken: KeyValueStore = {
      get: async () => {
        throw new Error("blocked");
      },
      set: async () => {
        throw new Error("blocked");
      },
      clear: async () => {},
    };
    setOfflineBackend(broken);
    expect(await loadLockState(UID)).toBe("missing");
    expect(await saveLockState(UID, false)).toBe(false);
    await expect(markLockOffIfAbsent(UID)).resolves.toBeUndefined();
  });

  it("a fresh sign-in writes off only when nothing is written", async () => {
    const store = memoryStore();
    setOfflineBackend(store);
    await markLockOffIfAbsent(UID);
    expect(await loadLockState(UID)).toBe("off");
    await saveLockState(UID, true);
    await markLockOffIfAbsent(UID);
    expect(await loadLockState(UID)).toBe("on");
  });

  it("knows whether the device keeps Jim data: the chat or Notes", async () => {
    const store = memoryStore();
    setOfflineBackend(store);
    expect(await hasJimData(UID)).toBe(false);
    window.localStorage.setItem(historyKey(UID), "[]");
    expect(await hasJimData(UID)).toBe(true);
    window.localStorage.removeItem(historyKey(UID));
    store.map.set(viewKey(UID), { payload: {}, savedAt: 1 });
    expect(await hasJimData(UID)).toBe(true);
    expect(await hasJimData("uid-2")).toBe(false);
  });
});

describe("the idle lock", () => {
  it("waits the lock-after time, but never less than five minutes", () => {
    expect(idleLimitMs(0)).toBe(300_000);
    expect(idleLimitMs(60)).toBe(300_000);
    expect(idleLimitMs(300)).toBe(300_000);
    expect(idleLimitMs(900)).toBe(900_000);
  });
});
