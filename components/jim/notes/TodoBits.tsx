"use client";

import { Check, LoaderCircle } from "lucide-react";
import type { DoneToast, Toast } from "@/components/jim/notes/useTodoSaves";

interface TodoCheckboxProps {
  /** Read out for the box: the todo's title. */
  label: string;
  checked: boolean;
  /** Saving: it spins, and a tap does nothing. */
  pending: boolean;
  onToggle: (done: boolean) => void;
}

/** A todo's box: 44px to tap, a 22px box to see. Home and Todos share it. */
export function TodoCheckbox({
  label,
  checked,
  pending,
  onToggle,
}: TodoCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-busy={pending || undefined}
      aria-label={label}
      onClick={() => {
        if (!pending) onToggle(!checked);
      }}
      className="group flex size-11 shrink-0 items-center justify-center rounded-full transition-colors! duration-150!"
    >
      <span
        aria-hidden="true"
        className={`flex size-[22px] items-center justify-center rounded-md border-2 ${
          checked
            ? "jim-glow border-transparent text-ayu-bg"
            : "border-ayu-muted group-hover:border-ayu-accent group-hover:bg-ayu-accent/10"
        }`}
      >
        {pending ? (
          <LoaderCircle
            className={`size-3.5 animate-spin motion-reduce:animate-none ${checked ? "" : "text-ayu-accent"}`}
            strokeWidth={3}
          />
        ) : (
          checked && <Check className="size-4" strokeWidth={3} />
        )}
      </span>
    </button>
  );
}

interface ToastBarProps {
  toast: Toast | null;
  onUndo: (toast: DoneToast) => void;
}

/**
 * "Done · Undo", or why a save failed. Floats above the home bar (and above
 * the now-playing bar JimChat docks over a phone's Notes); always in the
 * page, so it is announced.
 */
export function ToastBar({ toast, onUndo }: ToastBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex group-data-[dock=bar]/notes:bottom-[4.75rem] group-data-[dock=both]/notes:bottom-[8.25rem] group-data-[dock=chip]/notes:bottom-[3.5rem] justify-center pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]">
      <div role="status" aria-live="polite" className="contents">
        {toast && (
          <div
            key={toast.id}
            className={`jim-rise pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-white/[0.08] bg-ayu-raised/90 py-1 pr-1 pl-5 shadow-2xl shadow-black/60 backdrop-blur-xl ${
              toast.kind === "error" ? "text-ayu-red" : "text-ayu-text"
            } ${toast.kind === "error" ? "pr-5" : ""}`}
          >
            {toast.kind === "done" ? (
              <>
                <span className="min-h-12 content-center">Done</span>
                <span aria-hidden="true" className="text-ayu-subtle">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => onUndo(toast)}
                  className="min-h-12 rounded-full px-3 font-medium text-ayu-accent hover:bg-white/[0.06]"
                >
                  Undo
                </button>
              </>
            ) : (
              <span className="min-h-12 content-center [overflow-wrap:anywhere]">
                {toast.message}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
