"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowUp,
  Check,
  Lock,
  Maximize2,
  SquarePen,
  Square,
  Sunrise,
  Volume2,
} from "lucide-react";
import AppLockSheet from "@/components/jim/AppLockSheet";
import JimHeader, { type JimTab } from "@/components/jim/JimHeader";
import JimMark from "@/components/jim/JimMark";
import JimSidebar, { type SidebarAction } from "@/components/jim/JimSidebar";
import { onPlainClick } from "@/components/jim/notes/NotesUi";
import useBasePage from "@/components/jim/useBasePage";
import useJimRouter, {
  replaceWithJimHome,
  type JimLocation,
} from "@/components/jim/useJimRouter";
import useWideLayout from "@/components/jim/useWideLayout";
import JimUpdatePill from "@/components/jim/JimUpdatePill";
import useJimUpdate from "@/components/jim/useJimUpdate";
import NowPlayingBar from "@/components/jim/NowPlayingBar";
import PersonaSheet, { sampleKey } from "@/components/jim/PersonaSheet";
import NotesShell, {
  type NotesRouting,
} from "@/components/jim/notes/NotesShell";
import useMorningBriefing from "@/components/jim/useMorningBriefing";
import usePersonas from "@/components/jim/usePersonas";
import type { AppLock } from "@/components/jim/useAppLock";
import useReadAloud from "@/components/jim/useReadAloud";
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
import { clearDraft, loadDraft, saveDraft } from "@/lib/jim/draft";
import JimMarkdown from "@/lib/jim/markdown";
import {
  CHAT_ROUTE,
  formatJimPath,
  HOME_ROUTE,
  isDetail,
  type JimRoute,
  type NotesPage,
  type NotesRoute,
} from "@/lib/jim/routes";
import {
  allowedSay,
  clearSayFromLocation,
  sayFromLocation,
} from "@/lib/jim/say";

interface JimChatProps {
  /** The signed-in user, whose chat is kept on this device. */
  uid: string;
  /** The server's base URL. */
  api: string;
  getToken: (force?: boolean) => Promise<string | null>;
  onSignOut: () => void;
  /**
   * The app lock. While locked nothing of the chat is drawn (no text in the
   * page or the accessibility tree); its state lives on underneath.
   */
  lock?: AppLock;
  /** Signs out and wipes this device's Jim data, then says `notice`. */
  onWipe?: (notice: string) => void;
}

type Message = ChatMessage;

/** The reply being written: Jim's latest step, his text so far, saving. */
interface Live {
  step: string | null;
  text: string;
  saving: boolean;
  /** The server's whole reply has arrived, links checked: they may be tappable. */
  final: boolean;
}

const NO_LIVE: Live = { step: null, text: "", saving: false, final: false };

const ERRORS: Record<JimErrorKind, string> = {
  waking: "Jim is waking up, one moment",
  uncertain: "Jim may have saved this — check before sending again",
  server: "Couldn't reach Jim",
  denied: "Jim didn't accept your sign-in. Sign out and back in.",
  rejected: "Jim couldn't take that message. Try a shorter one.",
};

/** Starters on an empty chat: a tap puts one in the box to finish or send. */
const STARTERS = [
  "What's on today?",
  "What's due this week?",
  "Remember that ",
];

/** After this long, the thinking indicator says it is still working. */
const SLOW_MS = 20_000;

/** Closer than this to the bottom counts as reading the latest message. */
const STICK_PX = 80;

/** "Searching notes" → "Searching notes…" (one ellipsis, however sent). */
function stepLabel(step: string | null): string {
  return `${(step ?? "").replace(/[.…\s]+$/, "")}…`;
}

interface ListenButtonProps {
  speaking: boolean;
  onClick: () => void;
}

/** Reads a reply aloud, or stops it. 44px to tap, calm to look at. */
function ListenButton({ speaking, onClick }: ListenButtonProps) {
  const label = speaking ? "Stop" : "Listen";
  const Icon = speaking ? Square : Volume2;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`-my-2 -ml-2 flex size-11 shrink-0 items-center justify-center rounded-full transition-colors! duration-150! ${
        speaking ? "text-ayu-accent" : "text-ayu-subtle hover:text-ayu-text"
      }`}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
}

interface MessageListProps {
  messages: Message[];
  /** The message the error banner speaks for, if any. */
  heldId: number | null;
  /** The reply being read aloud, if any. */
  speakingId: number | null;
  /** Reading aloud is available; null hides the Listen buttons. */
  onListen: ((id: number, text: string) => void) | null;
}

/**
 * The finished messages. Memoized: a streaming reply redraws every frame,
 * and only its own bubble should re-render, not every message above it.
 */
const MessageList = memo(function MessageList({
  messages,
  heldId,
  speakingId,
  onListen,
}: MessageListProps) {
  return (
    <>
      {messages.map((m) =>
        m.from === "me" ? (
          <div key={m.id} className="jim-rise ml-auto max-w-[85%] min-w-0">
            <div className="jim-glow rounded-[1.25rem] rounded-br-md px-4 py-2.5 whitespace-pre-wrap text-ayu-bg [overflow-wrap:anywhere]">
              {m.text}
            </div>
            {/* The banner says it for the message just sent. */}
            {m.uncertain && heldId !== m.id && (
              <p className="mt-1 px-1 text-right text-xs text-ayu-subtle">
                {ERRORS.uncertain}
              </p>
            )}
          </div>
        ) : (
          <div key={m.id} className="jim-rise mr-auto max-w-[92%] min-w-0">
            <div className="jim-card rounded-[1.25rem] rounded-bl-md px-4 py-3">
              <JimMarkdown
                text={m.text}
                links={m.uncertain ? "plain" : "label-url"}
              />
            </div>
            {(onListen && !m.uncertain) ||
            (m.changed && m.changed.length > 0) ? (
              <div className="mt-1 flex items-center gap-1 px-1">
                {onListen && !m.uncertain && (
                  <ListenButton
                    speaking={speakingId === m.id}
                    onClick={() => onListen(m.id, m.text)}
                  />
                )}
                {m.changed && m.changed.length > 0 && (
                  <p className="flex min-w-0 items-start gap-1.5 text-xs text-ayu-subtle [overflow-wrap:anywhere]">
                    <span
                      aria-hidden="true"
                      className="mt-px flex size-3.5 shrink-0 items-center justify-center rounded-full bg-ayu-green/15 text-ayu-green"
                    >
                      <Check className="size-2.5" strokeWidth={3.5} />
                    </span>
                    <span>Saved: {m.changed.join(", ")}</span>
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )
      )}
    </>
  );
});

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** False while the device says it has no connection. */
function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine !== false,
    () => true
  );
}

function isPhone(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True while a field has the keys: Esc and shortcuts are the field's then. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** Notes before it has been opened: Home, as a fresh entry. */
const NOTES_START: JimLocation = {
  route: HOME_ROUTE,
  key: "notes-start",
  depth: 0,
  back: null,
  from: null,
  nav: "initial",
};

export default function JimChat({
  uid,
  api,
  getToken,
  onSignOut,
  lock,
  onWipe,
}: JimChatProps) {
  const locked = lock?.locked === true;
  // Back from this device: a reload keeps the conversation and its session.
  const [kept] = useState(() => loadHistory(uid));
  const [session, setSession] = useState(
    () => kept?.session ?? crypto.randomUUID()
  );
  const [messages, setMessages] = useState<Message[]>(
    () => kept?.messages ?? []
  );
  const [live, setLive] = useState<Live>(NO_LIVE);
  // A notification can open /jim?say=quiz%20me: the text waits in the box,
  // unsent, for Gentry to send.
  const [draft, setDraft] = useState(() => sayFromLocation() ?? loadDraft(uid));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<JimErrorKind | null>(null);
  /** A message Jim may have acted on, kept out of the box until asked for. */
  const [held, setHeld] = useState<{ id: number; text: string } | null>(null);
  const [slow, setSlow] = useState(false);
  const [phone] = useState(isPhone);
  const [mac] = useState(isMac);
  const { location, navigate, goBack } = useJimRouter();
  const route = location.route;
  const tab: JimTab = route.kind === "chat" ? "chat" : "notes";
  const wide = useWideLayout();
  /** The last Notes entry: what Notes shows (hidden) while Chat does. */
  const [notesLocation, setNotesLocation] = useState<JimLocation>(() =>
    route.kind === "chat" ? NOTES_START : location
  );
  if (route.kind !== "chat" && notesLocation !== location) {
    setNotesLocation(location);
  }
  const notesRoute = notesLocation.route as NotesRoute;
  const basePage = useBasePage(notesRoute);
  /** Notes is built (and fetches) only once it has been opened. */
  const notesOpened = notesLocation !== NOTES_START;
  /** The search across all notes: in the page only, never the address. */
  const [notesSearch, setNotesSearch] = useState("");
  const [lockSheetOpen, setLockSheetOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(
    (kept?.messages ?? []).reduce((max, m) => Math.max(max, m.id + 1), 0)
  );
  /** Bumped by New chat: a turn still out then is dropped when it lands. */
  const chatRun = useRef(0);
  /** Cancels the turn that is out (New chat, sign-out, leaving the page). */
  const turn = useRef<AbortController | null>(null);
  /** Signed out: nothing more is kept on this device. */
  const signedOut = useRef(false);
  /** Reply text as it streams in, drawn once per animation frame. */
  const liveText = useRef("");
  const frame = useRef<number | null>(null);
  /** False once Gentry scrolls up to read; true again at the bottom. */
  const stuck = useRef(true);
  const lastTop = useRef(0);

  const keyboardOpen = useVisibleViewport(rootRef, !locked);
  const online = useOnline();
  const briefing = useMorningBriefing(getToken, api);
  const reader = useReadAloud(getToken, api, locked);
  const { stop: stopReading, setArtist } = reader;
  const personas = usePersonas(getToken, api);
  const barShown = reader.state.status !== "idle";
  // Locking shuts the lock's settings (the reader stops itself).
  useLayoutEffect(() => {
    if (locked) setLockSheetOpen(false);
  }, [locked]);
  // The lock screen names whoever Jim is speaking as.
  useEffect(() => {
    setArtist(personas.activeName ?? "Jim");
  }, [personas.activeName, setArtist]);
  // The latest auto-read, for the turn that outlives the render it began in.
  const readNewRef = useRef(reader.readNew);
  useLayoutEffect(() => {
    readNewRef.current = reader.readNew;
  });

  const scrollToEnd = useCallback((smooth: boolean) => {
    const el = scrollerRef.current;
    if (!el || typeof el.scrollTo !== "function") return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "instant",
    });
  }, []);

  useEffect(() => clearSayFromLocation(), []);
  // A draft kept across an update reload is restored once, then dropped.
  useEffect(() => clearDraft(uid), [uid]);

  // A notification tapped while this page is open: the service worker sends
  // its text here. Only allowed text, and only into an empty box.
  useEffect(() => {
    const worker =
      "serviceWorker" in navigator ? navigator.serviceWorker : undefined;
    // A partial or missing container (some browsers, test stubs) must never
    // take the chat down with it.
    if (typeof worker?.addEventListener !== "function") return;
    function onMessage(event: MessageEvent) {
      const data: unknown = event.data;
      if (typeof data !== "object" || data === null) return;
      const { type, say } = data as { type?: unknown; say?: unknown };
      const text = type === "JIM_SAY" ? allowedSay(say) : null;
      if (text) setDraft((current) => (current ? current : text));
    }
    worker.addEventListener("message", onMessage);
    // Messages queue until started; addEventListener alone doesn't start them.
    (worker as { startMessages?: () => void }).startMessages?.();
    return () => worker.removeEventListener("message", onMessage);
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

  // The now-playing bar adds room under the list: keep the end in view.
  useEffect(() => {
    if (stuck.current) scrollToEnd(true);
  }, [barShown, scrollToEnd]);

  // A reply growing as it streams keeps its end in view (no smooth scroll:
  // it would lag behind the text).
  useEffect(() => {
    if (stuck.current) scrollToEnd(false);
  }, [live, scrollToEnd]);

  // Keep the chat on this device. A message still out is stored as
  // uncertain, so a reload mid-turn never offers it as unsent.
  useEffect(() => {
    if (signedOut.current) return;
    saveHistory(uid, { session, messages });
  }, [uid, session, messages]);

  useEffect(
    () => () => {
      chatRun.current += 1;
      turn.current?.abort();
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
  }, [scrollToEnd, locked, wide, tab]);

  // Unlocked, or the chat moved (the desktop docks it beside Notes): the
  // list is drawn afresh, at its end.
  const chatDocked = wide && tab === "notes";
  useLayoutEffect(() => {
    if (locked) return;
    stuck.current = true;
    scrollToEnd(false);
  }, [locked, scrollToEnd, wide, chatDocked]);

  // Grow the box with its text, up to its max height (10rem, or 30% of the
  // visible screen when that is less), then it scrolls.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
  }, [draft, locked]);

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
        setLive((prev) => ({ ...prev, text: event.text, final: true }));
        break;
      case "saving":
        setLive((prev) => ({ ...prev, saving: true }));
        break;
    }
  }

  /** Sends the box, or `given` (a quick log) leaving the box alone. */
  async function send(given?: string) {
    const text = (given ?? draft).trim();
    // Offline it would only bounce back: the box keeps it meanwhile.
    if (!text || sending || !online) return;
    // Every send starts from a tap or key press: unlock speech inside it.
    reader.unlock();
    const id = nextId.current++;
    const run = chatRun.current;
    setError(null);
    setHeld(null);
    setSlow(false);
    setSending(true);
    if (given === undefined) {
      setDraft("");
      clearDraft(uid);
    }
    stopDrawing();
    liveText.current = "";
    setLive(NO_LIVE);
    stuck.current = true;
    setMessages((prev) => [...prev, { id, from: "me", text, pending: true }]);
    const settle = (m: Message): Message =>
      m.id === id ? { id, from: "me", text } : m;
    const controller = new AbortController();
    turn.current = controller;
    try {
      const reply = await streamToJim(
        text,
        session,
        getToken,
        (event) => {
          if (run === chatRun.current) onStream(event);
        },
        undefined,
        api,
        undefined,
        undefined,
        controller.signal
      );
      if (run !== chatRun.current) return;
      const replyId = nextId.current++;
      setMessages((prev) => [
        ...prev.map(settle),
        { id: replyId, from: "jim", text: reply.reply, changed: reply.changed },
      ]);
      readNewRef.current(replyId, reply.reply);
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
      if (turn.current === controller) turn.current = null;
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
    clearDraft(uid);
    chatRun.current += 1;
    turn.current?.abort();
    stopDrawing();
    liveText.current = "";
    stopReading();
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
    // A tap on a tab doesn't take focus on iOS: drop the keyboard by hand,
    // whichever field (the box, a search, a quick log) has it.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (next === "chat") {
      navigate(CHAT_ROUTE);
      return;
    }
    // Chat was opened from the Notes entry just before it: step back to
    // it (its scroll and back link intact) rather than stack another.
    if (
      route.kind === "chat" &&
      notesOpened &&
      location.depth === notesLocation.depth + 1 &&
      location.depth > 0
    ) {
      window.history.back();
      return;
    }
    navigate(notesRoute);
  }

  /** A Notes page from the sidebar: leaves any search for it. */
  function goToRoute(next: JimRoute) {
    if (next.kind === "page" && notesSearch) setNotesSearch("");
    navigate(next);
  }

  /** The sidebar's search: results show in the page, never the address. */
  function searchFromSidebar(value: string) {
    setNotesSearch(value);
    if (value.trim() && route.kind !== "page") {
      navigate({ kind: "page", page: basePage });
    }
  }

  /** Leaves no person's or note's address showing on a shared screen. */
  function forgetAddress() {
    try {
      replaceWithJimHome();
    } catch {
      // Best effort.
    }
  }

  /** Drops the turn that is out and keeps nothing more on this device. */
  function signOut() {
    forgetAddress();
    clearDraft(uid);
    signedOut.current = true;
    stopReading();
    chatRun.current += 1;
    turn.current?.abort();
    onSignOut();
  }

  /** Too many wrong PINs or a forgotten one: out, and the device wiped. */
  function wipe(notice: string) {
    forgetAddress();
    setLockSheetOpen(false);
    signedOut.current = true;
    stopReading();
    chatRun.current += 1;
    turn.current?.abort();
    onWipe?.(notice);
  }

  // The latest send and turn state, for the stable quick-log callback.
  const sendRef = useRef(send);
  const holdRef = useRef(sending || !online);
  /** On a phone a quick log switches to Chat; on a desktop it is beside. */
  const wideRef = useRef(wide);
  useLayoutEffect(() => {
    sendRef.current = send;
    holdRef.current = sending || !online;
    wideRef.current = wide;
  });

  /**
   * A quick log on Notes: sent as a message, and Chat shows Jim's reply as
   * it comes. While another turn is out (or offline) it waits in the box.
   * Stable, so the (memoized) Notes tree doesn't redraw with every frame
   * of a streaming reply.
   */
  const logFromNotes = useCallback(
    (text: string) => {
      stuck.current = true;
      if (!wideRef.current) navigate(CHAT_ROUTE);
      if (holdRef.current) {
        setDraft((current) => (current ? `${text}\n${current}` : text));
      } else void sendRef.current(text);
    },
    [navigate]
  );

  const closeLockSheet = useCallback(() => setLockSheetOpen(false), []);

  /**
   * A Needs-you row whose words came from outside (email, calendar, Asana):
   * never sent for him. It lands in the box, unsent, ahead of any draft, so
   * he reads it and taps Send himself. No focus: the box is still hidden in
   * this tap, and a late focus would fight iOS.
   */
  const draftFromNotes = useCallback(
    (text: string) => {
      stuck.current = true;
      if (!wideRef.current) navigate(CHAT_ROUTE);
      setDraft((current) => (current ? `${text}\n${current}` : text));
    },
    [navigate]
  );

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

  const returnIsNewLine = phone && !wide;

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // The phone layout on a touch screen: Return is a new line and the Send
    // button sends. Otherwise (the desktop layout, an iPad with a keyboard,
    // a mouse): Enter sends, Shift+Enter is a new line.
    if (event.key !== "Enter" || event.shiftKey || returnIsNewLine) return;
    // Mid-composition (IME); Safari reports its commit Enter as keyCode 229.
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      return;
    }
    event.preventDefault();
    void send();
  }

  const canSend = draft.trim().length > 0 && !sending && online;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const keepDraft = useCallback(() => saveDraft(uid, draftRef.current), [uid]);
  const jimUpdate = useJimUpdate({ onBeforeUpdate: keepDraft });

  const routing = useMemo<NotesRouting>(
    () => ({
      route: notesRoute,
      basePage,
      entryKey: notesLocation.key,
      navType: notesLocation.nav,
      backLabel: notesLocation.back,
      backFrom: notesLocation.from,
      navigate,
      goBack,
      search: notesSearch,
      onSearch: setNotesSearch,
      wide,
    }),
    [notesRoute, basePage, notesLocation, navigate, goBack, notesSearch, wide]
  );

  // The browser tab names the page (Notes names its own). Locked: just Jim.
  useEffect(() => {
    if (locked) document.title = "Jim";
    else if (route.kind === "chat") document.title = "Chat · Jim";
  }, [locked, route]);
  useEffect(
    () => () => {
      document.title = "Jim";
    },
    []
  );

  // Desktop keys: ⌘K (Ctrl+K) to search, Esc back out of a profile or note.
  const keysRef = useRef({ route, basePage, sheetOpen: false });
  useLayoutEffect(() => {
    keysRef.current = {
      route,
      basePage,
      sheetOpen: personas.open || lockSheetOpen,
    };
  });
  useEffect(() => {
    if (!wide || locked) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented) return;
      const { route: at, basePage: under, sheetOpen } = keysRef.current;
      if (
        event.key.toLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (
        event.key === "Escape" &&
        isDetail(at) &&
        !sheetOpen &&
        !isTyping(event.target) &&
        !document.querySelector("[role=dialog]")
      ) {
        event.preventDefault();
        goBack({ kind: "page", page: under });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [wide, locked, goBack]);

  // A page reached by a link or Back: say its name, and on a desktop move
  // focus to its heading (never out of a field being typed in).
  const [announced, setAnnounced] = useState("");
  const chatHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusComposerNext = useRef(false);
  useEffect(() => {
    if (locked || location.nav === "initial") return;
    const frame = requestAnimationFrame(() => {
      setAnnounced(document.title.replace(/ · Jim$/, ""));
      if (focusComposerNext.current) {
        focusComposerNext.current = false;
        boxRef.current?.focus({ preventScroll: true });
        return;
      }
      if (!wideRef.current || isTyping(document.activeElement)) return;
      const heading =
        location.route.kind === "chat"
          ? chatHeadingRef.current
          : [
              ...document.querySelectorAll<HTMLElement>(
                "#jim-notes-page h1, #jim-notes-page h2"
              ),
            ].find((el) => el.getClientRects().length > 0);
      if (!heading) return;
      if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [location, locked]);

  if (locked) return null;

  const lockItem =
    lock && onWipe
      ? {
          label: `App lock: ${lock.enabled ? "On" : "Off"}`,
          onSelect: () => setLockSheetOpen(true),
        }
      : null;

  const chatBody = (
    <>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div
          role="log"
          aria-label="Conversation"
          className={`mx-auto flex w-full max-w-[45rem] flex-col gap-4 py-4 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] transition-[padding] duration-200 motion-reduce:transition-none sm:py-6 ${
            // Room under the last message for the now-playing bar,
            // which floats over the list instead of pushing it up.
            barShown ? "pb-[4.25rem]! sm:pb-[4.75rem]!" : ""
          }`}
        >
          {messages.length === 0 && !sending && (
            <div className="jim-rise flex flex-col items-center px-2 pt-[min(12vh,5rem)] pb-6 text-center">
              <JimMark size="lg" />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-ayu-text">
                What&apos;s on your mind?
              </h2>
              <p className="mt-2 max-w-xs text-ayu-subtle">
                Ask Jim something, or tell him something to remember.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => {
                      setDraft(starter);
                      boxRef.current?.focus({ preventScroll: true });
                    }}
                    className="min-h-11 rounded-full border border-white/[0.08] bg-ayu-panel/70 px-4 text-sm text-ayu-text backdrop-blur hover:border-ayu-accent/40 hover:text-ayu-accent"
                  >
                    {starter.trim()}
                    {starter.endsWith(" ") ? "…" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
          <MessageList
            messages={messages}
            heldId={held?.id ?? null}
            speakingId={reader.speakingId}
            onListen={reader.supported ? reader.toggle : null}
          />
          {sending && (
            <div className="jim-rise mr-auto max-w-[92%] min-w-0">
              {live.text ? (
                <div
                  aria-busy="true"
                  className="jim-card rounded-[1.25rem] rounded-bl-md px-4 py-3"
                >
                  <JimMarkdown
                    text={live.text}
                    links={live.final ? "label-url" : "plain"}
                  />
                </div>
              ) : (
                <p
                  role="status"
                  className="jim-card flex items-center gap-3 rounded-[1.25rem] rounded-bl-md px-4 py-3 text-ayu-subtle"
                >
                  <span aria-hidden="true" className="flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className={`jim-dot size-1.5 rounded-full bg-ayu-accent ${
                          delay === 150
                            ? "[animation-delay:150ms]"
                            : delay === 300
                              ? "[animation-delay:300ms]"
                              : ""
                        }`}
                      />
                    ))}
                  </span>
                  {slow ? "Still working…" : "Jim is thinking…"}
                </p>
              )}
              {(live.saving || live.step) && (
                <p
                  role="status"
                  className="mt-1.5 px-1 text-xs text-ayu-subtle [overflow-wrap:anywhere]"
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
        className={`shrink-0 pt-1 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] ${
          // Over the keyboard the pill sits 4px off the keys (its own
          // border and padding make up the rest of the 8px).
          keyboardOpen ? "pb-1" : "pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        }`}
      >
        <div className="relative mx-auto w-full max-w-[45rem] px-3 sm:px-4">
          {/* Floats just above the composer (and so above the keyboard),
            over the end of the list: showing it moves nothing. */}
          <div className="absolute inset-x-3 bottom-full sm:inset-x-4">
            <NowPlayingBar
              state={reader.state}
              onTogglePause={reader.togglePause}
              onSpeed={reader.setSpeed}
              onStop={reader.stop}
              onDismiss={reader.dismiss}
            />
          </div>
          {!online && (
            <p
              role="status"
              className="jim-rise mb-2 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-ayu-panel/80 px-3 py-2 text-sm text-ayu-subtle backdrop-blur"
            >
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-ayu-muted"
              />
              You&apos;re offline
            </p>
          )}
          {error && (
            <p
              role="alert"
              className={`jim-rise mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-sm backdrop-blur ${
                error === "waking" || error === "uncertain"
                  ? "border-ayu-accent/25 bg-ayu-accent/10 text-ayu-accent"
                  : "border-ayu-red/25 bg-ayu-red/10 text-ayu-red"
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
          <div className="jim-glass flex items-end gap-2 rounded-[1.6rem] border border-white/[0.08] p-1 shadow-[0_12px_40px_-16px_rgb(0_0_0/0.8)] transition-colors duration-200 focus-within:border-ayu-accent/50 focus-within:shadow-[0_0_0_4px_rgb(255_204_102/0.08),0_12px_40px_-16px_rgb(0_0_0/0.8)]">
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
              enterKeyHint={returnIsNewLine ? "enter" : "send"}
              autoComplete="off"
              className="max-h-[min(10rem,calc(var(--jim-vh,100dvh)*0.3))] min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 pr-1 pl-3.5 text-base leading-6 text-ayu-text placeholder:text-ayu-subtle focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!canSend}
              // Keep the keyboard up: a tap on Send must not blur the box.
              onPointerDown={(e) => e.preventDefault()}
              className={`flex size-11 shrink-0 items-center justify-center rounded-full duration-200! ${
                canSend
                  ? "jim-glow text-ayu-bg hover:brightness-110"
                  : "bg-white/[0.06] text-ayu-subtle"
              }`}
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
    </>
  );

  const notes = notesOpened && (
    <NotesShell
      uid={uid}
      api={api}
      getToken={getToken}
      active={tab === "notes"}
      onLog={logFromNotes}
      onDraft={draftFromNotes}
      routing={routing}
    />
  );

  const updatePill = jimUpdate.isUpdateReady && (
    <JimUpdatePill onUpdate={jimUpdate.update} disabled={sending} />
  );

  const docked = wide && route.kind !== "chat";
  const sidebarActive: "chat" | NotesPage | null =
    route.kind === "chat"
      ? "chat"
      : route.kind === "notFound"
        ? null
        : basePage;
  const sidebarActions: SidebarAction[] = [
    { label: "New chat", icon: SquarePen, onSelect: newChat },
    ...(reader.menuItem ? [{ ...reader.menuItem, icon: Volume2 }] : []),
    ...(briefing.item ? [{ ...briefing.item, icon: Sunrise }] : []),
    ...(lockItem ? [{ ...lockItem, icon: Lock }] : []),
  ];

  // One tree for both widths: crossing the breakpoint (an iPad rotating,
  // Split View) only moves things, so the chat, Notes and every field in
  // them stay mounted, and the root the viewport hook writes to is the same.
  const layout = (
    <div
      ref={rootRef}
      // Behind a sheet nothing can be tapped, focused or read.
      inert={personas.open || lockSheetOpen}
      data-keyboard={keyboardOpen ? "open" : "closed"}
      data-layout={wide ? "wide" : "phone"}
      className={`jim-app fixed inset-x-0 top-[var(--jim-vt,0px)] flex h-[var(--jim-vh,100dvh)] overflow-hidden bg-ayu-bg text-ayu-text ${
        wide ? "" : "flex-col"
      }`}
    >
      {wide ? (
        <JimSidebar
          active={sidebarActive}
          onNavigate={goToRoute}
          busy={sending}
          search={notesSearch}
          onSearch={searchFromSidebar}
          searchRef={searchRef}
          shortcut={mac ? "⌘K" : "Ctrl K"}
          persona={{
            name: personas.activeName ?? null,
            onOpen: personas.menuItem.onSelect,
          }}
          actions={sidebarActions}
          onSignOut={signOut}
        />
      ) : null}
      {wide ? null : (
        <JimHeader
          busy={sending}
          onSignOut={signOut}
          tab={tab}
          onTab={showTab}
          menuItems={[
            { label: "New chat", onSelect: newChat },
            personas.menuItem,
            ...(reader.menuItem ? [reader.menuItem] : []),
            ...(briefing.item ? [briefing.item] : []),
            ...(lockItem ? [lockItem] : []),
          ]}
        />
      )}

      <div className="relative min-h-0 min-w-0 flex-1">
        {updatePill}
        <div
          id="jim-chat"
          role={wide ? (docked ? "complementary" : "region") : "tabpanel"}
          aria-label={wide ? "Chat with Jim" : undefined}
          aria-labelledby={wide ? undefined : "jim-tab-chat"}
          className={
            docked
              ? "absolute inset-y-0 right-0 z-10 flex w-[24rem] flex-col border-l border-white/[0.06] bg-ayu-bg/60 xl:w-[26rem]"
              : `absolute inset-0 flex flex-col ${tab === "chat" || wide ? "" : "invisible"}`
          }
        >
          {wide && !docked ? (
            <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] px-8">
              <h1
                ref={chatHeadingRef}
                tabIndex={-1}
                className="text-lg font-semibold tracking-tight text-ayu-text"
              >
                Chat
              </h1>
              {personas.activeName && (
                <span className="text-sm text-ayu-subtle">
                  as {personas.activeName}
                </span>
              )}
            </div>
          ) : null}
          {docked ? (
            <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/[0.06] pr-3 pl-5">
              <JimMark busy={sending} />
              <h2 className="min-w-0 flex-1 truncate font-semibold tracking-tight text-ayu-text">
                Chat with Jim
              </h2>
              <a
                href={formatJimPath(CHAT_ROUTE)}
                onClick={onPlainClick(() => {
                  focusComposerNext.current = true;
                  navigate(CHAT_ROUTE);
                })}
                aria-label="Open chat full width"
                title="Open chat full width"
                className="flex size-10 items-center justify-center rounded-full text-ayu-subtle hover:bg-white/[0.06] hover:text-ayu-text"
              >
                <Maximize2 aria-hidden="true" className="size-4" />
              </a>
            </div>
          ) : null}
          {chatBody}
        </div>

        {notesOpened && (
          <div
            id="jim-notes"
            role={wide ? undefined : "tabpanel"}
            aria-labelledby={wide ? undefined : "jim-tab-notes"}
            className={`absolute inset-y-0 left-0 ${
              docked ? "right-[24rem] xl:right-[26rem]" : "right-0"
            } ${tab === "notes" ? "" : "invisible"}`}
          >
            {notes}
          </div>
        )}
      </div>
      {/* Says where a link went, for a screen reader. */}
      <p aria-live="polite" className="sr-only">
        {announced}
      </p>
      {briefing.notice}
    </div>
  );

  return (
    <>
      {layout}
      <PersonaSheet
        personas={personas}
        playingKey={reader.state.key}
        onHear={
          reader.supported
            ? (persona) =>
                reader.toggleSample(
                  sampleKey(persona.id),
                  persona.examples[0] ?? "",
                  persona.voice ?? undefined
                )
            : null
        }
        sampleError={
          reader.state.status === "error" &&
          reader.state.errorKey?.startsWith("persona:") &&
          reader.state.error
            ? { key: reader.state.errorKey, message: reader.state.error }
            : null
        }
      />
      {lock && onWipe && (
        <AppLockSheet
          lock={lock}
          open={lockSheetOpen}
          onClose={closeLockSheet}
          onWipe={wipe}
        />
      )}
    </>
  );
}
