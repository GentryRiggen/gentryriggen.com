"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import {
  CashChart,
  ChartEnds,
  GroupBars,
  NetChart,
  PlanBar,
  monthName,
  usd,
} from "@/components/jim/notes/MoneyCharts";
import {
  Chip,
  Empty,
  Rows,
  Section,
  Stat,
} from "@/components/jim/notes/NotesUi";
import type { JimErrorKind } from "@/lib/jim/api";
import JimMarkdown from "@/lib/jim/markdown";
import type {
  MoneyCheckin,
  MoneyDriver,
  MoneyMonth,
  MoneyState,
  MoneySummary,
} from "@/lib/jim/money";
import { fmtDay, fmtShort, monthName as shortMonth } from "@/lib/jim/todos";

interface NotesMoneyProps {
  /** From `useMoney`: held in memory only, never from a cache. */
  money: MoneyState;
}

const ERRORS: Record<JimErrorKind, string> = {
  waking: "Jim is waking up. Try again in a moment.",
  uncertain: "Jim is waking up. Try again in a moment.",
  denied: "Jim didn't accept your sign-in. Sign out and back in.",
  server: "Couldn't load money.",
  rejected: "Couldn't load money.",
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const YM = /^\d{4}-\d{2}$/;

/** "2026-09" → "Sep 2026". */
function monthYear(ym: string): string {
  return YM.test(ym)
    ? `${shortMonth(Number(ym.slice(5, 7)))} ${ym.slice(0, 4)}`
    : ym;
}

/** The last full month, or the newest when none is full. */
function defaultMonth(months: MoneyMonth[]): string {
  const full = months.filter((m) => !m.partial);
  return (full[full.length - 1] ?? months[months.length - 1])?.m ?? "";
}

function netTone(n: number): string {
  return n > 0 ? "text-ayu-green" : n < 0 ? "text-ayu-red" : "text-ayu-text";
}

function Skeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <p className="sr-only" role="status">
        Loading money…
      </p>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.04]"
          />
        ))}
      </div>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.04]"
        />
      ))}
    </div>
  );
}

function TryAgain({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 shrink-0 rounded-full jim-glow px-5 font-medium text-ayu-bg hover:brightness-110"
    >
      Try again
    </button>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h4 className="text-sm font-medium text-ayu-subtle">{children}</h4>;
}

function Drivers({ rows, over }: { rows: MoneyDriver[]; over: boolean }) {
  return (
    <ul className="space-y-1.5">
      {rows.map((d) => (
        <li key={d.cat} className="flex items-baseline gap-3 text-sm">
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <span className="text-ayu-text">{d.cat}</span>{" "}
            <span className="text-ayu-subtle">
              {usd(d.amount)} vs {usd(d.typical)}
            </span>
          </span>
          <span
            className={`shrink-0 tabular-nums ${over ? "text-ayu-red" : "text-ayu-green"}`}
          >
            {usd(d.diff, { sign: true })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Figure({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-ayu-subtle">{label}</p>
      <p
        className={`text-lg font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] ${tone || "text-ayu-text"}`}
      >
        {value}
      </p>
    </div>
  );
}

function MonthDetail({
  month,
  groups,
}: {
  month: MoneyMonth;
  groups: string[];
}) {
  const names = [
    ...groups,
    ...Object.keys(month.byGroup).filter((g) => !groups.includes(g)),
  ];
  const spent = names
    .map((g): [string, number] => [g, month.byGroup[g] ?? 0])
    .filter(([, n]) => n > 0);
  return (
    <section
      aria-label={`${month.label} detail`}
      className="jim-card space-y-4 px-4 py-3.5"
    >
      <header className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-ayu-text">{month.label}</h3>
        {month.partial && <Chip tone="blue">So far</Chip>}
      </header>
      <div className="grid grid-cols-3 gap-3">
        <Figure label="Came in" value={usd(month.cameIn)} />
        <Figure label="Spent" value={usd(month.spent)} />
        <Figure
          label="Net"
          value={usd(month.net, { sign: true })}
          tone={netTone(month.net)}
        />
      </div>
      {month.flag && (
        <p className="text-sm text-ayu-orange [overflow-wrap:anywhere]">
          {month.flag}
        </p>
      )}
      {spent.length > 0 && (
        <div className="space-y-2 border-t border-white/[0.06] pt-3">
          <SubHeading>Spent by group</SubHeading>
          <GroupBars rows={spent} />
        </div>
      )}
      {month.over.length > 0 && (
        <div className="space-y-2 border-t border-white/[0.06] pt-3">
          <SubHeading>Over typical</SubHeading>
          <Drivers rows={month.over} over />
        </div>
      )}
      {month.under.length > 0 && (
        <div className="space-y-2 border-t border-white/[0.06] pt-3">
          <SubHeading>Under typical</SubHeading>
          <Drivers rows={month.under} over={false} />
        </div>
      )}
      {month.top.length > 0 && (
        <div className="space-y-2 border-t border-white/[0.06] pt-3">
          <SubHeading>Largest</SubHeading>
          <ul className="divide-y divide-white/[0.05]">
            {month.top.map((t, i) => (
              <li
                key={`${t.date}-${t.payee}-${i}`}
                className="flex items-baseline gap-3 py-2 text-sm first:pt-0 last:pb-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-ayu-text [overflow-wrap:anywhere]">
                    {t.payee}
                  </span>
                  <span className="block text-ayu-subtle [overflow-wrap:anywhere]">
                    {t.category}
                    {ISO.test(t.date) ? ` · ${fmtShort(t.date)}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-ayu-text tabular-nums">
                  {usd(t.amount, { cents: true })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {month.note && (
        <div className="space-y-2 border-t border-white/[0.06] pt-3 text-sm [overflow-wrap:anywhere]">
          <SubHeading>Notes</SubHeading>
          <JimMarkdown text={month.note} links="plain" />
        </div>
      )}
    </section>
  );
}

function CheckinSection({ checkin }: { checkin: MoneyCheckin }) {
  const log = checkin.log.slice(0, 5);
  return (
    <Section title="Check-in">
      <div className="jim-card space-y-3 px-4 py-3.5">
        <h3 className="font-semibold text-ayu-text">
          {`Plan for ${monthYear(checkin.month)}`}
        </h3>
        {checkin.plan.length > 0 ? (
          <ul className="space-y-3">
            {checkin.plan.map((row) => (
              <li key={row.cat} className="space-y-1">
                <PlanBar row={row} />
                {row.why && (
                  <p className="text-sm text-ayu-subtle [overflow-wrap:anywhere]">
                    {row.why}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ayu-subtle">No targets set.</p>
        )}
      </div>
      {checkin.coming.length > 0 && (
        <div className="space-y-2">
          <SubHeading>Coming up</SubHeading>
          <Rows>
            {checkin.coming.map((c, i) => (
              <li
                key={`${c.when}-${c.what}-${i}`}
                className="flex items-baseline gap-3 px-4 py-2.5 text-sm"
              >
                <span className="w-20 shrink-0 text-ayu-subtle tabular-nums">
                  {c.label}
                </span>
                <span className="min-w-0 flex-1 text-ayu-text [overflow-wrap:anywhere]">
                  {c.what}
                </span>
                {c.amount !== null && (
                  <span className="shrink-0 text-ayu-text tabular-nums">
                    {usd(c.amount)}
                  </span>
                )}
              </li>
            ))}
          </Rows>
        </div>
      )}
      {log.length > 0 && (
        <div className="space-y-2">
          <SubHeading>Latest entries</SubHeading>
          <Rows>
            {log.map((e, i) => (
              <li
                key={`${e.date}-${i}`}
                className="space-y-1 px-4 py-2.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-ayu-subtle tabular-nums">
                    {ISO.test(e.date) ? fmtShort(e.date) : e.date}
                  </span>
                  {e.kind && <Chip>{e.kind}</Chip>}
                </div>
                <p className="text-ayu-text [overflow-wrap:anywhere]">
                  {e.text}
                </p>
              </li>
            ))}
          </Rows>
        </div>
      )}
      {checkin.next && (
        <p className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-ayu-subtle">Next check-in</span>
          <span className="text-ayu-text">
            {ISO.test(checkin.next) ? fmtDay(checkin.next) : checkin.next}
          </span>
        </p>
      )}
    </Section>
  );
}

function MoneyBody({ data }: { data: MoneySummary }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const months = data.months;
  const selected =
    chosen && months.some((m) => m.m === chosen)
      ? chosen
      : defaultMonth(months);
  const month = months.find((m) => m.m === selected);
  const flagged = months.filter((m) => m.flag);
  const lastCash = data.cash[data.cash.length - 1];

  // The picked chip starts in view (the row scrolls inside its card only).
  useLayoutEffect(() => {
    const row = chipsRef.current;
    const chip = row?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (row && chip) {
      row.scrollLeft =
        chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
    }
    // Only when new data lands; a tap leaves the row where it is.
  }, [data]);

  return (
    <div className="space-y-8">
      {data.tiles.length > 0 && (
        <Section title="Overview">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.tiles.map((t) => (
              <Stat
                key={t.label}
                label={t.label}
                value={t.value}
                tone={t.tone === "good" || t.tone === "bad" ? t.tone : ""}
              />
            ))}
          </div>
          {data.rule && (
            <p className="text-sm text-ayu-subtle [overflow-wrap:anywhere]">
              {data.rule}
            </p>
          )}
        </Section>
      )}

      {months.length === 0 ? (
        <Empty>No months yet.</Empty>
      ) : (
        <>
          <Section title="Net per month">
            <div className="jim-card space-y-3 px-4 py-3.5">
              <ul
                aria-label="Legend"
                className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
              >
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-sm bg-ayu-green"
                  />
                  Surplus
                </li>
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-sm bg-ayu-red"
                  />
                  Deficit
                </li>
              </ul>
              <NetChart months={months} selected={selected} />
              <ChartEnds
                first={months[0].label}
                last={months[months.length - 1].label}
                count={months.length}
              />
              {flagged.length > 0 && (
                <ul className="space-y-1 border-t border-white/[0.06] pt-3 text-sm">
                  {flagged.map((m) => (
                    <li key={m.m} className="flex gap-3">
                      <span className="w-14 shrink-0 text-ayu-subtle">
                        {m.label}
                      </span>
                      <span className="min-w-0 flex-1 text-ayu-orange [overflow-wrap:anywhere]">
                        {m.flag}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          <Section title="Month">
            <div className="jim-card p-1">
              <div
                ref={chipsRef}
                role="group"
                aria-label="Months"
                className="flex gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {months.map((m) => {
                  const on = m.m === selected;
                  return (
                    <button
                      key={m.m}
                      type="button"
                      aria-pressed={on}
                      title={monthName(m)}
                      onClick={() => setChosen(m.m)}
                      className={`min-h-11 shrink-0 rounded-xl px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
                        on
                          ? "bg-ayu-accent/12 text-ayu-accent ring-1 ring-ayu-accent/30 ring-inset"
                          : "text-ayu-subtle hover:bg-white/[0.06] hover:text-ayu-text"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {month && <MonthDetail month={month} groups={data.groups} />}
          </Section>
        </>
      )}

      {data.checkin && <CheckinSection checkin={data.checkin} />}

      {lastCash && (
        <Section title="Cash on hand">
          <div className="jim-card space-y-3 px-4 py-3.5">
            <div>
              <p className="jim-figure text-3xl font-semibold tracking-tight tabular-nums">
                {usd(lastCash.amount)}
              </p>
              <p className="text-sm text-ayu-subtle">
                {ISO.test(lastCash.date)
                  ? `Statement of ${fmtShort(lastCash.date)}`
                  : lastCash.date}
              </p>
            </div>
            <CashChart cash={data.cash} />
            <ChartEnds
              first={
                ISO.test(data.cash[0].date) ? fmtShort(data.cash[0].date) : ""
              }
              last={ISO.test(lastCash.date) ? fmtShort(lastCash.date) : ""}
              count={data.cash.length}
            />
          </div>
        </Section>
      )}

      {data.watch && (
        <Section title="Watch">
          <div className="jim-card px-4 py-3.5 [overflow-wrap:anywhere]">
            <JimMarkdown text={data.watch} links="plain" />
          </div>
        </Section>
      )}
    </div>
  );
}

/**
 * Money: the summary's tiles, net per month, a month's detail, the
 * check-in, cash on hand and the Watch list. Every label comes from the
 * summary; nothing here is kept anywhere but this page's memory.
 */
export default function NotesMoney({ money }: NotesMoneyProps) {
  const { status, data, error, reload } = money;
  const loading = status === "loading";

  if (!data) {
    if (status === "error" && error) {
      return (
        <div className="space-y-3 py-8 text-center">
          <p role="alert" className="text-ayu-text">
            {ERRORS[error]}
          </p>
          <TryAgain onClick={() => void reload()} />
        </div>
      );
    }
    if (status === "ready") {
      return (
        <Empty>No money summary yet. It shows here once Jim sends one.</Empty>
      );
    }
    return <Skeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 text-sm text-ayu-subtle">
        <p className="flex min-w-0 items-center gap-2" aria-live="polite">
          <span
            aria-hidden="true"
            className={`size-1.5 shrink-0 rounded-full ${
              error || data.stale
                ? "bg-ayu-orange"
                : "bg-ayu-green shadow-[0_0_8px_rgb(213_255_128/0.6)]"
            }`}
          />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {data.stale
              ? "Jim couldn't sync, so these may be behind."
              : data.range}
          </span>
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          className="-mr-2 flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 font-medium text-ayu-accent hover:bg-white/[0.06] disabled:text-ayu-subtle"
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}
          />
          Refresh
        </button>
      </div>
      {status === "error" && error && (
        <div
          role="alert"
          className="jim-card flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
        >
          <span className="min-w-0 text-ayu-text">
            {error === "denied"
              ? ERRORS.denied
              : "Couldn't refresh money. Showing what loaded."}
          </span>
          <button
            type="button"
            onClick={() => void reload()}
            className="min-h-11 shrink-0 rounded-full px-3 font-medium text-ayu-accent hover:bg-white/[0.06]"
          >
            Try again
          </button>
        </div>
      )}
      <MoneyBody data={data} />
    </div>
  );
}
