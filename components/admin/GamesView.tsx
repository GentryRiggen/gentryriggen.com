import {
  summarizePlane,
  summarizeShip,
  type WorldSummary,
} from "@/lib/analytics/gameAggregate";
import type { GameEvent } from "@/lib/analytics/gameEvents";
import { useMemo } from "react";
import BarStrip from "./BarStrip";
import BreakdownList from "./BreakdownList";

interface GamesViewProps {
  events: GameEvent[];
}

const CHALLENGE_NAMES: Record<string, string> = {
  outlast: "Outlast",
  evacuation: "Everyone off safely",
  shipshape: "Shipshape",
};

function percent(share: number | null): string {
  return share === null ? "no flights" : `${Math.round(share * 100)}%`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function WorldCard({ summary }: { summary: WorldSummary }) {
  const { world, flights, finishRate, crashes, crashBars, quitsByTenth } =
    summary;
  const lastBar = crashBars[crashBars.length - 1];
  return (
    <li
      data-testid={`world-${world}`}
      className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium capitalize">{world}</h3>
        <p className="text-sm text-gray-600 tabular-nums dark:text-gray-400">
          {flights.toLocaleString()} flights · {percent(finishRate)} finish
        </p>
      </div>
      <progress
        className="block h-1.5 w-full overflow-hidden rounded [&::-moz-progress-bar]:bg-emerald-500 [&::-webkit-progress-bar]:bg-gray-100 dark:[&::-webkit-progress-bar]:bg-gray-800 [&::-webkit-progress-value]:bg-emerald-500 dark:[&::-webkit-progress-value]:bg-emerald-400"
        value={Math.round((finishRate ?? 0) * 100)}
        max={100}
        aria-label={`${world} finish rate: ${percent(finishRate)}`}
      />
      {crashes > 0 && lastBar ? (
        <BarStrip
          title="Crashes along the course"
          unit="crashes"
          bars={crashBars.map((bar) => ({
            label: `${bar.x}–${bar.x + 49} m`,
            value: bar.crashes,
          }))}
          startLabel="0 m"
          endLabel={`${lastBar.x + 50} m`}
        />
      ) : (
        <p className="text-sm text-gray-500">No crashes yet</p>
      )}
      {summary.quits > 0 && (
        <BarStrip
          title="Where players quit"
          unit="quits"
          bars={quitsByTenth.slice(0, 10).map((value, tenth) => ({
            label: `${tenth * 10}–${tenth * 10 + 9}% of the course`,
            value,
          }))}
          startLabel="launch"
          endLabel="finish"
        />
      )}
      {summary.obstacles.length > 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Most hit:{" "}
          {summary.obstacles
            .slice(0, 3)
            .map((row) => `${row.key} (${row.views})`)
            .join(", ")}
        </p>
      )}
    </li>
  );
}

export default function GamesView({ events }: GamesViewProps) {
  const plane = useMemo(() => summarizePlane(events), [events]);
  const ship = useMemo(() => summarizeShip(events), [events]);
  const playedWorlds = plane.worlds.filter(
    (world) => world.flights > 0 || world.quits > 0
  );

  return (
    <div className="space-y-8">
      <Section title="Plane Builder">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Flights
            </div>
            <div
              data-testid="plane-flights"
              className="mt-1 text-3xl font-semibold tabular-nums"
            >
              {plane.flights.toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Daily challenge
            </div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">
              {plane.dailyFinished.toLocaleString()}
              <span className="text-base font-normal text-gray-600 dark:text-gray-400">
                {" "}
                finished of {plane.dailyPlayed.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
        {playedWorlds.length === 0 ? (
          <p className="text-sm text-gray-500">No flights in this range</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {playedWorlds.map((world) => (
              <WorldCard key={world.world} summary={world} />
            ))}
          </ul>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <BreakdownList
            title="Most-hit obstacles"
            rows={plane.obstacles}
            unit="crashes"
          />
          <BreakdownList
            title="Upgrades bought"
            rows={plane.upgrades}
            unit="upgrades"
          />
          <BreakdownList
            title="Worlds unlocked"
            rows={plane.unlocks}
            unit="unlocks"
          />
        </div>
      </Section>

      <Section title="Ship Builder">
        <div className="grid gap-4 sm:grid-cols-3">
          {ship.challenges.map((challenge) => (
            <div
              key={challenge.id}
              data-testid={`challenge-${challenge.id}`}
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
            >
              <BarStrip
                title={`${CHALLENGE_NAMES[challenge.id] ?? challenge.id}: stars`}
                unit="results"
                bars={challenge.stars.map((value, stars) => ({
                  label: `${stars} stars`,
                  value,
                }))}
                startLabel="0 stars"
                endLabel="3 stars"
              />
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <BreakdownList
            title="Sea trial outcomes"
            rows={ship.trialOutcomes}
            unit="trials"
          />
          <BreakdownList
            title="Popular templates"
            rows={ship.templates}
            unit="ships"
          />
          <BreakdownList
            title="Parts placed (sampled)"
            rows={ship.partCategories}
            unit="parts"
          />
          <BreakdownList
            title="How walkers escaped"
            rows={ship.escapes}
            unit="walks"
          />
          <BreakdownList
            title="Modes and sharing"
            rows={[
              { key: "Walks", views: ship.walks },
              { key: "Drives", views: ship.drives },
              { key: "Ships shared", views: ship.shares },
            ]}
            unit="times"
          />
        </div>
      </Section>
    </div>
  );
}
