"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { KeyRound, LoaderCircle, LogOut, ShieldCheck, X } from "lucide-react";
import { isWrongCode, WRONG_CODE } from "@/lib/firebase/mfa";
import { JimError, revokeSessions } from "@/lib/jim/api";
import { encodeQr, qrPath } from "@/lib/jim/qr";
import { jimTwoStep, type TwoStep } from "@/lib/jim/twoStep";

type GetToken = (force?: boolean) => Promise<string | null>;

interface SecuritySheetProps {
  open: boolean;
  onClose: () => void;
  /** Signs this device out and wipes it, once the server ended every session. */
  onSignedOutEverywhere: () => void;
  getToken: GetToken;
  api: string;
  /** Jim's sign-in (the e2e stand-in in tests). */
  twoStep?: TwoStep;
  revoke?: typeof revokeSessions;
}

type Status = "loading" | "on" | "off" | "error";

type Step =
  | { kind: "idle" }
  | { kind: "password" }
  /** The secret lives only here, and only until this step ends. */
  | {
      kind: "setup";
      secret: string;
      url: string;
      finish: (code: string) => Promise<void>;
    }
  | { kind: "done" };

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ON = "Two-step sign-in is on.";
const OFF = "Two-step sign-in is off.";
const DONE =
  "Two-step sign-in is on. Jim asks for a code only when you sign in on a new device.";
const CHECK_FAILED = "Couldn't check two-step sign-in.";
const WRONG_PASSWORD = "That password didn't work.";
const TOO_MANY = "Too many tries. Wait a few minutes, then try again.";
const START_FAILED = "Couldn't start two-step setup. Try again in a moment.";
const PASSWORD_AGAIN = "Confirm your password again to finish.";
const FINISH_FAILED = "That didn't work. Start again.";
const CONFIRM_REVOKE = "This signs out every device, this one too.";
/** The server's own words for a failed revoke (its 503 body). */
const REVOKE_FAILED = "Couldn't sign out everywhere. Try again in a minute.";

const PASSWORD_CODES = new Set([
  "auth/wrong-password",
  "auth/invalid-credential",
  "auth/invalid-login-credentials",
  "auth/requires-recent-login",
  "auth/user-mismatch",
  "auth/missing-password",
]);

const PRIMARY =
  "jim-glow flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 font-semibold text-ayu-bg hover:brightness-110 disabled:opacity-50";
const SECONDARY =
  "flex min-h-11 items-center justify-center rounded-xl px-4 font-medium text-ayu-subtle hover:bg-white/[0.06] hover:text-ayu-text disabled:opacity-50";
const FIELD =
  "min-h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 text-base text-ayu-text placeholder:text-ayu-subtle focus:border-ayu-accent/50 focus:outline-none";

function errorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("code" in err)) return;
  const { code } = err as { code: unknown };
  return typeof code === "string" ? code : undefined;
}

/** "ABCDEFGH…" as "ABCD EFGH …", easier to read and type. */
export function groupKey(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? "";
}

/**
 * The setup link as a QR code, drawn here as SVG: the link holds the secret,
 * so it never goes to a QR service. Dark on light, as scanners want it.
 */
function QrCode({ text }: { text: string }) {
  const drawn = useMemo(() => {
    try {
      const qr = encodeQr(text);
      return { side: qr.size + 8, path: qrPath(qr, 4) };
    } catch {
      return null;
    }
  }, [text]);
  if (!drawn) return null;
  return (
    <svg
      role="img"
      aria-label="QR code of the setup link, to scan from another device"
      viewBox={`0 0 ${drawn.side} ${drawn.side}`}
      shapeRendering="crispEdges"
      className="size-44 shrink-0 rounded-xl"
    >
      <rect width={drawn.side} height={drawn.side} fill="#fff" />
      <path d={drawn.path} fill="#000" />
    </svg>
  );
}

/**
 * Sign-in & security: two-step sign-in with an authenticator (the code is
 * asked only on a new device), and Sign out everywhere.
 */
export default function SecuritySheet({ open, ...rest }: SecuritySheetProps) {
  // Closed, nothing is kept: the setup key goes with the sheet.
  if (!open) return null;
  return <Sheet {...rest} />;
}

function Sheet({
  onClose,
  onSignedOutEverywhere,
  getToken,
  api,
  twoStep: given,
  revoke = revokeSessions,
}: Omit<SecuritySheetProps, "open">) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [twoStep] = useState<TwoStep>(() => given ?? jimTwoStep());
  const [status, setStatus] = useState<Status>("loading");
  const [checks, setChecks] = useState(0);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Bumped by each failed try: focus goes back to the field to retry. */
  const [retries, setRetries] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  /** Bumped by every new start or back-out: a late answer is dropped. */
  const attempt = useRef(0);
  const live = useRef(true);
  // Taken while rendering, before anything in the sheet takes focus.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  );

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    twoStep.secondFactor().then(
      (state) => {
        if (current) setStatus(state.enrolled ? "on" : "off");
      },
      () => {
        if (current) setStatus("error");
      }
    );
    return () => {
      current = false;
    };
  }, [twoStep, checks]);

  useEffect(() => {
    closeRef.current?.focus();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const sheet = sheetRef.current;
      const all = [...(sheet?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      if (!sheet || all.length === 0) return;
      const first = all[0];
      const last = all[all.length - 1];
      const at = document.activeElement;
      if (!sheet.contains(at)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && at === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && at === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [onClose, opener]);

  // Each step puts focus where the next tap is.
  useEffect(() => {
    if (step.kind === "password") passwordRef.current?.focus();
    else if (step.kind === "setup") linkRef.current?.focus();
    else if (step.kind === "done") closeRef.current?.focus();
  }, [step.kind]);

  useEffect(() => {
    if (retries === 0) return;
    if (step.kind === "password") passwordRef.current?.focus();
    else if (step.kind === "setup") codeRef.current?.focus();
    // Only a new failure moves focus, not a step change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retries]);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  function askPassword(note: string | null) {
    attempt.current += 1;
    setPassword("");
    setCode("");
    setCopied(null);
    setError(note);
    setStep({ kind: "password" });
    if (note) setRetries((n) => n + 1);
  }

  function backOut() {
    attempt.current += 1;
    setPassword("");
    setCode("");
    setError(null);
    setBusy(false);
    setStep({ kind: "idle" });
  }

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !password) return;
    const typed = password;
    setPassword("");
    setError(null);
    setBusy(true);
    const mine = ++attempt.current;
    twoStep.startTotp(typed).then(
      (setup) => {
        if (!live.current || mine !== attempt.current) return;
        setBusy(false);
        setStep({ kind: "setup", ...setup });
      },
      (err: unknown) => {
        if (!live.current || mine !== attempt.current) return;
        setBusy(false);
        const why = errorCode(err);
        if (why === "auth/too-many-requests") setError(TOO_MANY);
        else if (why && PASSWORD_CODES.has(why)) setError(WRONG_PASSWORD);
        else setError(START_FAILED);
        setRetries((n) => n + 1);
      }
    );
  }

  function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || step.kind !== "setup" || code.length !== 6) return;
    const typed = code;
    setError(null);
    setBusy(true);
    const mine = attempt.current;
    step.finish(typed).then(
      () => {
        if (!live.current || mine !== attempt.current) return;
        setBusy(false);
        setCode("");
        setCopied(null);
        setStatus("on");
        // The secret leaves state (and the page) here.
        setStep({ kind: "done" });
      },
      (err: unknown) => {
        if (!live.current || mine !== attempt.current) return;
        setBusy(false);
        setCode("");
        if (isWrongCode(err)) {
          setError(WRONG_CODE);
          setRetries((n) => n + 1);
        } else if (errorCode(err) === "auth/requires-recent-login") {
          // Too long since the password: ask for it again, right here.
          askPassword(PASSWORD_AGAIN);
        } else {
          backOut();
          setError(FINISH_FAILED);
        }
      }
    );
  }

  function copyKey(secret: string) {
    const clipboard =
      typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clipboard) {
      setCopied("Couldn't copy. Select the key instead.");
      return;
    }
    clipboard.writeText(secret).then(
      () => {
        if (live.current) setCopied("Copied.");
      },
      () => {
        if (live.current) setCopied("Couldn't copy. Select the key instead.");
      }
    );
  }

  function signOutEverywhere() {
    if (revoking) return;
    setRevokeError(null);
    setRevoking(true);
    revoke(getToken, undefined, api).then(
      () => {
        // The server ended every session: now this device signs out and
        // its Jim data is wiped.
        onSignedOutEverywhere();
      },
      (err: unknown) => {
        if (!live.current) return;
        setRevoking(false);
        // A refused sign-in already ends the session (and wipes).
        if (err instanceof JimError && err.kind === "denied") return;
        setConfirming(false);
        setRevokeError(REVOKE_FAILED);
      }
    );
  }

  const statusLine =
    status === "loading"
      ? "Checking…"
      : status === "error"
        ? CHECK_FAILED
        : status === "on"
          ? ON
          : OFF;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end lg:items-center lg:justify-center lg:p-8">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="jim-card jim-rise relative mx-auto flex max-h-[calc(var(--jim-vh,100dvh)-env(safe-area-inset-top)-1.5rem)] w-full max-w-[45rem] flex-col rounded-t-3xl! rounded-b-none! shadow-2xl! lg:max-h-[min(85vh,46rem)] lg:max-w-xl lg:rounded-3xl!"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 pt-2 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))]">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-tight text-ayu-text"
          >
            Sign-in &amp; security
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-full text-ayu-subtle hover:bg-white/[0.06] hover:text-ayu-text"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-[max(1.25rem,env(safe-area-inset-left))] pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <section aria-labelledby={`${titleId}-two`} className="space-y-3">
            <h3
              id={`${titleId}-two`}
              className="flex items-center gap-2 font-semibold text-ayu-text"
            >
              <ShieldCheck
                aria-hidden="true"
                className="size-4 text-ayu-accent"
              />
              Two-step sign-in
            </h3>
            {step.kind === "done" ? (
              <p role="status" className="text-ayu-text">
                {DONE}
              </p>
            ) : (
              <div className="space-y-2">
                <p
                  role="status"
                  className={
                    status === "error" ? "text-ayu-red" : "text-ayu-text"
                  }
                >
                  {status === "loading" && (
                    <LoaderCircle
                      aria-hidden="true"
                      className="mr-2 inline size-4 animate-spin align-[-2px] motion-reduce:animate-none"
                    />
                  )}
                  {statusLine}
                </p>
                {status === "error" && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("loading");
                      setChecks((n) => n + 1);
                    }}
                    className={`${SECONDARY} -ml-4 underline underline-offset-2`}
                  >
                    Try again
                  </button>
                )}
                {status === "off" && step.kind === "idle" && (
                  <>
                    <p className="text-sm text-ayu-subtle">
                      Signing in on a new device will also ask for a 6-digit
                      code from Passwords or an authenticator app.
                    </p>
                    {error && (
                      <p role="alert" className="text-sm text-ayu-red">
                        {error}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => askPassword(null)}
                      className={PRIMARY}
                    >
                      Turn on
                    </button>
                  </>
                )}
              </div>
            )}

            {step.kind === "password" && (
              <form onSubmit={start} className="space-y-3" noValidate>
                <label className="block space-y-1.5">
                  <span className="block text-sm font-medium text-ayu-text">
                    Confirm your password
                  </span>
                  <input
                    ref={passwordRef}
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${titleId}-err` : undefined}
                    disabled={busy}
                    className={FIELD}
                  />
                </label>
                {error && (
                  <p
                    id={`${titleId}-err`}
                    role="alert"
                    className="text-sm text-ayu-red"
                  >
                    {error}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={backOut} className={SECONDARY}>
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !password}
                    className={`${PRIMARY} flex-1`}
                  >
                    {busy && (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-4 animate-spin motion-reduce:animate-none"
                      />
                    )}
                    Continue
                  </button>
                </div>
              </form>
            )}

            {step.kind === "setup" && (
              <div className="space-y-4">
                <ol className="list-decimal space-y-1 pl-5 text-sm text-ayu-subtle">
                  <li>
                    Save the key: tap Add to Passwords, or copy it into an
                    authenticator app.
                  </li>
                  <li>Type the 6-digit code it shows.</li>
                </ol>
                <a
                  ref={linkRef}
                  href={step.url}
                  rel="noreferrer"
                  className={PRIMARY}
                >
                  <KeyRound aria-hidden="true" className="size-4" />
                  Add to Passwords
                </a>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-ayu-text">Setup key</p>
                  <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-1 pr-1 pl-3.5">
                    <code className="min-w-0 flex-1 font-mono text-[0.9375rem] tracking-wide [overflow-wrap:anywhere] text-ayu-text select-all">
                      {groupKey(step.secret)}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyKey(step.secret)}
                      className={`${SECONDARY} shrink-0 px-3`}
                    >
                      Copy key
                    </button>
                  </div>
                  <p
                    aria-live="polite"
                    className="min-h-5 text-sm text-ayu-subtle"
                  >
                    {copied}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <QrCode text={step.url} />
                  <p className="text-center text-sm text-ayu-subtle">
                    On another device, scan this instead.
                  </p>
                </div>
                <form onSubmit={finish} className="space-y-3" noValidate>
                  <label className="block space-y-1.5">
                    <span className="block text-sm font-medium text-ayu-text">
                      6-digit code
                    </span>
                    <input
                      ref={codeRef}
                      type="text"
                      name="one-time-code"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${titleId}-err` : undefined}
                      disabled={busy}
                      className={`${FIELD} font-mono tracking-[0.3em]`}
                    />
                  </label>
                  {error && (
                    <p
                      id={`${titleId}-err`}
                      role="alert"
                      className="text-sm text-ayu-red"
                    >
                      {error}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={backOut}
                      className={SECONDARY}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={busy || code.length !== 6}
                      className={`${PRIMARY} flex-1`}
                    >
                      {busy && (
                        <LoaderCircle
                          aria-hidden="true"
                          className="size-4 animate-spin motion-reduce:animate-none"
                        />
                      )}
                      Turn on
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>

          <section
            aria-labelledby={`${titleId}-out`}
            className="space-y-3 border-t border-white/[0.06] pt-5"
          >
            <h3
              id={`${titleId}-out`}
              className="flex items-center gap-2 font-semibold text-ayu-text"
            >
              <LogOut aria-hidden="true" className="size-4 text-ayu-red" />
              Every device
            </h3>
            {confirming ? (
              <div className="space-y-3 rounded-xl border border-ayu-red/30 bg-ayu-red/[0.06] p-3.5">
                <p className="text-ayu-text">{CONFIRM_REVOKE}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    ref={cancelRef}
                    type="button"
                    disabled={revoking}
                    onClick={() => setConfirming(false)}
                    className={SECONDARY}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={revoking}
                    onClick={signOutEverywhere}
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-ayu-red/90 px-4 font-semibold text-ayu-bg hover:bg-ayu-red disabled:opacity-50"
                  >
                    {revoking && (
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-4 animate-spin motion-reduce:animate-none"
                      />
                    )}
                    Yes, sign out everywhere
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRevokeError(null);
                  setConfirming(true);
                }}
                className="flex min-h-12 w-full items-center justify-center rounded-xl border border-ayu-red/30 px-4 font-medium text-ayu-red hover:bg-ayu-red/10"
              >
                Sign out everywhere
              </button>
            )}
            {revokeError && (
              <p role="alert" className="text-sm text-ayu-red">
                {revokeError}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
