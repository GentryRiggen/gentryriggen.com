"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  awayTooLong,
  checkPin,
  clearHidden,
  clearLock,
  createLock,
  loadLock,
  markHidden,
  readHidden,
  saveLock,
  waitEnds,
  type LockRecord,
  type PinCheck,
} from "@/lib/jim/appLock";
import {
  faceIdAvailable,
  registerFaceId,
  verifyFaceId,
} from "@/lib/jim/faceId";

export interface AppLock {
  /** A PIN is set for this user on this device. */
  enabled: boolean;
  /** The app is locked: nothing of it may be drawn. */
  locked: boolean;
  /** Seconds away before it locks (0: as soon as the app is left). */
  after: number;
  /** No PIN is checked before this (epoch ms; 0 for none). */
  lockedUntil: number;
  /** Face ID is set up for this lock. */
  faceId: boolean;
  /** This device can do Face ID (or another platform authenticator). */
  faceIdSupported: boolean;
  lockNow: () => void;
  /** Squares a wrong-PIN wait with a clock that moved (the lock screen opens). */
  settleWait: () => void;
  /** Checks a PIN (with the attempt limits); a right one does not unlock. */
  verify: (pin: string) => Promise<PinCheck>;
  /** Checks a PIN and unlocks when it is right. */
  unlockWithPin: (pin: string) => Promise<PinCheck>;
  /** Asks for Face ID; true once it unlocked. */
  unlockWithFaceId: () => Promise<boolean>;
  /** Sets a new lock; false when it couldn't be kept on this device. */
  turnOn: (pin: string, after: number) => Promise<boolean>;
  changePin: (pin: string) => Promise<boolean>;
  setAfter: (seconds: number) => void;
  /** Sets Face ID up (call from a tap); true once it is on. */
  enableFaceId: () => Promise<boolean>;
  /** Forgets this lock's Face ID credential. */
  disableFaceId: () => void;
  turnOff: () => void;
}

/**
 * The app lock for the signed-in user: whether it is set and locked, and
 * the locking itself. It starts locked whenever a lock is set (a cold start,
 * a reload, a new sign-in), and locks again when the app is left for
 * `after` seconds or more. With `after` 0 it locks the moment the page is
 * hidden, synchronously, so the app switcher's snapshot shows the lock
 * screen and not the chat.
 */
export default function useAppLock(uid: string | null): AppLock {
  /** Bumped after each write, to read the record again. */
  const [version, setVersion] = useState(0);
  const record = useMemo<LockRecord | null>(
    () => (uid && version >= 0 ? loadLock(uid) : null),
    [uid, version]
  );
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  /** The user unlocked in this page; anyone else (or no one) is locked. */
  const [unlockedFor, setUnlockedFor] = useState<string | null>(null);
  const [faceIdSupported, setFaceIdSupported] = useState(false);

  const enabled = record !== null;
  const locked = enabled && unlockedFor !== uid;
  const after = record?.after ?? 0;

  const afterRef = useRef(after);
  useLayoutEffect(() => {
    afterRef.current = after;
  });

  useEffect(() => {
    let alive = true;
    void faceIdAvailable().then((ok) => {
      if (alive) setFaceIdSupported(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!uid || !enabled) return;
    // A time left over from before a reload means nothing: a reload locks.
    clearHidden();
    let hiddenAt: number | null = null;
    /** performance.now() when hidden: immune to the wall clock moving. */
    let hiddenTick: number | null = null;

    function lock() {
      // Drawn before the page is gone, for the app switcher's snapshot.
      flushSync(() => setUnlockedFor(null));
    }
    function onHide() {
      if (hiddenAt !== null) return;
      hiddenAt = Date.now();
      hiddenTick = performance.now();
      markHidden(hiddenAt);
      if (afterRef.current === 0) lock();
    }
    function onShow() {
      const at = hiddenAt ?? readHidden();
      const away = hiddenTick === null ? null : performance.now() - hiddenTick;
      hiddenAt = null;
      hiddenTick = null;
      clearHidden();
      if (awayTooLong(at, Date.now(), afterRef.current, away)) lock();
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") onHide();
      else onShow();
    }
    function onPageShow(event: PageTransitionEvent) {
      // Back from the back-forward cache: the page was away all along.
      if (event.persisted) onShow();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [uid, enabled]);

  const lockNow = useCallback(() => setUnlockedFor(null), []);

  const settleWait = useCallback(() => {
    const current = uid ? loadLock(uid) : null;
    if (!uid || !current) return;
    // A wait read against a clock set backwards starts over (never ends
    // early, never lasts a year), and is kept so, to count it once.
    const now = Date.now();
    const ends = waitEnds(current, now);
    if (ends > now && ends !== current.lockedUntil) {
      saveLock(uid, { ...current, lockedUntil: ends, lastFail: now });
      refresh();
    }
  }, [uid, refresh]);

  const verify = useCallback(
    async (pin: string): Promise<PinCheck> => {
      if (!uid) return { kind: "missing" };
      const result = await checkPin(uid, pin);
      refresh();
      return result;
    },
    [uid, refresh]
  );

  const unlockWithPin = useCallback(
    async (pin: string): Promise<PinCheck> => {
      const result = await verify(pin);
      if (result.kind === "ok" && uid) setUnlockedFor(uid);
      return result;
    },
    [uid, verify]
  );

  const unlockWithFaceId = useCallback(async (): Promise<boolean> => {
    const credential = uid ? loadLock(uid)?.credential : undefined;
    if (!uid || !credential) return false;
    if (!(await verifyFaceId(credential))) return false;
    // The owner is back: the wrong-PIN count starts over.
    const latest = loadLock(uid);
    if (latest) {
      saveLock(uid, { ...latest, fails: 0, lockedUntil: 0, lastFail: 0 });
    }
    setUnlockedFor(uid);
    refresh();
    return true;
  }, [uid, refresh]);

  const turnOn = useCallback(
    async (pin: string, seconds: number): Promise<boolean> => {
      if (!uid) return false;
      const next = await createLock(pin, seconds);
      if (!saveLock(uid, next)) return false;
      // Setting it up is not a reason to lock right now.
      setUnlockedFor(uid);
      refresh();
      return true;
    },
    [uid, refresh]
  );

  const changePin = useCallback(
    async (pin: string): Promise<boolean> => {
      const current = uid ? loadLock(uid) : null;
      if (!uid || !current) return false;
      const next = await createLock(pin, current.after);
      const kept = current.credential
        ? { ...next, credential: current.credential }
        : next;
      const saved = saveLock(uid, kept);
      refresh();
      return saved;
    },
    [uid, refresh]
  );

  const setAfter = useCallback(
    (seconds: number) => {
      const current = uid ? loadLock(uid) : null;
      if (!uid || !current) return;
      saveLock(uid, { ...current, after: seconds });
      refresh();
    },
    [uid, refresh]
  );

  const enableFaceId = useCallback(async (): Promise<boolean> => {
    if (!uid || !loadLock(uid)) return false;
    const credential = await registerFaceId(uid, loadLock(uid)?.credential);
    const current = loadLock(uid);
    if (!credential || !current) return false;
    const saved = saveLock(uid, { ...current, credential });
    refresh();
    return saved;
  }, [uid, refresh]);

  const disableFaceId = useCallback(() => {
    const current = uid ? loadLock(uid) : null;
    if (!uid || !current) return;
    const { credential: _old, ...rest } = current;
    void _old;
    saveLock(uid, rest);
    refresh();
  }, [uid, refresh]);

  const turnOff = useCallback(() => {
    if (!uid) return;
    clearLock(uid);
    refresh();
  }, [uid, refresh]);

  return {
    enabled,
    locked,
    after,
    lockedUntil: record?.lockedUntil ?? 0,
    settleWait,
    faceId: Boolean(record?.credential),
    faceIdSupported,
    lockNow,
    verify,
    unlockWithPin,
    unlockWithFaceId,
    turnOn,
    changePin,
    setAfter,
    enableFaceId,
    disableFaceId,
    turnOff,
  };
}
