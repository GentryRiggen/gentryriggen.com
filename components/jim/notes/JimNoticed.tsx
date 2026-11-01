"use client";

import { Rows, Section } from "@/components/jim/notes/NotesUi";
import type { Noticed } from "@/lib/jim/view";

const SHOWN = 5;

const TONE: Record<Noticed["tone"], string> = {
  over: "text-ayu-red",
  soon: "text-ayu-accent",
  "": "text-ayu-subtle",
};

interface JimNoticedProps {
  items: Noticed[];
  /** Sends a phrase straight to Jim. */
  onAsk: (text: string) => void;
}

/** What Jim noticed in the notes today. Hidden when there is nothing. */
export default function JimNoticed({ items, onAsk }: JimNoticedProps) {
  if (items.length === 0) return null;
  return (
    <Section title="Jim noticed">
      <Rows>
        {items.slice(0, SHOWN).map((n, i) => (
          <li
            key={`${n.kind}-${n.title}-${i}`}
            className="flex gap-2 py-2 pr-2 pl-4"
          >
            <div className="min-w-0 flex-1 py-1">
              <span
                className={`block text-sm font-medium ${TONE[n.tone] ?? TONE[""]}`}
              >
                {n.when}
              </span>
              <span className="mt-1 block text-ayu-text [overflow-wrap:anywhere]">
                {n.title}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onAsk(n.ask)}
              aria-label={`Ask Jim: ${n.title}`}
              className="min-h-11 shrink-0 self-center rounded-full px-3 text-sm font-medium text-ayu-accent hover:bg-white/[0.06]"
            >
              Ask Jim
            </button>
          </li>
        ))}
      </Rows>
    </Section>
  );
}
