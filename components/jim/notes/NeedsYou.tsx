"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Chip, Rows, Section } from "@/components/jim/notes/NotesUi";
import { fmtShort } from "@/lib/jim/todos";
import { localDay } from "@/lib/jim/notesData";
import type { ViewAction } from "@/lib/jim/view";

const SHOWN = 6;

/**
 * Kinds built from Gentry's own notes, so one tap sends them to Jim. Every
 * other kind (email, calendar, Asana, anything new) carries words written by
 * outsiders: it goes to the message box unsent, for him to read and send.
 */
const OWN_KINDS = new Set(["Todo", "Gift", "1:1", "Practice"]);

const TONE: Record<ViewAction["tone"], string> = {
  over: "text-ayu-red",
  soon: "text-ayu-accent",
  "": "text-ayu-subtle",
};

interface NeedsYouProps {
  actions: ViewAction[];
  actionsAsOf?: string;
  today: string;
  /** Sends a phrase straight to Jim (rows from Gentry's own notes). */
  onAsk: (text: string) => void;
  /** Puts a phrase in the message box, unsent (rows with outside text). */
  onDraft: (text: string) => void;
}

/** What needs Gentry. Titles come from outsiders: text nodes only. */
export default function NeedsYou({
  actions,
  actionsAsOf,
  today,
  onAsk,
  onDraft,
}: NeedsYouProps) {
  const [all, setAll] = useState(false);
  if (!actions.length) return null;
  const shown = all ? actions : actions.slice(0, SHOWN);
  const stamp =
    actionsAsOf && !Number.isNaN(Date.parse(actionsAsOf))
      ? localDay(actionsAsOf)
      : null;
  return (
    <Section title="Needs you">
      <Rows>
        {shown.map((a, i) => {
          const own = OWN_KINDS.has(a.kind);
          return (
            <li
              key={`${a.kind}-${a.title}-${i}`}
              className="flex gap-2 py-2 pr-2 pl-4"
            >
              <div className="min-w-0 flex-1 py-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Chip tone={a.area === "work" ? "blue" : "plain"}>
                    {a.kind}
                  </Chip>
                  <span
                    className={`text-sm font-medium ${TONE[a.tone] ?? TONE[""]}`}
                  >
                    {a.when}
                  </span>
                </span>
                <span className="mt-1 block text-ayu-text [overflow-wrap:anywhere]">
                  {a.title}
                </span>
              </div>
              {a.link && (
                <a
                  href={a.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${a.title}`}
                  className="flex size-11 shrink-0 items-center justify-center self-center rounded-full text-ayu-subtle hover:bg-white/[0.06] hover:text-ayu-text"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              )}
              <button
                type="button"
                onClick={() => (own ? onAsk(a.ask) : onDraft(a.ask))}
                aria-label={`${own ? "Ask Jim" : "Draft for Jim"}: ${a.title}`}
                className="min-h-11 shrink-0 self-center rounded-full px-3 text-sm font-medium text-ayu-accent hover:bg-white/[0.06]"
              >
                {own ? "Ask Jim" : "Draft for Jim"}
              </button>
            </li>
          );
        })}
      </Rows>
      {actions.length > SHOWN && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="min-h-11 text-sm font-medium text-ayu-accent"
        >
          {all ? "Show fewer" : `Show all ${actions.length}`}
        </button>
      )}
      {stamp && stamp !== today && (
        <p className="text-sm text-ayu-subtle">
          Email and Asana as of {fmtShort(stamp)}.
        </p>
      )}
    </Section>
  );
}
