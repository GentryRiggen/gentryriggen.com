"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";
import {
  ExploreFrame,
  type ExplorePageProps,
} from "@/components/jim/notes/NotesExplore";
import {
  Chip,
  Empty,
  Section,
  Segmented,
} from "@/components/jim/notes/NotesUi";
import {
  electionAt,
  type Chamber,
  type Election,
  type Party,
  type RaceAt,
  type RaceKind,
} from "@/lib/jim/election";
import { useExplore } from "@/lib/jim/explore";

/**
 * Election: relive a night one update at a time. The slider moves through the
 * moments Gentry asked for the latest; the seats, races and their trails all
 * show the night as it stood then. Opens on the newest update.
 */

const STEP_MS = 2600;
const SENATE_MAJORITY = 51;
const HOUSE_MAJORITY = 218;

const PARTY_BG: Record<Party, string> = {
  D: "bg-ayu-blue",
  R: "bg-ayu-red",
  I: "bg-ayu-purple",
};
const PARTY_FILL: Record<Party, string> = {
  D: "fill-ayu-blue",
  R: "fill-ayu-red",
  I: "fill-ayu-purple",
};

type KindFilter = "all" | RaceKind;
const KIND_FILTERS: readonly { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "senate", label: "Senate" },
  { id: "house", label: "House" },
  { id: "governor", label: "Governor" },
];

function clock(at: string): string {
  return new Date(at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Denver",
  });
}

function Legend() {
  const keys: [string, string][] = [
    ["bg-ayu-blue", "Democrat"],
    ["bg-ayu-red", "Republican"],
    ["bg-ayu-purple", "Independent"],
    ["bg-white/10", "Not called"],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ayu-subtle">
      {keys.map(([color, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`size-2.5 rounded ${color}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}

interface SeatsProps {
  name: string;
  chamber: Chamber;
  majority: number;
}

function Seats({ name, chamber, majority }: SeatsProps) {
  const { d, r, uncalled, flips, estimate } = chamber;
  const total = d + r + uncalled;
  const won = d >= majority;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-ayu-text">{name}</h3>
        <p className="text-right text-sm text-ayu-subtle">
          {flips !== null && `${flips} ${flips === 1 ? "flip" : "flips"}`}
          {estimate !== null && ` · about ${estimate} expected`}
        </p>
      </div>
      <div
        role="img"
        aria-label={`${name}: ${d} Democrats, ${r} Republicans, ${uncalled} not called. ${majority} for control.`}
        className="relative flex h-5 gap-0.5"
      >
        <div
          className="rounded-l bg-ayu-blue transition-all duration-500"
          style={{ flexGrow: d }}
        />
        <div
          className="bg-white/10 transition-all duration-500"
          style={{ flexGrow: uncalled }}
        />
        <div
          className="rounded-r bg-ayu-red transition-all duration-500"
          style={{ flexGrow: r }}
        />
        <div
          aria-hidden="true"
          className="absolute -inset-y-1 w-0.5 bg-ayu-text"
          style={{ left: `${(majority / total) * 100}%` }}
        />
      </div>
      <div className="flex justify-between gap-2 text-sm">
        <span className="text-ayu-text">{d} D</span>
        <span className="text-ayu-subtle">
          {won ? `Past ${majority}` : `${majority} for control`}
        </span>
        <span className="text-ayu-text">{r} R</span>
      </div>
    </div>
  );
}

/** How the lead moved: above the line, `a` leads; below it, `b`. */
function Trail({ item }: { item: RaceAt }) {
  const { trail, race } = item;
  if (trail.length === 0) return <div className="h-8 w-20 shrink-0" />;
  const width = 80;
  const height = 32;
  const reach = Math.max(4, ...trail.map(Math.abs));
  const x = (i: number) =>
    trail.length === 1 ? width - 5 : 4 + (i / (trail.length - 1)) * (width - 9);
  const y = (lead: number) => height / 2 - (lead / reach) * (height / 2 - 4);
  const points = trail.map((lead, i) => `${x(i)},${y(lead)}`).join(" ");
  const end = trail[trail.length - 1];
  const leader = end >= 0 ? race.aParty : race.bParty;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-8 w-20 shrink-0"
      aria-hidden="true"
    >
      <line
        x1="0"
        x2={width}
        y1={height / 2}
        y2={height / 2}
        className="stroke-white/15"
      />
      <polyline
        points={points}
        fill="none"
        strokeWidth="2"
        strokeLinejoin="round"
        className="stroke-ayu-subtle"
      />
      <circle
        cx={x(trail.length - 1)}
        cy={y(end)}
        r="4"
        className={PARTY_FILL[leader]}
      />
    </svg>
  );
}

function RaceRow({ item }: { item: RaceAt }) {
  const { race, now, flip } = item;
  const started = now.counted > 0;
  const rest = Math.max(0, 100 - now.a - now.b);
  const winner = now.called === "a" ? race.a : race.b;
  return (
    <li className="space-y-1.5 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ayu-text">{race.name}</p>
          <p className="text-sm text-ayu-subtle">
            {started
              ? `${race.a} ${now.a} · ${race.b} ${now.b}`
              : `${race.a} vs. ${race.b}`}
          </p>
        </div>
        <Trail item={item} />
      </div>
      {started ? (
        <div className="flex h-2 gap-0.5" aria-hidden="true">
          <div
            className={`rounded-l transition-all duration-500 ${PARTY_BG[race.aParty]}`}
            style={{ flexGrow: now.a }}
          />
          <div className="bg-white/10" style={{ flexGrow: rest }} />
          <div
            className={`rounded-r transition-all duration-500 ${PARTY_BG[race.bParty]}`}
            style={{ flexGrow: now.b }}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-ayu-subtle">
        {now.called && <Chip tone="green">{winner} wins</Chip>}
        {flip && <Chip tone="purple">Flip</Chip>}
        {race.mine && <Chip tone="blue">Your ballot</Chip>}
        <span>
          {started ? `${Math.round(now.counted)}% counted` : "No votes yet"}
        </span>
      </div>
    </li>
  );
}

function RaceGroup({ title, items }: { title: string; items: RaceAt[] }) {
  if (items.length === 0) return null;
  return (
    <Section title={title} aside={`${items.length}`}>
      <ul className="divide-y divide-white/[0.06]">
        {items.map((item) => (
          <RaceRow key={item.race.id} item={item} />
        ))}
      </ul>
    </Section>
  );
}

function Night({ election }: { election: Election }) {
  const lastIndex = election.updates.length - 1;
  const [index, setIndex] = useState(lastIndex);
  const [playing, setPlaying] = useState(false);
  const [kind, setKind] = useState<KindFilter>("all");
  const now = useMemo(() => electionAt(election, index), [election, index]);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (index >= lastIndex) setPlaying(false);
      else setIndex(index + 1);
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, index, lastIndex]);

  function togglePlay() {
    if (!playing && index >= lastIndex) setIndex(0);
    setPlaying(!playing);
  }

  const shown = now.races.filter((r) => kind === "all" || r.race.kind === kind);
  const open = shown.filter((r) => !r.now.called && !r.race.mine);
  const called = shown.filter((r) => r.now.called && !r.race.mine);
  const mine = shown.filter((r) => r.race.mine);

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.04]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play the night"}
            className="jim-glow grid size-11 shrink-0 place-items-center rounded-full text-ayu-bg hover:brightness-110"
          >
            {playing ? (
              <Pause aria-hidden="true" className="size-5" />
            ) : (
              <Play aria-hidden="true" className="size-5" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={lastIndex}
            value={index}
            aria-label="Moment in the night"
            aria-valuetext={clock(now.update.at)}
            onChange={(e) => {
              setPlaying(false);
              setIndex(Number(e.target.value));
            }}
            className="min-h-11 w-full accent-ayu-accent"
          />
        </div>
        <p className="text-sm text-ayu-subtle">
          {clock(now.update.at)} · update {index + 1} of {lastIndex + 1}
        </p>
        <p aria-live="polite" className="text-lg font-semibold text-ayu-text">
          {now.update.headline}
        </p>
        {now.update.asked && (
          <p className="text-sm text-ayu-subtle">
            You asked: “{now.update.asked}”
          </p>
        )}
      </div>

      <Legend />

      {(now.senate || now.house) && (
        <div className="space-y-5">
          {now.senate && (
            <Seats
              name="Senate"
              chamber={now.senate}
              majority={SENATE_MAJORITY}
            />
          )}
          {now.house && (
            <Seats name="House" chamber={now.house} majority={HOUSE_MAJORITY} />
          )}
        </div>
      )}

      <Segmented
        label="Race types"
        options={KIND_FILTERS}
        value={kind}
        onChange={setKind}
      />
      <RaceGroup title="Your ballot" items={mine} />
      <RaceGroup title="Still counting" items={open} />
      <RaceGroup title="Called" items={called} />

      <Section title="The night">
        <ol className="divide-y divide-white/[0.06]">
          {election.updates.map((u, i) => (
            <li key={u.at}>
              <button
                type="button"
                aria-current={i === index ? "step" : undefined}
                onClick={() => {
                  setPlaying(false);
                  setIndex(i);
                }}
                className="flex min-h-11 w-full gap-3 py-2.5 text-left"
              >
                <span className="w-16 shrink-0 text-sm text-ayu-subtle">
                  {clock(u.at)}
                </span>
                <span
                  className={
                    i === index
                      ? "font-medium text-ayu-accent"
                      : "text-ayu-text"
                  }
                >
                  {u.headline}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

export function NotesElection(props: ExplorePageProps) {
  const state = useExplore("elections", props.getToken, props.api, true);
  const [slug, setSlug] = useState("");
  return (
    <ExploreFrame state={state} what="the election">
      {({ elections }) => {
        if (elections.length === 0) {
          return <Empty>No election nights saved yet.</Empty>;
        }
        const election = elections.find((e) => e.slug === slug) ?? elections[0];
        return (
          <div className="space-y-4">
            {elections.length > 1 && (
              <Segmented
                label="Elections"
                options={elections.map((e) => ({ id: e.slug, label: e.title }))}
                value={election.slug}
                onChange={setSlug}
              />
            )}
            <h2 className="text-xl font-semibold text-ayu-text">
              {election.title}
            </h2>
            <Night key={election.slug} election={election} />
          </div>
        );
      }}
    </ExploreFrame>
  );
}
