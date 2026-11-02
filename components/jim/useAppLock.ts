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
  hasJimData,
  idleLimitMs,
  loadLock,
  loadLockState,
  markHidden,
  readHidden,
  saveLock,
  saveLockState,
  waitEnds,
  type LockRecord,
  type LockState,
  type PinCheck,
} from "@/lib/jim/appLock";
import { audioActiveAt, onAudioBusy } from "@/lib/jim/audioActivity";
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
  /**
   * Still reading whether a lock should be there (locked meanwhile, and the
   * lock screen draws nothing).
   */
  checking: boolean;
  /**
   * A lock should be there and its record is gone or unreadable: locked,
   * with no PIN to enter, only "Forgot PIN" (sign out and wipe).
   */
  pinMissing: boolean;
  /** Seconds away before it locks (0: as soon as the app is left). */
  after: number;
  /** No PIN is checked before this (epoch ms; 0 for none). */
  lockedUntil: number;
  /** Face ID is set up for this lock. */
  faceId: boolean;
  /** How many digits the PIN has, when known (it unlocks on the last). */
  pinLength: number | null;
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
  /** Turns the lock off; false (and still on) when that couldn't be kept. */
  turnOff: () => Promise<boolean>;
}

/** What IndexedDB says about one user's lock, once read. */
interface Marker {
  uid: string;
  state: LockState;
  /** Jim data is kept on this device (only looked for when it matters). */
  data: boolean;
}

/**
 * The app lock for the signed-in user: whether it is set and locked, and
 * the locking itself. It starts locked whenever a lock is set (a cold start,
 * a reload, a new sign-in), and locks again when the app is left for
 * `after` seconds or more. With `after` 0 it locks the moment the page is
 * hidden, synchronously, so the app switcher's snapshot shows the lock
 * screen and not the chat. Left open and untouched for
 * `max(after, 5 minutes)` it locks too.
 *
 * It fails closed: with no readable record, it is still locked (with only
 * "Forgot PIN") when IndexedDB says the lock is on, or says nothing while
 * Jim data is kept on the device. A fresh sign-in writes "off" first. This
 * is a screen lock: someone who can edit the browser's storage can read
 * the kept data without it.
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

  const [marker, setMarker] = useState<Marker | null>(null);

  const enabled = record !== null;
  const known = uid !== null && marker?.uid === uid ? marker : null;
  const checking = uid !== null && !enabled && known === null;
  const pinMissing =
    uid !== null &&
    !enabled &&
    known !== null &&
    (known.state === "on" || (known.state === "missing" && known.data));
  const locked = (enabled && unlockedFor !== uid) || checking || pinMissing;
  const after = record?.after ?? 0;

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    void (async () => {
      const state = await loadLockState(uid);
      const data = state === "missing" ? await hasJimData(uid) : false;
      // No lock, nothing kept and nothing written: as good as a fresh
      // sign-in (one whose own write was missed).
      const fresh = state === "missing" && !data && loadLock(uid) === null;
      if (fresh) await saveLockState(uid, false);
      if (alive) setMarker({ uid, state: fresh ? "off" : state, data });
    })();
    return () => {
      alive = false;
      // Signed out (or someone else): what was read no longer holds.
      setMarker(null);
    };
  }, [uid]);

  // A lock set before the marker was kept (or whose write failed) writes it.
  useEffect(() => {
    if (!uid || !enabled || !known || known.state === "on") return;
    let alive = true;
    void saveLockState(uid, true).then((ok) => {
      if (ok && alive) setMarker({ uid, state: "on", data: false });
    });
    return () => {
      alive = false;
    };
  }, [uid, enabled, known]);

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

  // Open and untouched: locks after max(after, 5 minutes) with no input and
  // no audio playing while the page is visible. Time hidden is the
  // time-away rule's to judge, so it is left out; time asleep (a desktop
  // whose tab never went hidden) is not, and is checked on wake.
  useEffect(() => {
    if (!uid || !enabled || locked) return;
    const limit = idleLimitMs(after);
    let timer: ReturnType<typeof setTimeout> | undefined;
    /** Wall-clock time of the last input (or the end of audio). */
    let lastActive = Date.now();
    /** When the page was hidden, so that time is left out. */
    let hiddenAt: number | null = null;

    function check() {
      clearTimeout(timer);
      timer = undefined;
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      // Audio playing counts as being there; counting starts when it ends.
      // Loading counts for at most a minute (a hung request doesn't).
      const audio = audioActiveAt(now);
      if (audio !== null) lastActive = Math.max(lastActive, audio);
      const idle = now - lastActive;
      if (idle >= limit) {
        setUnlockedFor(null);
        return;
      }
      // A clock set backwards waits the full limit, never longer.
      timer = setTimeout(check, Math.min(limit, limit - idle));
    }
    function active() {
      lastActive = Date.now();
      check();
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt ??= Date.now();
        clearTimeout(timer);
        timer = undefined;
        return;
      }
      if (hiddenAt !== null) {
        // Never past now: activity while hidden (audio ending) can't push
        // the idle lock into the future.
        const now = Date.now();
        lastActive = Math.min(lastActive + Math.max(0, now - hiddenAt), now);
        hiddenAt = null;
      }
      check();
    }
    const inputs = ["pointerdown", "keydown", "touchstart", "wheel", "input"];
    const options = { capture: true, passive: true } as const;
    check();
    inputs.forEach((name) => window.addEventListener(name, active, options));
    // Waking from sleep: timers were frozen, the wall clock was not.
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", onVisibility);
    const stopAudio = onAudioBusy((busy) => {
      if (!busy) active();
    });
    return () => {
      clearTimeout(timer);
      inputs.forEach((name) =>
        window.removeEventListener(name, active, options)
      );
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", onVisibility);
      stopAudio();
    };
  }, [uid, enabled, locked, after]);

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
      // A failed write is tried again on the next load, while the record lasts.
      if (await saveLockState(uid, true)) {
        setMarker({ uid, state: "on", data: false });
      }
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

  const turnOff = useCallback(async (): Promise<boolean> => {
    if (!uid) return false;
    // Off in IndexedDB first: a record gone while the marker says on locks.
    if (!(await saveLockState(uid, false))) return false;
    setMarker({ uid, state: "off", data: false });
    clearLock(uid);
    refresh();
    return true;
  }, [uid, refresh]);

  return {
    enabled,
    locked,
    checking,
    pinMissing,
    after,
    lockedUntil: record?.lockedUntil ?? 0,
    settleWait,
    faceId: Boolean(record?.credential),
    pinLength: record?.length ?? null,
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
