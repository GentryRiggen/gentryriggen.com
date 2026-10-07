"use client";

import { useEffect, useMemo, useState } from "react";
import { summarize } from "@/lib/analytics/aggregate";
import type { PageviewDoc, Site } from "@/lib/analytics/types";
import { fetchPageviews } from "@/lib/firebase/client";
import SummaryView from "./SummaryView";

type Tab = "overview" | Site;
type Range = 7 | 30 | 90;

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "home", label: "Home (/)" },
  { id: "ship-builder", label: "Ship Builder" },
];
const RANGES: Range[] = [7, 30, 90];
const DAY_MS = 86_400_000;

interface Loaded {
  days: Range;
  docs: PageviewDoc[];
  truncated: boolean;
  error: boolean;
  /** When the data was fetched; the summary windows end on this day. */
  at: Date;
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [days, setDays] = useState<Range>(7);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Two windows (current + previous) plus a day of slack for UTC rounding.
    const since = Date.now() - (2 * days + 1) * DAY_MS;
    fetchPageviews(since)
      .then((result) => {
        if (!cancelled) {
          setLoaded({ days, ...result, error: false, at: new Date() });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded({
            days,
            docs: [],
            truncated: false,
            error: true,
            at: new Date(),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  // Data for a different range is stale: treat it as still loading.
  const current = loaded !== null && loaded.days === days ? loaded : null;
  const summaries = useMemo(() => {
    if (!current || current.error) return null;
    const options = { days: current.days, now: current.at };
    return {
      all: summarize(current.docs, { site: "all", ...options }),
      home: summarize(current.docs, { site: "home", ...options }),
      "ship-builder": summarize(current.docs, {
        site: "ship-builder",
        ...options,
      }),
    };
  }, [current]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Site" className="flex gap-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? "rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white dark:bg-blue-500"
                  : "rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={days === range}
              onClick={() => setDays(range)}
              className={
                days === range
                  ? "rounded-md border border-blue-600 px-3 py-1.5 text-sm text-blue-700 dark:border-blue-400 dark:text-blue-300"
                  : "rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              }
            >
              {range} days
            </button>
          ))}
        </div>
      </div>

      {!current && <p className="text-gray-600 dark:text-gray-400">Loading…</p>}
      {current?.error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          Couldn&apos;t load analytics. Check that you are signed in as the
          admin and that Firestore is set up.
        </p>
      )}
      {current?.truncated && (
        <p className="text-amber-700 dark:text-amber-400">
          Showing the newest views only; older views are missing for this range.
        </p>
      )}
      {summaries && tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {(["home", "ship-builder"] as const).map((site) => (
              <section
                key={site}
                className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
              >
                <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {site === "home" ? "Home (/)" : "Ship Builder"}
                </h2>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {summaries[site].totals.views.toLocaleString()}{" "}
                  <span className="text-sm font-normal text-gray-600 dark:text-gray-400">
                    views · {summaries[site].totals.visitors.toLocaleString()}{" "}
                    visitors
                  </span>
                </p>
              </section>
            ))}
          </div>
          <SummaryView summary={summaries.all} />
        </div>
      )}
      {summaries && tab !== "overview" && (
        <SummaryView summary={summaries[tab]} />
      )}
    </main>
  );
}
