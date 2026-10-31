"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { ArrowUp } from "lucide-react";
import JimHeader from "@/components/jim/JimHeader";
import useVisibleViewport from "@/components/jim/useVisibleViewport";
import { JimError, sendToJim, type JimErrorKind } from "@/lib/jim/api";
import JimMarkdown from "@/lib/jim/markdown";

interface JimChatProps {
  /** The server's base URL. */
  api: string;
  getToken: (force?: boolean) => Promise<string | null>;
  onSignOut: () => void;
}

interface Message {
  id: number;
  from: "me" | "jim";
  text: string;
  changed?: string[];
}

const ERRORS: Record<JimErrorKind, string> = {
  waking: "Jim is waking up, one moment",
  uncertain: "Jim may have saved this — check before sending again",
  server: "Couldn't reach Jim",
  denied: "Jim didn't accept your sign-in. Sign out and back in.",
  rejected: "Jim couldn't take that message. Try a shorter one.",
};

/** After this long, the thinking indicator says it is still working. */
const SLOW_MS = 20_000;

/** Closer than this to the bottom counts as reading the latest message. */
const STICK_PX = 80;

function isPhone(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function JimChat({ api, getToken, onSignOut }: JimChatProps) {
  const [session] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<JimErrorKind | null>(null);
  /** A message Jim may have acted on, kept out of the box until asked for. */
  const [held, setHeld] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [phone] = useState(isPhone);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(0);
  /** False once Gentry scrolls up to read; true again at the bottom. */
  const stuck = useRef(true);
  const lastTop = useRef(0);

  const keyboardOpen = useVisibleViewport(rootRef);

  const scrollToEnd = useCallback((smooth: boolean) => {
    const el = scrollerRef.current;
    if (!el || typeof el.scrollTo !== "function") return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "instant",
    });
  }, []);

  // A long turn (Jim can take minutes) gets a calmer note after a while.
  useEffect(() => {
    if (!sending) return;
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, [sending]);

  // New messages slide into view, unless Gentry scrolled up to read.
  useEffect(() => {
    if (stuck.current) scrollToEnd(true);
  }, [messages, sending, scrollToEnd]);

  // The keyboard opening, the box growing or a banner appearing shrinks the
  // list: keep the latest message in view while it does. Only the scroller
  // is watched; new messages take the smooth path above.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (typeof ResizeObserver === "undefined" || !scroller) return;
    const observer = new ResizeObserver(() => {
      if (stuck.current) scrollToEnd(false);
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [scrollToEnd]);

  // Grow the box with its text, up to its max height (10rem, or 30% of the
  // visible screen when that is less), then it scrolls.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
  }, [draft]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (fromBottom < STICK_PX) stuck.current = true;
    else if (el.scrollTop < lastTop.current) stuck.current = false;
    lastTop.current = el.scrollTop;
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    const id = nextId.current++;
    setError(null);
    setHeld(null);
    setSlow(false);
    setSending(true);
    setDraft("");
    stuck.current = true;
    setMessages((prev) => [...prev, { id, from: "me", text }]);
    try {
      const reply = await sendToJim(session, text, getToken, undefined, api);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          from: "jim",
          text: reply.reply,
          changed: reply.changed,
        },
      ]);
    } catch (err) {
      const kind = err instanceof JimError ? err.kind : "server";
      setError(kind);
      if (kind === "uncertain") {
        // Jim may already have it: leave it in the conversation and keep a
        // copy aside, so a quick resend can't save it twice.
        setHeld(text);
      } else {
        // It never ran: take it back and return it to the box.
        setMessages((prev) => prev.filter((m) => m.id !== id));
        putBack(text);
      }
    } finally {
      setSending(false);
    }
  }

  function putBack(text: string) {
    setDraft((current) => (current ? `${text}\n${current}` : text));
  }

  function restoreHeld() {
    if (held === null) return;
    putBack(held);
    setHeld(null);
    setError(null);
    boxRef.current?.focus({ preventScroll: true });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Inside the tap, so iOS keeps the keyboard up for the next message.
    boxRef.current?.focus({ preventScroll: true });
    void send();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Phones: Return is a new line and the Send button sends.
    // Desktop: Enter sends, Shift+Enter is a new line.
    if (event.key !== "Enter" || event.shiftKey || phone) return;
    // Mid-composition (IME); Safari reports its commit Enter as keyCode 229.
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      return;
    }
    event.preventDefault();
    void send();
  }

  const canSend = draft.trim().length > 0 && !sending;

  return (
    <div
      ref={rootRef}
      className="fixed inset-x-0 top-[var(--jim-vt,0px)] flex h-[var(--jim-vh,100dvh)] flex-col overflow-hidden bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100"
    >
      <JimHeader onSignOut={onSignOut} />

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div
          role="log"
          aria-label="Conversation"
          className="mx-auto flex w-full max-w-[45rem] flex-col gap-4 py-4 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] sm:py-6"
        >
          {messages.length === 0 && !sending && (
            <p className="py-10 text-center text-gray-500 dark:text-gray-400">
              Ask Jim something, or tell him something to remember.
            </p>
          )}
          {messages.map((m) =>
            m.from === "me" ? (
              <div
                key={m.id}
                className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 whitespace-pre-wrap text-white [overflow-wrap:anywhere] dark:bg-blue-500"
              >
                {m.text}
              </div>
            ) : (
              <div key={m.id} className="mr-auto max-w-[92%] min-w-0">
                <div className="rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 dark:bg-gray-900">
                  <JimMarkdown text={m.text} />
                </div>
                {m.changed && m.changed.length > 0 && (
                  <p className="mt-1 px-1 text-xs text-gray-500 [overflow-wrap:anywhere] dark:text-gray-400">
                    Saved: {m.changed.join(", ")}
                  </p>
                )}
              </div>
            )
          )}
          {sending && (
            <p
              role="status"
              className="mr-auto rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 text-gray-500 dark:bg-gray-900 dark:text-gray-400"
            >
              {slow ? "Still working…" : "Jim is thinking…"}
            </p>
          )}
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className={`shrink-0 border-t border-gray-200 bg-white pt-2 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] dark:border-gray-800 dark:bg-gray-950 ${
          keyboardOpen ? "pb-2" : "pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        }`}
      >
        <div className="mx-auto w-full max-w-[45rem] px-3 sm:px-4">
          {error && (
            <p
              role="alert"
              className={`mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-sm ${
                error === "waking" || error === "uncertain"
                  ? "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
              }`}
            >
              <span>{ERRORS[error]}</span>
              {held !== null && (
                <button
                  type="button"
                  onClick={restoreHeld}
                  className="-mx-2 -my-1 min-h-11 rounded-md px-2 font-medium underline underline-offset-2 transition-colors! duration-150!"
                >
                  Put my message back
                </button>
              )}
            </p>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor="jim-message" className="sr-only">
              Message
            </label>
            <textarea
              id="jim-message"
              ref={boxRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Message Jim"
              enterKeyHint={phone ? "enter" : "send"}
              autoComplete="off"
              className="max-h-[min(10rem,calc(var(--jim-vh,100dvh)*0.3))] min-h-11 min-w-0 flex-1 resize-none rounded-3xl border border-gray-300 bg-white px-4 py-2.5 text-base leading-6 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-400"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!canSend}
              // Keep the keyboard up: a tap on Send must not blur the box.
              onPointerDown={(e) => e.preventDefault()}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-600 transition-colors! duration-150! text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 dark:bg-blue-500 dark:hover:bg-blue-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
            >
              <ArrowUp
                aria-hidden="true"
                className="size-5"
                strokeWidth={2.5}
              />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
