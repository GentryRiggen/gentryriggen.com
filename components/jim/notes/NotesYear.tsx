import { Empty, OpenLink, Rows, Section } from "@/components/jim/notes/NotesUi";
import { daysBetween, fmtShort, monthName } from "@/lib/jim/todos";
import type { ViewData, YearDate } from "@/lib/jim/view";

/**
 * People → Year: every birthday, anniversary and renewal in the next twelve
 * months, as a wheel (today at the top, clockwise) and a list by month with
 * each birthday's gift status.
 */

interface NotesYearProps {
  data: ViewData;
  onOpen: (path: string) => void;
  hrefFor?: (path: string) => string | null;
}

type Kind = YearDate["kind"];

const KINDS: { kind: Kind; label: string; fill: string; dot: string }[] = [
  {
    kind: "birthday",
    label: "Birthdays",
    fill: "fill-ayu-accent",
    dot: "bg-ayu-accent",
  },
  {
    kind: "anniversary",
    label: "Anniversaries",
    fill: "fill-ayu-purple",
    dot: "bg-ayu-purple",
  },
  {
    kind: "renewal",
    label: "Renewals",
    fill: "fill-ayu-cyan",
    dot: "bg-ayu-cyan",
  },
];

const KIND = Object.fromEntries(KINDS.map((k) => [k.kind, k])) as Record<
  Kind,
  (typeof KINDS)[number]
>;

const RING: Record<Kind, number> = {
  birthday: 84,
  anniversary: 72,
  renewal: 60,
};

const FULL_MONTH = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** What a row says under its name. */
export function yearDetail(d: YearDate): string {
  const bits: string[] = [];
  if (d.kind === "birthday") {
    bits.push(
      d.turns != null ? `turns ${d.unsure ? "~" : ""}${d.turns}` : "birthday"
    );
  } else if (d.kind === "anniversary") {
    bits.push(d.turns != null ? plural(d.turns, "year") : "anniversary");
  } else {
    bits.push("renewal");
  }
  if (d.approx) {
    bits.push(`sometime in ${FULL_MONTH[Number(d.on.slice(5, 7)) - 1]}`);
  }
  if (d.unsure) bits.push("unconfirmed");
  return bits.join(" · ");
}

function when(d: YearDate): string {
  if (d.approx) return "";
  if (d.days === 0) return "today";
  if (d.days === 1) return "tomorrow";
  return `in ${d.days}d`;
}

function Wheel({ dates, today }: { dates: YearDate[]; today: string }) {
  const S = 200;
  const c = S / 2;
  const at = (days: number, r: number) => {
    const a = (Math.min(365, Math.max(0, days)) / 365) * 2 * Math.PI;
    return [c + r * Math.sin(a), c - r * Math.cos(a)] as const;
  };
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7)) + i + 1;
    const first = `${y + Math.floor((m - 1) / 12)}-${String(((m - 1) % 12) + 1).padStart(2, "0")}-01`;
    return { first, days: daysBetween(today, first) };
  }).filter((t) => t.days > 0 && t.days < 365);
  const counts = KINDS.map((k) => ({
    ...k,
    n: dates.filter((d) => d.kind === k.kind).length,
  })).filter((k) => k.n > 0);
  const label = `${plural(dates.length, "date")} in the next 12 months: ${counts
    .map((k) => `${k.n} ${k.label.toLowerCase()}`)
    .join(", ")}`;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`-14 -14 ${S + 28} ${S + 28}`}
      className="mx-auto block w-full max-w-64"
    >
      <circle cx={c} cy={c} r={92} className="fill-none stroke-white/[0.08]" />
      <circle cx={c} cy={c} r={50} className="fill-none stroke-white/[0.05]" />
      {ticks.map((t) => {
        const [x1, y1] = at(t.days, 50);
        const [x2, y2] = at(t.days, 92);
        const [lx, ly] = at(t.days + 15, 104);
        return (
          <g key={t.first}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className="stroke-white/[0.06]"
            />
            <text
              x={lx}
              y={ly + 3}
              textAnchor="middle"
              className="fill-ayu-subtle text-[9px]"
            >
              {monthName(Number(t.first.slice(5, 7))).slice(0, 1)}
            </text>
          </g>
        );
      })}
      {(() => {
        const [x, y] = at(0, 92);
        return (
          <line
            x1={c}
            y1={c - 44}
            x2={x}
            y2={y}
            className="stroke-ayu-accent/60"
          />
        );
      })()}
      {dates.map((d) => {
        const [x, y] = at(d.days, RING[d.kind]);
        return (
          <circle
            key={`${d.kind}-${d.path}-${d.on}`}
            cx={x}
            cy={y}
            r={3.5}
            className={`${KIND[d.kind].fill} ${d.unsure || d.approx ? "opacity-60" : ""}`}
          />
        );
      })}
      <text
        x={c}
        y={c - 2}
        textAnchor="middle"
        className="fill-ayu-text text-[13px] font-semibold"
      >
        {fmtShort(today)}
      </text>
      <text
        x={c}
        y={c + 13}
        textAnchor="middle"
        className="fill-ayu-subtle text-[9px]"
      >
        today
      </text>
    </svg>
  );
}

export default function NotesYear({ data, onOpen, hrefFor }: NotesYearProps) {
  const dates = data.yearDates;
  if (!dates) {
    return <Empty>The year ahead shows here once Jim sends it.</Empty>;
  }
  if (!dates.length) return <Empty>No dates in the next 12 months.</Empty>;
  const months = new Map<string, YearDate[]>();
  for (const d of dates) {
    const ym = d.on.slice(0, 7);
    months.set(ym, [...(months.get(ym) ?? []), d]);
  }

  return (
    <div className="space-y-8">
      <div className="jim-card space-y-3 px-4 py-4">
        <Wheel dates={dates} today={data.today} />
        <ul
          aria-label="Legend"
          className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-ayu-subtle"
        >
          {KINDS.map((k) => (
            <li key={k.kind} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`size-2.5 rounded-full ${k.dot}`}
              />
              {k.label}
            </li>
          ))}
        </ul>
      </div>

      {[...months].map(([ym, list]) => (
        <Section
          key={ym}
          title={`${FULL_MONTH[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`}
        >
          <Rows>
            {list.map((d) => {
              const giftDone =
                /chosen\.?$/i.test(d.gift) && !/none/i.test(d.gift);
              return (
                <li key={`${d.kind}-${d.path}-${d.on}`}>
                  <OpenLink
                    href={hrefFor?.(d.path)}
                    onOpen={() => onOpen(d.path)}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.04]"
                  >
                    <span
                      aria-hidden="true"
                      className={`size-2.5 shrink-0 rounded-full ${KIND[d.kind].dot}`}
                    />
                    <span className="w-14 shrink-0 text-sm text-ayu-subtle tabular-nums">
                      {d.approx
                        ? monthName(Number(d.on.slice(5, 7)))
                        : fmtShort(d.on)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ayu-text">
                        {d.name}
                      </span>
                      <span className="block text-sm text-ayu-subtle [overflow-wrap:anywhere]">
                        {yearDetail(d)}
                      </span>
                      {d.gift && (
                        <span
                          className={`block text-sm ${giftDone ? "text-ayu-green" : "text-ayu-orange"}`}
                        >
                          {d.gift}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm text-ayu-subtle tabular-nums">
                      {when(d)}
                    </span>
                  </OpenLink>
                </li>
              );
            })}
          </Rows>
        </Section>
      ))}
    </div>
  );
}
