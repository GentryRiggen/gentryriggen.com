import type { Count } from "./aggregate";
import {
  CRASH_BUCKET_METERS,
  GAME_EVENTS,
  type GameEvent,
  type GameEventName,
} from "./gameEvents";

export const WORLD_IDS = GAME_EVENTS.flight_end.props.world.values;

export interface CrashBar {
  /** Start of the 50 m bucket, in meters from the launch. */
  x: number;
  crashes: number;
}

export interface WorldSummary {
  world: string;
  flights: number;
  finishes: number;
  /** Share of flights that finished, 0 to 1; null with no flights. */
  finishRate: number | null;
  crashes: number;
  /** Crash counts per 50 m bucket from 0 up to the farthest crash. */
  crashBars: CrashBar[];
  /** Flights left mid-air, by tenth of the course reached (index 0 to 10). */
  quitsByTenth: number[];
  quits: number;
  /** The most-hit obstacle kinds for crashes in this world. */
  obstacles: Count[];
}

export interface PlaneSummary {
  flights: number;
  worlds: WorldSummary[];
  obstacles: Count[];
  upgrades: Count[];
  unlocks: Count[];
  dailyPlayed: number;
  dailyFinished: number;
}

export interface ShipSummary {
  trials: number;
  /** "weather" or "iceberg" trials by outcome, e.g. "iceberg: sank". */
  trialOutcomes: Count[];
  /** Per challenge: how many results earned 0, 1, 2 and 3 stars. */
  challenges: { id: string; stars: number[]; results: number }[];
  templates: Count[];
  /** Sampled (about 1 in 20), so only the proportions mean anything. */
  partCategories: Count[];
  /** How walkers escaped, as "ending · boat" (e.g. "deck · davit"). */
  escapes: Count[];
  walks: number;
  drives: number;
  shares: number;
}

function ofName<N extends GameEventName>(events: GameEvent[], name: N) {
  return events.filter((event) => event.name === name);
}

function tally(keys: string[]): Count[] {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts]
    .map(([key, views]) => ({ key, views }))
    .sort((a, b) => b.views - a.views || a.key.localeCompare(b.key));
}

function num(event: GameEvent, key: string): number {
  return Number(event.props[key]);
}

function str(event: GameEvent, key: string): string {
  return String(event.props[key]);
}

function summarizeWorld(
  world: string,
  ends: GameEvent[],
  quits: GameEvent[]
): WorldSummary {
  const crashed = ends.filter((e) => str(e, "outcome") === "crash");
  const finishes = ends.filter((e) => str(e, "outcome") === "finish").length;
  const farthest = Math.max(-1, ...crashed.map((e) => num(e, "crashX")));
  const crashBars: CrashBar[] = [];
  for (let x = 0; x <= farthest; x += CRASH_BUCKET_METERS) {
    crashBars.push({ x, crashes: 0 });
  }
  for (const e of crashed) {
    const bar = crashBars[num(e, "crashX") / CRASH_BUCKET_METERS];
    if (bar) bar.crashes += 1;
  }
  const quitsByTenth = Array.from({ length: 11 }, () => 0);
  for (const e of quits) quitsByTenth[num(e, "dist")] += 1;
  return {
    world,
    flights: ends.length,
    finishes,
    finishRate: ends.length === 0 ? null : finishes / ends.length,
    crashes: crashed.length,
    crashBars,
    quitsByTenth,
    quits: quits.length,
    obstacles: tally(
      crashed.map((e) => str(e, "obstacle")).filter((kind) => kind !== "none")
    ),
  };
}

export function summarizePlane(events: GameEvent[]): PlaneSummary {
  const ends = ofName(events, "flight_end");
  const quits = ofName(events, "quit_mid_flight");
  const daily = ofName(events, "daily_played");
  return {
    flights: ends.length,
    worlds: WORLD_IDS.map((world) =>
      summarizeWorld(
        world,
        ends.filter((e) => e.props.world === world),
        quits.filter((e) => e.props.world === world)
      )
    ),
    obstacles: tally(
      ends
        .filter((e) => str(e, "outcome") === "crash")
        .map((e) => str(e, "obstacle"))
        .filter((kind) => kind !== "none")
    ),
    upgrades: tally(
      ofName(events, "upgrade_bought").map((e) => str(e, "part"))
    ),
    unlocks: tally(
      ofName(events, "world_unlocked").map((e) => str(e, "world"))
    ),
    dailyPlayed: daily.length,
    dailyFinished: daily.filter((e) => num(e, "finished") === 1).length,
  };
}

export function summarizeShip(events: GameEvent[]): ShipSummary {
  const trials = ofName(events, "trial_run");
  const results = ofName(events, "challenge_result");
  return {
    trials: trials.length,
    trialOutcomes: tally(
      trials.map((e) => `${str(e, "kind")}: ${str(e, "outcome")}`)
    ),
    challenges: GAME_EVENTS.challenge_result.props.id.values.map((id) => {
      const mine = results.filter((e) => e.props.id === id);
      const stars = [0, 0, 0, 0];
      for (const e of mine) stars[num(e, "stars")] += 1;
      return { id, stars, results: mine.length };
    }),
    templates: tally(
      ofName(events, "template_used").map((e) => str(e, "template"))
    ),
    partCategories: tally(
      ofName(events, "part_placed").map((e) => str(e, "category"))
    ),
    escapes: tally(
      ofName(events, "escape_ending").map(
        (e) => `${str(e, "ending")} · ${str(e, "boat")}`
      )
    ),
    walks: ofName(events, "walk_started").length,
    drives: ofName(events, "drive_started").length,
    shares: ofName(events, "ship_shared").length,
  };
}
