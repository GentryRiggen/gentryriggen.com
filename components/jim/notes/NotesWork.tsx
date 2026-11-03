"use client";

import { useState } from "react";
import { Empty, Section, Segmented } from "@/components/jim/notes/NotesUi";
import OrgTree from "@/components/jim/notes/OrgTree";
import WinsChart from "@/components/jim/notes/WinsChart";
import { DirectorySearch } from "@/components/jim/notes/WorkDirectory";
import WorkMeetings from "@/components/jim/notes/WorkMeetings";
import { daysBetween, fmtDay, fmtShort, stripMd } from "@/lib/jim/todos";
import type { TeamMember, ViewData } from "@/lib/jim/view";

interface NotesWorkProps {
  data: ViewData;
  /** A meeting row was tapped: open its note. */
  onOpenMeeting: (path: string) => void;
  /** A directory result was tapped: open their card. */
  onOpenPerson: (id: number) => void;
  /** Addresses, so meetings and directory rows are real links. */
  meetingHref?: (path: string) => string | null;
  personHref?: (id: number) => string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function inDays(on: string, today: string): string {
  const n = daysBetween(today, on);
  if (n < 0) return `${-n} ${-n === 1 ? "day" : "days"} ago`;
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  return `in ${n} days`;
}

function wins(n: number): string {
  return `${n} ${n === 1 ? "win" : "wins"}`;
}

function TeamCard({ member, today }: { member: TeamMember; today: string }) {
  const titleId = `jim-team-${member.path.replace(/[^a-z0-9]/gi, "-")}`;
  const next = ISO.test(member.nextOneOnOne) ? member.nextOneOnOne : "";
  return (
    <article
      aria-labelledby={titleId}
      className="jim-card relative space-y-3 overflow-hidden px-4 py-3.5"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -right-10 size-24 rounded-full bg-ayu-accent/10 blur-2xl"
      />
      <header className="min-w-0">
        <h3
          id={titleId}
          className="text-lg font-semibold text-ayu-text [overflow-wrap:anywhere]"
        >
          {member.name}
        </h3>
        {member.about && (
          <p className="text-sm text-ayu-subtle [overflow-wrap:anywhere]">
            {stripMd(member.about)}
          </p>
        )}
      </header>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ayu-subtle">Next 1:1</p>
          {next ? (
            <>
              <p className="jim-figure text-xl font-semibold tracking-tight">
                {fmtDay(next)}
              </p>
              <p className="text-sm text-ayu-subtle">{inDays(next, today)}</p>
            </>
          ) : (
            <p className="text-ayu-text">None booked</p>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-ayu-subtle">Wins logged</p>
          <p className="jim-figure text-xl font-semibold tracking-tight tabular-nums">
            {wins(member.wins)}
          </p>
        </div>
      </div>
      {member.recentWins.length > 0 && (
        <ul className="space-y-1.5 border-t border-white/[0.06] pt-3">
          {member.recentWins.slice(0, 3).map((w) => (
            <li key={`${w.date}-${w.text}`} className="flex gap-3 text-sm">
              <span className="w-12 shrink-0 text-ayu-subtle tabular-nums">
                {ISO.test(w.date) ? fmtShort(w.date) : ""}
              </span>
              <span className="min-w-0 flex-1 text-ayu-text [overflow-wrap:anywhere]">
                {stripMd(w.text)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

type DirectoryView = "list" | "org";

const DIRECTORY_VIEWS: readonly { id: DirectoryView; label: string }[] = [
  { id: "list", label: "List" },
  { id: "org", label: "Org chart" },
];

/** Work: the team, wins per week, meetings and the directory. */
export default function NotesWork({
  data,
  onOpenMeeting,
  onOpenPerson,
  meetingHref,
  personHref,
}: NotesWorkProps) {
  const [dirView, setDirView] = useState<DirectoryView>("list");
  const [dirQuery, setDirQuery] = useState("");
  const work = data.work;
  if (!work) {
    return (
      <Empty>No work notes yet. They show here once Jim sends them.</Empty>
    );
  }

  const hasWins = work.winsByWeek.length > 0 && work.winsKeys.length > 0;

  return (
    <div className="space-y-8">
      <Section title="Team">
        {work.team.length ? (
          <div className="space-y-3">
            {work.team.map((m) => (
              <TeamCard key={m.path || m.name} member={m} today={data.today} />
            ))}
          </div>
        ) : (
          <Empty>No team yet.</Empty>
        )}
      </Section>

      <Section title="Wins per week" aside="12 weeks">
        {hasWins ? (
          <WinsChart weeks={work.winsByWeek} keys={work.winsKeys} />
        ) : (
          <Empty>No wins logged yet.</Empty>
        )}
      </Section>

      <Section title="Meetings" aside={work.meetings.length || undefined}>
        <WorkMeetings
          meetings={work.meetings}
          onOpenMeeting={onOpenMeeting}
          meetingHref={meetingHref}
        />
      </Section>

      <Section
        title="Directory"
        aside={
          ISO.test(work.directory.updated)
            ? `As of ${fmtShort(work.directory.updated)}`
            : undefined
        }
      >
        {work.directory.people.length ? (
          <div className="space-y-3">
            <Segmented
              label="Directory views"
              options={DIRECTORY_VIEWS}
              value={dirView}
              onChange={setDirView}
            />
            {dirView === "list" ? (
              <DirectorySearch
                directory={work.directory}
                query={dirQuery}
                onQuery={setDirQuery}
                onOpen={onOpenPerson}
                hrefFor={personHref}
              />
            ) : (
              <OrgTree
                directory={work.directory}
                onOpen={onOpenPerson}
                hrefFor={personHref}
              />
            )}
          </div>
        ) : (
          <Empty>No directory yet.</Empty>
        )}
      </Section>
    </div>
  );
}
