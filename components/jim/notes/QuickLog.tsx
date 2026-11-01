"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Dumbbell, ListPlus, Syringe, X, type LucideIcon } from "lucide-react";

/**
 * Three one-tap logs on Notes Home. Each opens a small sheet, turns what was
 * typed into a plain sentence and hands it to the chat, where Jim saves it
 * like any other message.
 */

interface QuickLogProps {
  /** Gentry's local date (the payload's), YYYY-MM-DD. */
  today: string;
  /** Sends the sentence as a chat message and switches to Chat. */
  onLog: (text: string) => void;
}

type Kind = "injection" | "workout" | "todo";

const TITLES: Record<Kind, string> = {
  injection: "Log injection",
  workout: "Log workout",
  todo: "Add todo",
};

const ICONS: Record<Kind, LucideIcon> = {
  injection: Syringe,
  workout: Dumbbell,
  todo: ListPlus,
};

function QuickIcon({ kind }: { kind: Kind }) {
  const Icon = ICONS[kind];
  return (
    <Icon
      aria-hidden="true"
      className="size-4 text-ayu-accent/80 group-hover:text-ayu-accent"
    />
  );
}

/** Trimmed, without the full stop the sentence adds itself. */
function clean(text: string): string {
  return text.trim().replace(/[.\s]+$/, "");
}

export function injectionSentence(
  f: { dose: string; site: string; date: string },
  today: string
): string {
  const when = !f.date || f.date === today ? "today" : `on ${f.date}`;
  const what = [clean(f.dose), clean(f.site)].filter(Boolean).join(", ");
  return `Log my injection ${when}: ${what}.`;
}

export function workoutSentence(text: string): string {
  return `Log my workout today: ${clean(text)}.`;
}

export function todoSentence(f: {
  text: string;
  due: string;
  area: "work" | "personal";
}): string {
  return `Add a todo: ${clean(f.text)}${f.due ? `, due ${f.due}` : ""}, ${f.area}.`;
}

const FIELD =
  "min-h-11 w-full min-w-0 rounded-xl border border-white/[0.08] bg-ayu-bg/80 px-3 py-2 text-base text-ayu-text placeholder:text-ayu-subtle focus:border-ayu-accent/60 focus:ring-4 focus:ring-ayu-accent/10 focus:outline-none";

/**
 * iOS Safari gives a native date input a fixed intrinsic width that ignores
 * `w-full`, so in a two-column row it spills into its neighbour. Dropping the
 * native appearance lets it shrink to its column; the value stays left-aligned.
 */
const DATE_FIELD = `${FIELD} block max-w-full appearance-none [&::-webkit-date-and-time-value]:text-left`;

function Field({
  label,
  children,
}: {
  label: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="block text-sm text-ayu-subtle">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Makes everything but `sheet` inert (every sibling along its way up to the
 * body) and stops the Notes list behind it scrolling. Returns the undo.
 */
function lockBehind(sheet: HTMLElement): () => void {
  const undo: (() => void)[] = [];
  for (
    let node: HTMLElement = sheet;
    node.parentElement && node !== document.body;
    node = node.parentElement
  ) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue;
      if (sibling.hasAttribute("inert")) continue;
      sibling.setAttribute("inert", "");
      undo.push(() => sibling.removeAttribute("inert"));
    }
  }
  const scroller = sheet.closest<HTMLElement>("[data-notes-scroller]");
  if (scroller) {
    const before = scroller.style.overflow;
    scroller.style.overflow = "hidden";
    undo.push(() => {
      scroller.style.overflow = before;
    });
  }
  return () => undo.forEach((fn) => fn());
}

interface SheetProps {
  kind: Kind;
  today: string;
  onSend: (text: string) => void;
  onClose: () => void;
}

/**
 * A bottom sheet over the visible screen (above the keyboard on iOS). With
 * the keyboard up (the chat root's data-keyboard) it drops the home-bar
 * padding: nothing sits between the sheet and the keys.
 */
function Sheet({ kind, today, onSend, onClose }: SheetProps) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [dose, setDose] = useState("");
  const [site, setSite] = useState("");
  const [date, setDate] = useState(today);
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [area, setArea] = useState<"work" | "personal">("personal");

  useEffect(() => {
    const first =
      panelRef.current?.querySelector<HTMLElement>("input, textarea");
    first?.focus();
  }, []);

  // While open, the page behind stays put (iOS scrolls it through the
  // backdrop otherwise) and can't be reached.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return lockBehind(root);
  }, []);

  // Escape closes even when focus has left the sheet (a dismissed keyboard).
  useEffect(() => {
    function onEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose]);

  const ready = kind === "injection" ? clean(dose) !== "" : clean(text) !== "";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    onSend(
      kind === "injection"
        ? injectionSentence({ dose, site, date }, today)
        : kind === "workout"
          ? workoutSentence(text)
          : todoSentence({ text, due, area })
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !panelRef.current) return;
    const items = [
      ...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={rootRef}
      className="fixed inset-x-0 top-[var(--jim-vt,0px)] z-30 flex h-[var(--jim-vh,100dvh)] touch-none flex-col justify-end overscroll-contain lg:items-center lg:justify-center lg:p-8"
      onKeyDown={onKeyDown}
    >
      <div
        data-testid="quicklog-backdrop"
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 touch-none bg-black/50 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-full touch-auto overflow-y-auto overscroll-contain rounded-t-[1.75rem] border-t border-white/[0.08] bg-ayu-panel lg:w-full lg:max-w-lg lg:rounded-[1.75rem] lg:border pt-2 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] shadow-2xl in-data-[keyboard=open]:pb-4"
      >
        <form onSubmit={submit} className="mx-auto w-full max-w-[45rem]">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-lg font-semibold text-ayu-text">
              {TITLES[kind]}
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="-mr-2 flex size-11 items-center justify-center rounded-full text-ayu-subtle hover:bg-ayu-raised hover:text-ayu-text"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div className="mt-2 space-y-3">
            {kind === "injection" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Dose">
                    {(id) => (
                      <input
                        id={id}
                        value={dose}
                        onChange={(e) => setDose(e.target.value)}
                        placeholder="Dose"
                        autoComplete="off"
                        className={FIELD}
                      />
                    )}
                  </Field>
                  <Field label="Site">
                    {(id) => (
                      <input
                        id={id}
                        value={site}
                        onChange={(e) => setSite(e.target.value)}
                        placeholder="Site"
                        autoComplete="off"
                        className={FIELD}
                      />
                    )}
                  </Field>
                </div>
                <Field label="Date">
                  {(id) => (
                    <input
                      id={id}
                      type="date"
                      value={date}
                      max={today}
                      onChange={(e) => setDate(e.target.value)}
                      className={DATE_FIELD}
                    />
                  )}
                </Field>
              </>
            )}
            {kind === "workout" && (
              <Field label="Workout">
                {(id) => (
                  <textarea
                    id={id}
                    rows={3}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="What you did, and the score"
                    className={`${FIELD} resize-none`}
                  />
                )}
              </Field>
            )}
            {kind === "todo" && (
              <>
                <Field label="Todo">
                  {(id) => (
                    <input
                      id={id}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      autoComplete="off"
                      className={FIELD}
                    />
                  )}
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Due (optional)">
                    {(id) => (
                      <input
                        id={id}
                        type="date"
                        value={due}
                        min={today}
                        onChange={(e) => setDue(e.target.value)}
                        className={DATE_FIELD}
                      />
                    )}
                  </Field>
                  <fieldset className="min-w-0 space-y-1">
                    <legend className="text-sm text-ayu-subtle">For</legend>
                    <div className="flex rounded-xl border border-white/[0.08] bg-ayu-bg/60 p-0.5">
                      {(["work", "personal"] as const).map((a) => (
                        <label
                          key={a}
                          className={`relative flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-[10px] text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ayu-accent ${
                            area === a
                              ? "jim-glow text-ayu-bg"
                              : "text-ayu-subtle"
                          }`}
                        >
                          <input
                            type="radio"
                            name="quicklog-area"
                            value={a}
                            checked={area === a}
                            onChange={() => setArea(a)}
                            className="absolute inset-0 m-0 size-full cursor-pointer opacity-0"
                          />
                          {a === "work" ? "Work" : "Personal"}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </>
            )}
            <button
              type="submit"
              disabled={!ready}
              className="jim-glow min-h-11 w-full rounded-full font-semibold text-ayu-bg duration-150! hover:brightness-110 disabled:bg-ayu-raised disabled:bg-none disabled:text-ayu-subtle disabled:shadow-none"
            >
              Send to Jim
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** The row of quick-log buttons, and the sheet one of them opened. */
export default function QuickLog({ today, onLog }: QuickLogProps) {
  const [open, setOpen] = useState<Kind | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  /** Focus goes back to the opener once the sheet (and its lock) is gone. */
  const refocus = useRef(false);

  const close = useCallback(() => {
    refocus.current = true;
    setOpen(null);
  }, []);

  useEffect(() => {
    if (open !== null || !refocus.current) return;
    refocus.current = false;
    openerRef.current?.focus();
  }, [open]);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TITLES) as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-haspopup="dialog"
            onClick={(e) => {
              openerRef.current = e.currentTarget;
              setOpen(k);
            }}
            className="group flex min-h-11 items-center gap-2 rounded-full border border-white/[0.08] bg-ayu-panel/70 pr-4 pl-3 text-sm font-medium text-ayu-text shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] backdrop-blur hover:border-ayu-accent/40 hover:text-ayu-accent"
          >
            <QuickIcon kind={k} />
            {TITLES[k]}
          </button>
        ))}
      </div>
      {open && (
        <Sheet
          kind={open}
          today={today}
          onClose={close}
          onSend={(text) => {
            setOpen(null);
            onLog(text);
          }}
        />
      )}
    </>
  );
}
