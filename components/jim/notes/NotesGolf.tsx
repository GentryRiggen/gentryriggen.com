"use client";

import { useState } from "react";
import {
  Chip,
  Empty,
  Rows,
  Section,
  Stat,
} from "@/components/jim/notes/NotesUi";
import { golfSummary, perNine } from "@/lib/jim/notesData";
import { fmtShort } from "@/lib/jim/todos";
import type { ViewData } from "@/lib/jim/view";

interface NotesGolfProps {
  data: ViewData;
}

/** Rounds shown before "Show all". */
const FIRST_ROUNDS = 15;

function oneDecimal(v: number): string {
  return String(Math.round(v * 10) / 10);
}

/** Golf: the average per nine, the best nine, and every round. */
export default function NotesGolf({ data }: NotesGolfProps) {
  const [all, setAll] = useState(false);
  const s = golfSummary(data.golf);
  const shown = all ? s.rounds : s.rounds.slice(0, FIRST_ROUNDS);
  const bestNine = s.best ? perNine(s.best, s.best.score) : null;

  return (
    <div className="space-y-8">
      {s.counted > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Average per nine"
            value={s.avgPerNine != null ? oneDecimal(s.avgPerNine) : "–"}
            detail={`over ${s.counted} counted round${s.counted === 1 ? "" : "s"}`}
          />
          {s.best && bestNine != null && (
            <Stat
              label="Best nine"
              value={oneDecimal(bestNine)}
              detail={`${s.best.course} · ${fmtShort(s.best.date)}`}
            />
          )}
        </div>
      )}
      <Section
        title="Rounds"
        aside={s.rounds.length ? `${s.rounds.length} logged` : undefined}
      >
        {s.rounds.length === 0 ? (
          <Empty>No rounds logged yet.</Empty>
        ) : (
          <>
            <Rows>
              {shown.map((r, i) => (
                <li
                  key={`${r.date}-${r.course}-${i}`}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-ayu-text [overflow-wrap:anywhere]">
                      {r.course || "Unknown course"}
                    </span>
                    <span className="block text-sm text-ayu-subtle">
                      {fmtShort(r.date)} {r.date.slice(0, 4)} · {r.holes} holes
                      {r.tee ? ` · ${r.tee}` : ""}
                    </span>
                    {(!r.counts || r.note) && (
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ayu-subtle">
                        {!r.counts && (
                          <Chip>{`${r.format || "Other"}, not counted`}</Chip>
                        )}
                        {r.note && (
                          <span className="[overflow-wrap:anywhere]">
                            {r.note}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="jim-figure block text-xl font-semibold tracking-tight tabular-nums">
                      {r.score ?? "–"}
                    </span>
                    {r.toPar != null && (
                      <span className="block text-sm text-ayu-subtle tabular-nums">
                        {r.toPar > 0 ? "+" : ""}
                        {r.toPar}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </Rows>
            {s.rounds.length > FIRST_ROUNDS && (
              <button
                type="button"
                onClick={() => setAll((v) => !v)}
                className="min-h-11 rounded-md px-1 text-sm font-medium text-ayu-accent underline underline-offset-2"
              >
                {all ? "Show fewer" : `Show all ${s.rounds.length}`}
              </button>
            )}
          </>
        )}
      </Section>
      {s.rounds.some((r) => r.holes === 18) && (
        <p className="text-sm text-ayu-subtle">
          An 18-hole round counts as two nines.
        </p>
      )}
    </div>
  );
}
