"use client";

import { useEffect, useState } from "react";
import { OpenLink, Rows, Section } from "@/components/jim/notes/NotesUi";
import { listReminders, type Reminder } from "@/lib/jim/reminders";

const SHOWN = 3;

interface RemindersCardProps {
  api: string;
  getToken: (force?: boolean) => Promise<string | null>;
  onOpen: (id: string | null) => void;
  hrefFor?: (id: string | null) => string;
}

/** Home: the next few reminders. Hidden when there are none or on any error. */
export default function RemindersCard({
  api,
  getToken,
  onOpen,
  hrefFor,
}: RemindersCardProps) {
  const [items, setItems] = useState<Reminder[]>([]);

  useEffect(() => {
    let live = true;
    listReminders(getToken, undefined, api)
      .then((rows) => {
        if (live) setItems(rows.filter((r) => r.sent === null));
      })
      .catch(() => {
        if (live) setItems([]);
      });
    return () => {
      live = false;
    };
  }, [api, getToken]);

  if (items.length === 0) return null;
  return (
    <Section title="Reminders">
      <Rows>
        {items.slice(0, SHOWN).map((r) => (
          <li key={r.id}>
            <OpenLink
              href={hrefFor?.(r.id)}
              onOpen={() => onOpen(r.id)}
              className="flex min-h-11 w-full flex-col justify-center px-4 py-2 text-left hover:bg-white/[0.04]"
            >
              <span className="text-ayu-text [overflow-wrap:anywhere]">
                {r.text}
              </span>
              <span className="text-sm text-ayu-subtle">{r.when}</span>
            </OpenLink>
          </li>
        ))}
      </Rows>
      <OpenLink
        href={hrefFor?.(null)}
        onOpen={() => onOpen(null)}
        className="flex min-h-11 items-center text-sm font-medium text-ayu-accent"
      >
        All reminders
      </OpenLink>
    </Section>
  );
}
