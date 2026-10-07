"use client";

import { useEffect, useState, type FormEvent } from "react";
import Dashboard from "@/components/admin/Dashboard";
import { isAdminUser } from "@/lib/analytics/admin";
import { setExcluded } from "@/lib/analytics/exclude";
import { safeLocalStorage } from "@/lib/analytics/storage";
import { signInWithEmail, signOutUser, watchAuth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";

type State =
  | { kind: "loading" }
  | { kind: "unconfigured" }
  | { kind: "signedOut" }
  | { kind: "denied"; email: string }
  | { kind: "admin"; email: string };

export default function AdminGate() {
  const [state, setState] = useState<State>(() =>
    isFirebaseConfigured() ? { kind: "loading" } : { kind: "unconfigured" }
  );
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void watchAuth((user) => {
      if (cancelled) return;
      if (!user) {
        // Keep the "Not authorized" message when our own sign-out echoes back.
        setState((prev) =>
          prev.kind === "denied" ? prev : { kind: "signedOut" }
        );
      } else if (isAdminUser(user)) {
        setExcluded(safeLocalStorage());
        setState({ kind: "admin", email: user.email ?? "" });
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
      .catch(() => {
        setPassword("");
        setError("Incorrect email or password.");
      })
      .finally(() => setSubmitting(false));
  }

  if (state.kind === "admin") {
    return (
      <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <h1 className="text-xl font-semibold">Admin</h1>
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <span className="hidden sm:inline">{state.email}</span>
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Sign out
            </button>
          </div>
        </header>
        <Dashboard />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Admin</h1>
        {state.kind === "loading" && (
          <p className="text-gray-600 dark:text-gray-400">Checking sign-in…</p>
        )}
        {state.kind === "unconfigured" && (
          <p className="text-gray-600 dark:text-gray-400">
            Firebase is not configured for this build.
          </p>
        )}
        {state.kind === "denied" && (
          <p role="alert" className="text-red-600 dark:text-red-400">
            Not authorized: {state.email} is not an admin account.
          </p>
        )}
        {(state.kind === "signedOut" || state.kind === "denied") && (
          <form onSubmit={signIn} className="space-y-3 text-left">
            <div className="space-y-1">
              <label
                htmlFor="admin-email"
                className="block text-sm font-medium"
              >
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="admin-password"
                className="block text-sm font-medium"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              Sign in
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
