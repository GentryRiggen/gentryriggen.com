"use client";

import { useEffect, useId, useRef } from "react";
import { Check, LoaderCircle, Volume2, X } from "lucide-react";
import type { Persona } from "@/lib/jim/personas";
import type { Personas } from "@/components/jim/usePersonas";

interface PersonaSheetProps {
  personas: Personas;
  /** The sample playing now (`persona:<id>`), if any. */
  playingKey: string | null;
  /** Plays a persona's first example in its voice; null hides "Hear it". */
  onHear: ((persona: Persona) => void) | null;
}

export function sampleKey(id: string): string {
  return `persona:${id}`;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface RowProps {
  persona: Persona;
  active: boolean;
  pending: boolean;
  /** Another row is switching: this one waits. */
  locked: boolean;
  error: string | undefined;
  playing: boolean;
  onChoose: () => void;
  onHear: (() => void) | null;
}

function PersonaRow({
  persona,
  active,
  pending,
  locked,
  error,
  playing,
  onChoose,
  onHear,
}: RowProps) {
  return (
    <li
      aria-current={active ? "true" : undefined}
      aria-busy={pending || undefined}
      className={`rounded-2xl border p-4 ${
        active
          ? "border-ayu-accent/40 bg-ayu-accent/[0.06]"
          : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="text-base font-semibold text-ayu-text">
          {persona.name}
        </h3>
        {active && (
          <span className="inline-flex items-center gap-1 rounded-full bg-ayu-accent/15 px-2 py-0.5 text-xs font-medium text-ayu-accent">
            <Check aria-hidden="true" className="size-3" strokeWidth={3} />
            Active
          </span>
        )}
      </div>
      {persona.summary && (
        <p className="mt-1 text-sm text-ayu-subtle">{persona.summary}</p>
      )}
      {persona.examples.length > 0 && (
        <ul aria-label="Examples" className="mt-2 space-y-1">
          {persona.examples.map((example) => (
            <li
              key={example}
              className="text-sm text-ayu-muted italic [overflow-wrap:anywhere]"
            >
              &ldquo;{example}&rdquo;
            </li>
          ))}
        </ul>
      )}
      {(!active || onHear) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!active && (
            <button
              type="button"
              onClick={onChoose}
              disabled={pending || locked}
              className="jim-glow inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ayu-bg hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
            >
              {pending && (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
              )}
              {pending ? "Switching…" : `Use ${persona.name}`}
            </button>
          )}
          {onHear && (
            <button
              type="button"
              onClick={onHear}
              aria-label={
                playing ? `Stop ${persona.name}` : `Hear ${persona.name}`
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.08] px-4 text-sm text-ayu-text hover:border-ayu-accent/40 hover:text-ayu-accent"
            >
              <Volume2 aria-hidden="true" className="size-4" />
              {playing ? "Stop" : "Hear it"}
            </button>
          )}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-ayu-red"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onChoose}
            disabled={locked}
            className="-my-1 min-h-11 font-medium underline underline-offset-2"
          >
            Try again
          </button>
        </p>
      )}
    </li>
  );
}

/**
 * The persona switcher: a modal sheet from the bottom listing every
 * persona (name, summary, examples), the active one marked and first.
 * Focus stays inside while it is open; Escape or Close shuts it and hands
 * focus back to where it was.
 */
export default function PersonaSheet({
  personas,
  playingKey,
  onHear,
}: PersonaSheetProps) {
  const { open, close } = personas;
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const returnTo =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();
    // On the document, not the sheet: a switch that lands removes the
    // focused button, and Escape and Tab must still work then.
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
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
      returnTo?.focus();
    };
  }, [open, close]);

  if (!open) return null;

  const { list, loading, loadError, pending, rowErrors } = personas;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div
        aria-hidden="true"
        onClick={close}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="jim-card jim-rise relative mx-auto flex max-h-[calc(var(--jim-vh,100dvh)-env(safe-area-inset-top)-1.5rem)] w-full max-w-[45rem] flex-col rounded-t-3xl! rounded-b-none! shadow-2xl!"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 pt-2 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))]">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-tight text-ayu-text"
          >
            Persona
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={close}
            className="flex size-11 items-center justify-center rounded-full text-ayu-subtle hover:bg-white/[0.06] hover:text-ayu-text"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <p role="status" className="sr-only">
          {personas.announcement}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[max(1rem,env(safe-area-inset-left))] pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {list?.stale && (
            <p className="mb-3 text-xs text-ayu-subtle">
              This list may be a little out of date.
            </p>
          )}
          {loading && !list && (
            <p
              role="status"
              className="flex items-center gap-2 py-6 text-ayu-subtle"
            >
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
              Loading personas…
            </p>
          )}
          {loadError && (
            <p
              role="alert"
              className="mb-3 flex flex-wrap items-center gap-x-3 text-sm text-ayu-red"
            >
              <span>{loadError}</span>
              <button
                type="button"
                onClick={personas.reload}
                className="-my-1 min-h-11 font-medium underline underline-offset-2"
              >
                Try again
              </button>
            </p>
          )}
          {list && (
            <ul aria-label="Personas" className="space-y-3">
              {list.personas.map((persona) => {
                const active = persona.id === list.active;
                const canHear =
                  onHear !== null &&
                  persona.examples.length > 0 &&
                  (persona.voice !== null || active);
                return (
                  <PersonaRow
                    key={persona.id}
                    persona={persona}
                    active={active}
                    pending={pending === persona.id}
                    locked={pending !== null && pending !== persona.id}
                    error={rowErrors[persona.id]}
                    playing={playingKey === sampleKey(persona.id)}
                    onChoose={() => personas.choose(persona.id)}
                    onHear={canHear ? () => onHear(persona) : null}
                  />
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
