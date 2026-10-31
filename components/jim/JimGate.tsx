"use client";

import { useEffect, useState, type FormEvent } from "react";
import JimChat from "@/components/jim/JimChat";
import JimHeader from "@/components/jim/JimHeader";
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
import { isJimConnected, JIM_API } from "@/lib/jim/api";
import { goTo, jimRedirectTarget } from "@/lib/jim/host";
import { jimTestHook } from "@/lib/jim/testHooks";

type GetToken = (force?: boolean) => Promise<string | null>;

type State =
  | { kind: "loading" }
  | { kind: "unconfigured" }
  | { kind: "signedOut" }
  | { kind: "denied"; email: string }
  | { kind: "owner"; api: string; getToken: GetToken };

const e2eToken: GetToken = async () => "e2e-token";

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

  useEffect(() => {
    // Off gentryriggen.com the server would refuse every request: go there
    // first, before Firebase loads or the form shows.
    const target = jimRedirectTarget(window.location.hostname);
    if (target) {
      goTo(target);
      return;
    }
    const hook = jimTestHook();
    // The e2e hook (compiled out of the shipped build) stands in for Firebase.
    const fake = hook?.signedIn === true;
    if (!fake && !isFirebaseConfigured()) return;
    const api = hook?.api ?? JIM_API;
    const watch = fake ? watchAsOwner : watchAuth;
    const getToken = fake ? e2eToken : getIdToken;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void watch((user) => {
      if (cancelled) return;
      if (!user) {
        // Keep the "Not authorized" message when our own sign-out echoes back.
        setState((prev) =>
          prev.kind === "denied" ? prev : { kind: "signedOut" }
        );
      } else if (isAdminUser(user)) {
        setExcluded(safeLocalStorage());
        setState({ kind: "owner", api, getToken });
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
  }, []);

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    setState((prev) => (prev.kind === "denied" ? { kind: "signedOut" } : prev));
    // One generic message for every failure: never say which part was wrong
    // and never surface the raw Firebase error.
    signInWithEmail(email, password)
      .then(() => setPassword(""))
      .catch(() => {
        setPassword("");
        setError("Incorrect email or password.");
      })
      .finally(() => setSubmitting(false));
  }

  function signOut() {
    signOutUser().catch(() => {});
  }

  if (state.kind === "owner") {
    if (isJimConnected(state.api)) {
      return (
        <JimChat
          api={state.api}
          getToken={state.getToken}
          onSignOut={signOut}
        />
      );
    }
    return (
      <div className="jim-app flex min-h-dvh flex-col bg-ayu-bg text-ayu-text">
        <JimHeader onSignOut={signOut} />
        <main className="flex flex-1 items-center justify-center px-6 pb-[env(safe-area-inset-bottom)] text-center">
          <div className="max-w-sm space-y-2">
            <p className="text-lg font-medium">Jim isn&apos;t connected yet</p>
            <p className="text-ayu-subtle">
              The chat opens here once his server is live.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Blank (just the background) while sign-in is checked or the page is
  // moving to gentryriggen.com, so the form never flashes.
  if (state.kind === "loading") {
    return <main aria-busy="true" className="jim-app min-h-dvh bg-ayu-bg" />;
  }

  return (
    <main className="jim-app flex min-h-dvh items-center justify-center bg-ayu-bg px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-ayu-text">
      <div className="w-full max-w-sm space-y-5 py-8 text-center">
        <h1 className="text-3xl font-semibold text-ayu-accent">Jim</h1>
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
          <form onSubmit={signIn} className="space-y-4 text-left">
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
                className="min-h-11 w-full rounded-lg border border-ayu-muted bg-ayu-panel px-3 py-2 text-base text-ayu-text focus:border-ayu-accent focus:outline-none"
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
                className="min-h-11 w-full rounded-lg border border-ayu-muted bg-ayu-panel px-3 py-2 text-base text-ayu-text focus:border-ayu-accent focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 w-full rounded-lg bg-ayu-accent px-4 py-2 text-base font-medium text-ayu-bg hover:bg-ayu-orange disabled:opacity-50"
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
      </div>
    </main>
  );
}
