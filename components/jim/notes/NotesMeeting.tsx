"use client";

import type { ReactNode } from "react";
import { BackLink, Empty, OpenLink } from "@/components/jim/notes/NotesUi";
import { timeLabel } from "@/lib/jim/notesData";
import { routeForNote, formatJimPath } from "@/lib/jim/routes";
import type { MeetingAttendee, MeetingCard } from "@/lib/jim/view";

interface NotesMeetingProps {
  /** The card for this meeting, or undefined when it isn't in the payload. */
  card: MeetingCard | undefined;
  onBack: () => void;
  backLabel?: string;
  backHref?: string;
  backAside?: ReactNode;
  /** Opens a person's note by repo path. */
  onOpenPath: (path: string) => void;
  onHome: () => void;
  homeHref?: string;
}

function range(card: MeetingCard): string {
  const start = timeLabel(card.start);
  const end = card.end ? timeLabel(card.end) : "";
  return end ? `${start} to ${end}` : start;
}

function Attendee({
  who,
  onOpenPath,
}: {
  who: MeetingAttendee;
  onOpenPath: (path: string) => void;
}) {
  const route = who.path ? routeForNote(who.path) : null;
  const name = (
    <span className="font-medium text-ayu-text [overflow-wrap:anywhere]">
      {who.name}
    </span>
  );
  return (
    <li className="jim-card space-y-1 px-4 py-3">
      {route ? (
        <OpenLink
          href={formatJimPath(route)}
          onOpen={() => onOpenPath(who.path)}
          className="flex min-h-11 items-center text-ayu-accent"
        >
          {name}
        </OpenLink>
      ) : (
        name
      )}
      {who.role && <p className="text-sm text-ayu-subtle">{who.role}</p>}
      {who.last && (
        <p className="text-sm text-ayu-subtle">Last came up: {who.last}</p>
      )}
      {who.todos.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-ayu-text">
          {who.todos.map((t, i) => (
            <li key={`${i}-${t}`} className="[overflow-wrap:anywhere]">
              {t}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** A meeting card: when and where, then who is in it and what is open. */
export default function NotesMeeting({
  card,
  onBack,
  backLabel = "Home",
  backHref,
  backAside,
  onOpenPath,
  onHome,
  homeHref,
}: NotesMeetingProps) {
  const back = (
    <BackLink
      label={backLabel}
      onBack={onBack}
      href={backHref}
      aside={backAside}
    />
  );
  if (!card) {
    return (
      <article className="space-y-5">
        {back}
        <Empty>This meeting isn&apos;t in the calendar anymore.</Empty>
        <OpenLink
          href={homeHref}
          onOpen={onHome}
          className="flex min-h-11 w-fit items-center text-ayu-accent"
        >
          Go to Home
        </OpenLink>
      </article>
    );
  }
  return (
    <article className="space-y-5">
      {back}
      <header className="space-y-1">
        <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-ayu-text [overflow-wrap:anywhere]">
          {card.subject}
        </h2>
        <p className="text-ayu-subtle">{range(card)}</p>
        {card.where && (
          <p className="text-ayu-subtle [overflow-wrap:anywhere]">
            {card.where}
          </p>
        )}
      </header>
      {card.attendees.length > 0 && (
        <ul className="space-y-3">
          {card.attendees.map((a, i) => (
            <Attendee key={`${i}-${a.name}`} who={a} onOpenPath={onOpenPath} />
          ))}
        </ul>
      )}
    </article>
  );
}
