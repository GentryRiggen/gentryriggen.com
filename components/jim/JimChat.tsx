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
import JimHeader, { type JimTab } from "@/components/jim/JimHeader";
import NotesShell from "@/components/jim/notes/NotesShell";
import useVisibleViewport from "@/components/jim/useVisibleViewport";
import {
  JimError,
  streamToJim,
  type JimErrorKind,
  type JimStreamEvent,
} from "@/lib/jim/api";
import {
  clearHistory,
  loadHistory,
  saveHistory,
  type ChatMessage,
} from "@/lib/jim/history";
import JimMarkdown from "@/lib/jim/markdown";

interface JimChatProps {
  /** The signed-in user, whose chat is kept on this device. */
  uid: string;
  /** The server's base URL. */
  api: string;
  getToken: (force?: boolean) => Promise<string | null>;
  onSignOut: () => void;
}

type Message = ChatMessage;

/** The reply being written: Jim's latest step, his text so far, saving. */
interface Live {
  step: string | null;
  text: string;
  saving: boolean;
}

const NO_LIVE: Live = { step: null, text: "", saving: false };

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

/** "Searching notes" → "Searching notes…" (one ellipsis, however sent). */
function stepLabel(step: string | null): string {
  return `${(step ?? "").replace(/[.…\s]+$/, "")}…`;
}

function isPhone(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function JimChat({
  uid,
  api,
  getToken,
  onSignOut,
}: JimChatProps) {
  // Back from this device: a reload keeps the conversation and its session.
  const [kept] = useState(() => loadHistory(uid));
  const [session, setSession] = useState(
    () => kept?.session ?? crypto.randomUUID()
  );
  const [messages, setMessages] = useState<Message[]>(
    () => kept?.messages ?? []
  );
  const [live, setLive] = useState<Live>(NO_LIVE);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<JimErrorKind | null>(null);
  /** A message Jim may have acted on, kept out of the box until asked for. */
  const [held, setHeld] = useState<{ id: number; text: string } | null>(null);
  const [slow, setSlow] = useState(false);
  const [phone] = useState(isPhone);
  const [tab, setTab] = useState<JimTab>("chat");
  /** Notes is built (and fetches) only once it has been opened. */
  const [notesOpened, setNotesOpened] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(
    (kept?.messages ?? []).reduce((max, m) => Math.max(max, m.id + 1), 0)
  );
  /** Bumped by New chat: a turn still out then is dropped when it lands. */
  const chatRun = useRef(0);
  /** Reply text as it streams in, drawn once per animation frame. */
  const liveText = useRef("");
  const frame = useRef<number | null>(null);
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

  // A reply growing as it streams keeps its end in view (no smooth scroll:
  // it would lag behind the text).
  useEffect(() => {
    if (stuck.current) scrollToEnd(false);
  }, [live, scrollToEnd]);

  // Keep the chat on this device. A message still out is stored as
  // uncertain, so a reload mid-turn never offers it as unsent.
  useEffect(() => {
    saveHistory(uid, { session, messages });
  }, [uid, session, messages]);

  useEffect(
    () => () => {
      chatRun.current += 1;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    []
  );

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

  function stopDrawing() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }

  function onStream(event: JimStreamEvent) {
    switch (event.t) {
      case "step":
        // Text before a tool call was provisional: back to the indicator.
        stopDrawing();
        liveText.current = "";
        setLive((prev) => ({ ...prev, step: event.text, text: "" }));
        break;
      case "delta":
        liveText.current += event.text;
        if (frame.current === null) {
          frame.current = requestAnimationFrame(() => {
            frame.current = null;
            setLive((prev) => ({ ...prev, text: liveText.current }));
          });
        }
        break;
      case "reply":
        // The whole reply: shown as is, whatever the deltas made of it.
        stopDrawing();
        liveText.current = event.text;
        setLive((prev) => ({ ...prev, text: event.text }));
        break;
      case "saving":
        setLive((prev) => ({ ...prev, saving: true }));
        break;
    }
  }

  /** Sends the box, or `given` (a quick log) leaving the box alone. */
  async function send(given?: string) {
    const text = (given ?? draft).trim();
    if (!text || sending) return;
    const id = nextId.current++;
    const run = chatRun.current;
    setError(null);
    setHeld(null);
    setSlow(false);
    setSending(true);
    if (given === undefined) setDraft("");
    stopDrawing();
    liveText.current = "";
    setLive(NO_LIVE);
    stuck.current = true;
    setMessages((prev) => [...prev, { id, from: "me", text, pending: true }]);
    const settle = (m: Message): Message =>
      m.id === id ? { id, from: "me", text } : m;
    try {
      const reply = await streamToJim(
        text,
        session,
        getToken,
        (event) => {
          if (run === chatRun.current) onStream(event);
        },
        undefined,
        api
      );
      if (run !== chatRun.current) return;
      setMessages((prev) => [
        ...prev.map(settle),
        {
          id: nextId.current++,
          from: "jim",
          text: reply.reply,
          changed: reply.changed,
        },
      ]);
    } catch (err) {
      if (run !== chatRun.current) return;
      const kind = err instanceof JimError ? err.kind : "server";
      setError(kind);
      if (kind === "uncertain") {
        // Jim may already have it: leave it in the conversation (with what
        // he wrote so far) and keep a copy aside, so a quick resend can't
        // save it twice.
        const partial = liveText.current;
        setMessages((prev) => [
          ...prev.map((m) =>
            m.id === id ? { ...settle(m), uncertain: true } : m
          ),
          ...(partial
            ? [
                {
                  id: nextId.current++,
                  from: "jim" as const,
                  text: partial,
                  uncertain: true,
                },
              ]
            : []),
        ]);
        setHeld({ id, text });
      } else {
        // It never ran: take it back and return it to the box.
        setMessages((prev) => prev.filter((m) => m.id !== id));
        putBack(text);
      }
    } finally {
      if (run === chatRun.current) {
        stopDrawing();
        liveText.current = "";
        setLive(NO_LIVE);
        setSending(false);
      }
    }
  }

  /** Clears the conversation here and on this device; Jim starts afresh. */
  function newChat() {
    chatRun.current += 1;
    stopDrawing();
    liveText.current = "";
    clearHistory(uid);
    setMessages([]);
    setSession(crypto.randomUUID());
    setLive(NO_LIVE);
    setSending(false);
    setError(null);
    setHeld(null);
    setSlow(false);
    stuck.current = true;
  }

  function putBack(text: string) {
    setDraft((current) => (current ? `${text}\n${current}` : text));
  }

  function showTab(next: JimTab) {
    if (next === "notes") {
      setNotesOpened(true);
      // A tap on a tab doesn't take focus on iOS: drop the keyboard by hand.
      boxRef.current?.blur();
    }
    setTab(next);
  }

  /**
   * A quick log on Notes: sent as a message, and Chat shows Jim's reply as
   * it comes. While another turn is out it waits in the box instead.
   */
  function logFromNotes(text: string) {
    stuck.current = true;
    setTab("chat");
    if (sending) putBack(text);
    else void send(text);
  }

  function restoreHeld() {
    if (held === null) return;
    putBack(held.text);
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
      data-keyboard={keyboardOpen ? "open" : "closed"}
      className="jim-app fixed inset-x-0 top-[var(--jim-vt,0px)] flex h-[var(--jim-vh,100dvh)] flex-col overflow-hidden bg-ayu-bg text-ayu-text"
    >
      <JimHeader
        onSignOut={onSignOut}
        tab={tab}
        onTab={showTab}
        menuItems={[{ label: "New chat", onSelect: newChat }]}
      />

      <div className="relative min-h-0 flex-1">
        <div
          id="jim-chat"
          role="tabpanel"
          aria-labelledby="jim-tab-chat"
          className={`absolute inset-0 flex flex-col ${tab === "chat" ? "" : "invisible"}`}
        >
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
                <p className="py-10 text-center text-ayu-subtle">
                  Ask Jim something, or tell him something to remember.
                </p>
              )}
              {messages.map((m) =>
                m.from === "me" ? (
                  <div key={m.id} className="ml-auto max-w-[85%] min-w-0">
                    <div className="rounded-2xl rounded-br-md bg-ayu-accent px-4 py-2.5 whitespace-pre-wrap text-ayu-bg [overflow-wrap:anywhere]">
                      {m.text}
                    </div>
                    {/* The banner says it for the message just sent. */}
                    {m.uncertain && held?.id !== m.id && (
                      <p className="mt-1 px-1 text-right text-xs text-ayu-subtle">
                        {ERRORS.uncertain}
                      </p>
                    )}
                  </div>
                ) : (
                  <div key={m.id} className="mr-auto max-w-[92%] min-w-0">
                    <div className="rounded-2xl rounded-bl-md bg-ayu-panel px-4 py-2.5">
                      <JimMarkdown text={m.text} />
                    </div>
                    {m.changed && m.changed.length > 0 && (
                      <p className="mt-1 px-1 text-xs text-ayu-subtle [overflow-wrap:anywhere]">
                        Saved: {m.changed.join(", ")}
                      </p>
                    )}
                  </div>
                )
              )}
              {sending && (
                <div className="mr-auto max-w-[92%] min-w-0">
                  {live.text ? (
                    <div
                      aria-busy="true"
                      className="rounded-2xl rounded-bl-md bg-ayu-panel px-4 py-2.5"
                    >
                      <JimMarkdown text={live.text} />
                    </div>
                  ) : (
                    <p
                      role="status"
                      className="rounded-2xl rounded-bl-md bg-ayu-panel px-4 py-2.5 text-ayu-subtle"
                    >
                      {slow ? "Still working…" : "Jim is thinking…"}
                    </p>
                  )}
                  {(live.saving || live.step) && (
                    <p
                      role="status"
                      className="mt-1 px-1 text-xs text-ayu-subtle [overflow-wrap:anywhere]"
                    >
                      {live.saving ? "Saving…" : stepLabel(live.step)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Clears the home bar, except over the keyboard: nothing sits
              between the box and the keys. */}
          <form
            onSubmit={onSubmit}
            className={`shrink-0 border-t border-ayu-line bg-ayu-bg pt-2 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] ${
              keyboardOpen
                ? "pb-2"
                : "pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            }`}
          >
            <div className="mx-auto w-full max-w-[45rem] px-3 sm:px-4">
              {error && (
                <p
                  role="alert"
                  className={`mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-sm ${
                    error === "waking" || error === "uncertain"
                      ? "bg-ayu-accent/15 text-ayu-accent"
                      : "bg-ayu-red/15 text-ayu-red"
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
                  className="max-h-[min(10rem,calc(var(--jim-vh,100dvh)*0.3))] min-h-11 min-w-0 flex-1 resize-none rounded-3xl border border-ayu-muted bg-ayu-panel px-4 py-2.5 text-base leading-6 text-ayu-text placeholder:text-ayu-subtle focus:border-ayu-accent focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Send"
                  disabled={!canSend}
                  // Keep the keyboard up: a tap on Send must not blur the box.
                  onPointerDown={(e) => e.preventDefault()}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ayu-accent transition-colors! duration-150! text-ayu-bg hover:bg-ayu-orange disabled:bg-ayu-raised disabled:text-ayu-subtle"
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

        {notesOpened && (
          <div
            id="jim-notes"
            role="tabpanel"
            aria-labelledby="jim-tab-notes"
            className={`absolute inset-0 bg-ayu-bg ${tab === "notes" ? "" : "invisible"}`}
          >
            <NotesShell
              api={api}
              getToken={getToken}
              active={tab === "notes"}
              onLog={logFromNotes}
            />
          </div>
        )}
      </div>
    </div>
  );
}
