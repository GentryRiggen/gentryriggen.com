"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import JimChat from "@/components/jim/JimChat";
import JimHeader from "@/components/jim/JimHeader";
import JimMark from "@/components/jim/JimMark";
import LockScreen from "@/components/jim/LockScreen";
import useAppLock from "@/components/jim/useAppLock";
import { ADMIN_UID, isAdminUser } from "@/lib/analytics/admin";
import { setExcluded } from "@/lib/analytics/exclude";
import { safeLocalStorage } from "@/lib/analytics/storage";
import {
  getIdToken,
  type AuthUser,
  signInWithEmail,
  signOutUser,
  watchAuth,
} from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { isJimConnected, JIM_API, wakeJim } from "@/lib/jim/api";
import {
  clearLock,
  clearWipePending,
  isWipePending,
  markWipePending,
} from "@/lib/jim/appLock";
import { clearHistory } from "@/lib/jim/history";
import { goTo, jimRedirectTarget } from "@/lib/jim/host";
import { clearAll, saveView } from "@/lib/jim/offlineStore";
import { disablePush } from "@/lib/jim/push";
import { registerJimServiceWorker } from "@/lib/jim/serviceWorker";
import { clearViewCache, fetchView, setViewSaver } from "@/lib/jim/view";
import { jimTestHook } from "@/lib/jim/testHooks";

type GetToken = (force?: boolean) => Promise<string | null>;

type State =
  | { kind: "loading" }
  | { kind: "unconfigured" }
  | { kind: "signedOut" }
  | { kind: "denied"; email: string }
  /** A sign-out not yet finished: never the app until it is. */
  | { kind: "wiping"; failed: boolean }
  | { kind: "owner"; uid: string; api: string; getToken: GetToken };

/** The sign-in this page runs on: real Firebase, or the e2e stand-in. */
interface Session {
  getToken: GetToken;
  api: string;
  endSession: () => Promise<void>;
}

const e2eToken: GetToken = async () => "e2e-token";

/** How long sign-out waits for a token to tell the server, at most. */
const SIGN_OUT_TOKEN_MS = 2_000;

/**
 * The device's Jim data, except the lock and the wipe marker. The Notes
 * saver goes first, so a view still on its way can't refill the store.
 */
function clearDeviceData(): void {
  setViewSaver(null);
  clearViewCache();
  clearHistory();
  void clearAll();
}

/** Signed out for sure: the data goes, then the lock and the marker. */
function finishWipe(): void {
  clearDeviceData();
  clearLock();
  clearWipePending();
}

const SIGN_OUT_FAILED =
  "Couldn't finish signing out. Jim stays locked on this device until it does.";

/** watchAuth for the e2e hook: the owner is already signed in. */
async function watchAsOwner(
  onChange: (user: AuthUser | null) => void
): Promise<() => void> {
  await Promise.resolve();
  onChange({ uid: ADMIN_UID, email: "owner@example.com" });
  return () => {};
}

export default function JimGate() {
  const [state, setState] = useState<State>(() =>
    isFirebaseConfigured() ? { kind: "loading" } : { kind: "unconfigured" }
  );
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /** Said on the sign-in screen after a wipe (too many wrong PINs). */
  const [notice, setNotice] = useState<string | null>(null);
  const lock = useAppLock(state.kind === "owner" ? state.uid : null);
  const { lockNow } = lock;
  /** The sign-in the server was last woken for. */
  const wokeFor = useRef<string | null>(null);
  const session = useRef<Session | null>(null);
  /** A password sign-in is under way: its user is fresh, not a leftover. */
  const signingIn = useRef(false);

  useEffect(() => {
    // Off gentryriggen.com the server would refuse every request: go there
    // first, before Firebase loads or the form shows.
    const target = jimRedirectTarget(window.location.hostname);
    if (target) {
      goTo(target);
      return;
    }
    void registerJimServiceWorker();
    const hook = jimTestHook();
    // The e2e hook (compiled out of the shipped build) stands in for Firebase.
    const fake = hook?.signedIn === true;
    if (!fake && !isFirebaseConfigured()) return;
    const api = hook?.api ?? JIM_API;
    const watch = fake ? watchAsOwner : watchAuth;
    const getToken = fake ? e2eToken : getIdToken;
    // The e2e stand-in has no Firebase session to end.
    const endSession = fake ? async () => {} : signOutUser;
    session.current = { getToken, api, endSession };
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void watch((user) => {
      if (cancelled) return;
      if (!user) {
        // Notes data (health, people) and the kept chat must not outlive the
        // sign-in, even one that expired while the page was closed.
        wokeFor.current = null;
        finishWipe();
        lockNow();
        // Keep the "Not authorized" message when our own sign-out echoes back.
        setState((prev) =>
          prev.kind === "denied" ? prev : { kind: "signedOut" }
        );
      } else if (isWipePending() && !signingIn.current) {
        // A sign-out that never finished (the app was killed, no network):
        // finish it before anything of the app shows.
        wokeFor.current = null;
        setState({ kind: "wiping", failed: false });
        endSession().then(
          () => {
            finishWipe();
            lockNow();
            setState({ kind: "signedOut" });
          },
          () => setState({ kind: "wiping", failed: true })
        );
      } else if (isAdminUser(user)) {
        // A password just typed ends any wipe left over: that lock is gone.
        if (isWipePending()) finishWipe();
        setExcluded(safeLocalStorage());
        // Each good Notes payload is kept on the device for offline opens.
        const uid = user.uid;
        setViewSaver((data) => void saveView(uid, data));
        setState({ kind: "owner", uid, api, getToken });
        if (wokeFor.current !== user.uid && isJimConnected(api)) {
          wokeFor.current = user.uid;
          // Start the server (and the Notes data) while Gentry types.
          wakeJim(api);
          fetchView(getToken, undefined, api).catch(() => {});
        }
      } else {
        setState({ kind: "denied", email: user.email ?? "unknown account" });
        // Best effort: a failed sign-out must not become an unhandled rejection.
        signOutUser().catch(() => {});
      }
    }).then((stop) => {
      if (cancelled) stop();
      else unsubscribe = stop;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [lockNow]);

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setNotice(null);
    setSubmitting(true);
    setState((prev) => (prev.kind === "denied" ? { kind: "signedOut" } : prev));
    // One generic message for every failure: never say which part was wrong
    // and never surface the raw Firebase error.
    signingIn.current = true;
    signInWithEmail(email, password)
      .then(() => {
        setPassword("");
        if (isWipePending()) finishWipe();
      })
      .catch(() => {
        setPassword("");
        setError("Incorrect email or password.");
      })
      .finally(() => {
        signingIn.current = false;
        setSubmitting(false);
      });
  }

  /**
   * Signs out and wipes this device's Jim data, in an order that survives
   * being cut short: the wipe marker first, then the data, then Firebase's
   * sign-out, and only once that is done the lock and the marker. Killed or
   * offline midway, the next load finishes it and stays locked meanwhile.
   */
  function signOut() {
    markWipePending();
    clearDeviceData();
    lockNow();
    wokeFor.current = null;
    const current = session.current;
    if (!current) {
      setState({ kind: "signedOut" });
      return;
    }
    // This device's morning briefing goes too. The token is taken before
    // signing out (after, there is none); the wait is capped, so a dead
    // network never holds sign-out up for long.
    const { getToken, api, endSession } = current;
    const token = Promise.race([
      Promise.resolve()
        .then(() => getToken())
        .catch(() => null),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), SIGN_OUT_TOKEN_MS)
      ),
    ]);
    if (state.kind === "owner") void disablePush(() => token, undefined, api);
    void token
      .then(() => endSession())
      .then(
        () => {
          finishWipe();
          lockNow();
        },
        () => setState({ kind: "wiping", failed: true })
      );
    // Out now on this screen; Firebase catches up once the token is in.
    setState({ kind: "signedOut" });
  }

  /** Tries the unfinished sign-out again. */
  function retrySignOut() {
    const current = session.current;
    if (!current) return;
    setState({ kind: "wiping", failed: false });
    current.endSession().then(
      () => {
        finishWipe();
        lockNow();
        setState({ kind: "signedOut" });
      },
      () => setState({ kind: "wiping", failed: true })
    );
  }

  /** Signs out and wipes the device, saying why on the sign-in screen. */
  function wipe(reason: string) {
    signOut();
    setNotice(reason);
  }

  if (state.kind === "owner") {
    // Nothing of the app is drawn while it is locked: JimChat keeps its
    // state but renders nothing, and the lock screen stands alone.
    const lockScreen = lock.locked ? (
      <LockScreen lock={lock} onWipe={wipe} />
    ) : null;
    if (isJimConnected(state.api)) {
      return (
        <>
          <JimChat
            key={state.uid}
            uid={state.uid}
            api={state.api}
            getToken={state.getToken}
            onSignOut={signOut}
            lock={lock}
            onWipe={wipe}
          />
          {lockScreen}
        </>
      );
    }
    if (lockScreen) return lockScreen;
    return (
      <div className="jim-app flex min-h-dvh flex-col bg-ayu-bg text-ayu-text">
        <JimHeader onSignOut={signOut} />
        <main className="flex flex-1 items-center justify-center px-6 pb-[env(safe-area-inset-bottom)] text-center">
          <div className="jim-rise flex max-w-sm flex-col items-center space-y-2">
            <JimMark size="lg" />
            <p className="pt-3 text-lg font-medium">
              Jim isn&apos;t connected yet
            </p>
            <p className="text-ayu-subtle">
              The chat opens here once his server is live.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (state.kind === "wiping") {
    return (
      <main className="jim-app flex min-h-dvh items-center justify-center bg-ayu-bg px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center text-ayu-text">
        <div className="jim-rise flex w-full max-w-sm flex-col items-center gap-4 py-8">
          <JimMark size="lg" />
          {state.failed ? (
            <>
              <p role="alert" className="text-ayu-red">
                {SIGN_OUT_FAILED}
              </p>
              <button
                type="button"
                onClick={retrySignOut}
                className="min-h-12 w-full rounded-xl jim-glow px-4 font-semibold text-ayu-bg hover:brightness-110"
              >
                Try again
              </button>
            </>
          ) : (
            <p role="status" className="text-ayu-subtle">
              Signing out…
            </p>
          )}
        </div>
      </main>
    );
  }

  // Blank (just the background) while sign-in is checked or the page is
  // moving to gentryriggen.com, so the form never flashes.
  if (state.kind === "loading") {
    return <main aria-busy="true" className="jim-app min-h-dvh bg-ayu-bg" />;
  }

  return (
    <main className="jim-app flex min-h-dvh items-center justify-center bg-ayu-bg px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-ayu-text">
      <div className="jim-rise w-full max-w-sm space-y-6 py-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <JimMark size="lg" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ayu-text">
              Jim
            </h1>
            <p className="mt-1 text-sm text-ayu-subtle">
              Your memory, on call.
            </p>
          </div>
        </div>
        {state.kind === "unconfigured" && (
          <p className="text-ayu-subtle">
            Firebase is not configured for this build.
          </p>
        )}
        {state.kind === "denied" && (
          <p role="alert" className="text-ayu-red">
            Not authorized: {state.email} can&apos;t use Jim.
          </p>
        )}
        {(state.kind === "signedOut" || state.kind === "denied") && (
          <form
            onSubmit={signIn}
            className="jim-card space-y-4 rounded-3xl! p-5 text-left"
          >
            <div className="space-y-1.5">
              <label htmlFor="jim-email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="jim-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-ayu-line/60 px-3.5 py-2 shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)] text-base text-ayu-text focus:border-ayu-accent/60 focus:ring-4 focus:ring-ayu-accent/10 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="jim-password"
                className="block text-sm font-medium"
              >
                Password
              </label>
              <input
                id="jim-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-ayu-line/60 px-3.5 py-2 shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)] text-base text-ayu-text focus:border-ayu-accent/60 focus:ring-4 focus:ring-ayu-accent/10 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-12 w-full rounded-xl jim-glow px-4 py-2 text-base font-semibold text-ayu-bg hover:brightness-110 disabled:opacity-50"
            >
              Sign in
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-sm text-ayu-red">
            {error}
          </p>
        )}
        {notice && state.kind === "signedOut" && (
          <p role="status" className="text-sm text-ayu-subtle">
            {notice}
          </p>
        )}
      </div>
    </main>
  );
}
