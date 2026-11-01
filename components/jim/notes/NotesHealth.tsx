"use client";

import { useState } from "react";
import Sparkline from "@/components/jim/notes/Sparkline";
import {
  Chip,
  Empty,
  Rows,
  Section,
  Stat,
} from "@/components/jim/notes/NotesUi";
import { labCards, type LabCard } from "@/lib/jim/notesData";
import { daysBetween, fmtShort } from "@/lib/jim/todos";
import type { ViewData } from "@/lib/jim/view";

interface NotesHealthProps {
  data: ViewData;
}

/** Injections shown before "Show all". */
const FIRST_INJECTIONS = 10;

function ago(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "yesterday";
  return n > 0 ? `${n} days ago` : `in ${-n} days`;
}

/** "in about 20 days"; it's an estimate, so "about" leads. */
function nextDrawWhen(n: number): string {
  if (n === 0) return "about today";
  if (n === 1) return "about tomorrow";
  return n > 0 ? `in about ${n} days` : `about ${-n} days ago`;
}

function LabTile({ card }: { card: LabCard }) {
  const flag = card.latest.flag;
  const value = card.latest.raw.replace(/\s+[HL]\b.*$/, "");
  const trend = card.points
    .map((p) => `${p.v} on ${fmtShort(p.date)}`)
    .join(", ");
  return (
    <article className="jim-card min-w-0 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 font-medium text-ayu-text [overflow-wrap:anywhere]">
          {card.marker}
        </h3>
        <span className="flex shrink-0 items-center gap-2">
          <span className="font-semibold text-ayu-text tabular-nums">
            {value}
          </span>
          {flag && <Chip tone="red">{flag === "H" ? "High" : "Low"}</Chip>}
        </span>
      </div>
      <div className="mt-2">
        <Sparkline
          points={card.points}
          lo={card.lo}
          hi={card.hi}
          label={`${card.marker} trend: ${trend}`}
        />
      </div>
      <p className="mt-1 text-sm text-ayu-subtle [overflow-wrap:anywhere]">
        {fmtShort(card.latest.date)} {card.latest.date.slice(0, 4)}
        {card.range ? ` · range ${card.range}` : ""}
        {card.points.length > 1 ? ` · ${card.points.length} results` : ""}
      </p>
    </article>
  );
}

/** Health: injections, the next lab draw, and labs by marker. */
export default function NotesHealth({ data }: NotesHealthProps) {
  const [allShots, setAllShots] = useState(false);
  const h = data.health;
  const shots = [...h.injections]
    .filter((i) => typeof i?.date === "string")
    .sort((a, b) => b.date.localeCompare(a.date));
  const last = shots[0];
  const cards = labCards(h);
  const shown = allShots ? shots : shots.slice(0, FIRST_INJECTIONS);
  const hold =
    h.hold && !h.draws.some((d) => d.date > (h.hold?.until ?? ""))
      ? h.hold
      : null;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 min-[360px]:[&>:last-child:nth-child(odd)]:col-span-2 @2xl:grid-cols-3 @2xl:[&>:last-child:nth-child(odd)]:col-span-1">
        {last ? (
          <Stat
            label="Last injection"
            value={fmtShort(last.date)}
            detail={`${last.mg != null ? `${last.mg} mg · ` : ""}${ago(daysBetween(last.date, data.today))}`}
          />
        ) : null}
        {h.nextDraw ? (
          <Stat
            label="Next lab draw"
            value={fmtShort(h.nextDraw)}
            detail={nextDrawWhen(daysBetween(data.today, h.nextDraw))}
          />
        ) : null}
        {h.prescribedWeekly ? (
          <Stat
            label="Prescribed"
            value={`${h.prescribedWeekly} mg`}
            detail="per week"
          />
        ) : null}
      </div>
      {hold && (
        <p className="jim-card px-4 py-3 text-sm text-ayu-subtle">
          Set aside until the next draw:{" "}
          <span className="text-ayu-text">{hold.markers.join(", ")}</span>
        </p>
      )}

      <Section
        title="Labs"
        aside={h.draws.length ? `${h.draws.length} draws` : undefined}
      >
        {cards.length === 0 ? (
          <Empty>No lab results yet.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 @4xl:grid-cols-3">
            {cards.map((c) => (
              <LabTile key={c.marker} card={c} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Injections"
        aside={shots.length ? `${shots.length} logged` : undefined}
      >
        {shots.length === 0 ? (
          <Empty>No injections logged yet.</Empty>
        ) : (
          <>
            <Rows>
              {shown.map((s, i) => (
                <li
                  key={`${s.date}-${s.time}-${i}`}
                  className="flex items-baseline justify-between gap-3 px-4 py-2.5"
                >
                  <span className="min-w-0">
                    <span data-date className="block text-ayu-text">
                      {fmtShort(s.date)}, {s.date.slice(0, 4)}
                    </span>
                    {(s.time || s.note) && (
                      <span className="block text-sm text-ayu-subtle [overflow-wrap:anywhere]">
                        {[s.time, s.note].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-ayu-text tabular-nums">
                    {s.mg != null ? `${s.mg} mg` : "?"}
                  </span>
                </li>
              ))}
            </Rows>
            {shots.length > FIRST_INJECTIONS && (
              <button
                type="button"
                onClick={() => setAllShots((v) => !v)}
                className="min-h-11 rounded-md px-1 text-sm font-medium text-ayu-accent underline underline-offset-2"
              >
                {allShots ? "Show fewer" : `Show all ${shots.length}`}
              </button>
            )}
          </>
        )}
      </Section>
      <p className="text-sm text-ayu-subtle">
        Information only, not medical advice.
      </p>
    </div>
  );
}
