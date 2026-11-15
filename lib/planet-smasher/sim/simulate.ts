import { useGameStore } from "../store";
import { gridFromLuminance, type PopulationGrid } from "../population";
import type { PlanetId } from "../planets";
import { PROGRESS_KEY } from "../progress";
import { seeded } from "../rng";
import { TOOLS, type ToolId } from "../tools";
import { UNLOCK_PATH } from "../unlocks";
import { BOT_FACTORIES, type Bot } from "./bots";

export interface SimEvent {
  /** Seconds of simulated play. */
  t: number;
  kind: "tool" | "planet" | "trophy";
  id: string;
}

export interface Trace {
  bot: string;
  seed: number;
  durationSec: number;
  events: SimEvent[];
  planetsWrecked: number;
  /** Points (stars) at t = 0, 30, 60 ... seconds. */
  stars: number[];
  /** Seconds when the last tool or planet on the unlock path opened, or null. */
  allUnlockedSec: number | null;
}

export const STAR_SAMPLE_SEC = 30;
export const ENDING_SEC = 4;
export const NEW_PLANET_SEC = 2;
/** How long the laser is held per fire. */
export const LASER_HOLD_SEC = 2;

/** Seconds from the tap to the first impact. */
export const FLIGHT_SEC: Record<ToolId, number> = {
  asteroid: 0.8,
  meteorShower: 0.8,
  megaBomb: 1.0,
  nuke: 1.5,
  supervolcano: 0.8,
  earthquake: 0.6,
  alienLaser: 0,
  freezeRay: 1.0,
  moonRam: 2.0,
  blackHole: 1.5,
  nukeTwin: 1.5,
  nukeRain: 1.5,
  ufoSwarm: 1.5,
  gravityBeam: 1.0,
  nanobots: 0.5,
  mothership: 3.0,
  monster: 1.5,
  tsunami: 1.0,
  sunDive: 3.0,
  planetCollision: 3.0,
};

/** Impacts per fire and the seconds they spread over (the effect duration). */
export const IMPACTS: Partial<Record<ToolId, { count: number; span: number }>> =
  {
    meteorShower: { count: 10, span: 1.5 },
    nukeTwin: { count: 2, span: 0.6 },
    nukeRain: { count: 6, span: 2 },
    ufoSwarm: { count: 12, span: 3 },
    nanobots: { count: 40, span: 10 },
    monster: { count: 6, span: 5 },
    tsunami: { count: 16, span: 5 },
    alienLaser: { count: 8 * LASER_HOLD_SEC, span: LASER_HOLD_SEC },
  };

const SPREAD = 0.03;

export interface SynthGrid {
  grid: PopulationGrid;
  /** Blob centres as [u, v]. */
  centres: [number, number][];
}

/** Seeded grid: about 40 gaussian cities over a 0.02 floor. */
export function buildGrid(seed = 7, w = 256, h = 128): SynthGrid {
  const rng = seeded(seed);
  const centres: [number, number][] = [];
  const blobs: { u: number; v: number; s: number; a: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const b = {
      u: rng(),
      v: 0.15 + rng() * 0.7,
      s: 0.008 + rng() * 0.022,
      a: 0.3 + rng() * 0.7,
    };
    blobs.push(b);
    centres.push([b.u, b.v]);
  }
  const lum = new Float32Array(w * h);
  for (let row = 0; row < h; row++) {
    const v = 1 - (row + 0.5) / h;
    for (let col = 0; col < w; col++) {
      const u = (col + 0.5) / w;
      let sum = 0;
      for (const b of blobs) {
        let du = Math.abs(u - b.u);
        du = Math.min(du, 1 - du) * 2; // the map is twice as wide as tall
        const dv = v - b.v;
        sum += b.a * Math.exp(-(du * du + dv * dv) / (2 * b.s * b.s));
      }
      lum[row * w + col] = sum;
    }
  }
  return { grid: gridFromLuminance(lum, w, h, 0.02), centres };
}

let cachedGrid: SynthGrid | null = null;
const defaultGrid = (): SynthGrid => (cachedGrid ??= buildGrid());

interface Impact {
  at: number;
  seq: number;
  kind: "impact";
  planetIndex: number;
  tool: ToolId;
  u: number;
  v: number;
  fireId: number;
}
interface Step {
  at: number;
  seq: number;
  kind: "endingShown" | "newPlanet";
}
type Item = Impact | Step;

const wrap01 = (x: number) => ((x % 1) + 1) % 1;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function clearStorage(): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PROGRESS_KEY);
    }
  } catch {
    // no storage
  }
}

export interface SimOptions {
  bot: string;
  seed: number;
  minutes?: number;
  synth?: SynthGrid;
}

/** Plays one bot through the real store for `minutes` of simulated time. */
export function simulate(opts: SimOptions): Trace {
  const { grid, centres } = opts.synth ?? defaultGrid();
  const bot: Bot = BOT_FACTORIES[opts.bot]();
  const rng = seeded(opts.seed);
  const endSec = (opts.minutes ?? 150) * 60;
  const store = useGameStore;

  clearStorage();
  store.getState().init(grid);
  const resetRun = (t: number) =>
    store.setState({ planetRun: { toolsUsed: [], startedAt: t * 1000 } });
  resetRun(0);

  const unlockedTools: ToolId[] = ["asteroid"];
  const unlockedPlanets: PlanetId[] = ["earth"];
  const events: SimEvent[] = [];
  const stars: number[] = [];
  let planetsWrecked = 0;
  let planetIndex = 0;
  let allUnlockedSec: number | null = null;
  let seq = 0;
  let fireCounter = 0;
  const queue: Item[] = [];
  const readyAt = new Map<ToolId, number>();
  let nextSample = 0;
  let blockedUntil = 0;
  let prevFire = -bot.tapGap;
  let pending: { at: number; tool: ToolId } | null = null;
  const pathTotal = UNLOCK_PATH.length;
  let pathOpened = 0;

  const push = (item: Item) => {
    queue.push(item);
  };
  const popEarliest = (): Item => {
    let best = 0;
    for (let i = 1; i < queue.length; i++) {
      const a = queue[i];
      const b = queue[best];
      if (a.at < b.at || (a.at === b.at && a.seq < b.seq)) best = i;
    }
    return queue.splice(best, 1)[0];
  };
  const peekAt = (): number => {
    let best = Infinity;
    for (const q of queue) if (q.at < best) best = q.at;
    return best;
  };

  const sampleUntil = (t: number) => {
    while (nextSample <= t && nextSample <= endSec) {
      stars.push(store.getState().progress.points);
      nextSample += STAR_SAMPLE_SEC;
    }
  };

  const collect = (t: number) => {
    const s = store.getState();
    if (!s.lastUnlocks.length && !s.lastTrophies.length) return;
    for (const u of s.lastUnlocks) {
      events.push({ t, kind: u.kind, id: u.id });
      if (u.kind === "tool") unlockedTools.push(u.id);
      else unlockedPlanets.push(u.id);
      pathOpened++;
    }
    for (const id of s.lastTrophies) events.push({ t, kind: "trophy", id });
    if (pathOpened >= pathTotal && allUnlockedSec === null) allUnlockedSec = t;
    s.clearUnlocks();
    s.clearTrophies();
  };

  const planDecision = () => {
    const tool = bot.pickTool(unlockedTools, rng);
    const at = Math.max(
      prevFire + bot.tapGap,
      readyAt.get(tool) ?? 0,
      blockedUntil
    );
    pending = { at, tool };
  };

  const aim = (): [number, number] => {
    if (rng() < 0.6) {
      const c = centres[Math.min(centres.length - 1, Math.floor(rng() * 40))];
      return [
        wrap01(c[0] + (rng() - 0.5) * 0.01),
        clamp01(c[1] + (rng() - 0.5) * 0.01),
      ];
    }
    return [rng(), 0.05 + rng() * 0.9];
  };

  const fire = (at: number, tool: ToolId) => {
    const [u, v] = aim();
    const fireId = ++fireCounter;
    const multi = IMPACTS[tool];
    const flight = FLIGHT_SEC[tool];
    prevFire = at;
    const span = multi ? multi.span : 0;
    const cooldown = TOOLS[tool].cooldownMs / 1000;
    readyAt.set(tool, at + (tool === "alienLaser" ? span : 0) + cooldown);
    const n = multi ? multi.count : 1;
    for (let i = 0; i < n; i++) {
      const jitter = multi && tool !== "nukeTwin";
      push({
        at: at + flight + (multi ? (span * i) / n : 0),
        seq: seq++,
        kind: "impact",
        planetIndex,
        tool,
        u: jitter ? wrap01(u + (rng() - 0.5) * SPREAD * 2) : u,
        v: jitter ? clamp01(v + (rng() - 0.5) * SPREAD) : v,
        fireId,
      });
    }
  };

  planDecision();
  for (;;) {
    const qAt = peekAt();
    const fAt = pending ? pending.at : Infinity;
    const t = Math.min(qAt, fAt);
    if (t > endSec) break;
    sampleUntil(t);

    if (qAt <= fAt) {
      const item = popEarliest();
      if (item.kind === "impact") {
        if (item.planetIndex !== planetIndex) continue;
        const s = store.getState();
        if (s.phase !== "playing") continue;
        const res = s.hit(
          item.tool,
          item.u,
          item.v,
          item.at * 1000,
          item.fireId
        );
        collect(item.at);
        if (res.ending) {
          blockedUntil = item.at + ENDING_SEC + NEW_PLANET_SEC;
          push({ at: item.at + ENDING_SEC, seq: seq++, kind: "endingShown" });
          push({ at: blockedUntil, seq: seq++, kind: "newPlanet" });
        }
      } else if (item.kind === "endingShown") {
        store.getState().endingShown();
      } else {
        planetsWrecked++;
        planetIndex++;
        const next = bot.pickPlanet(unlockedPlanets, planetsWrecked, rng);
        const s = store.getState();
        if (next) s.selectPlanet(next, grid);
        else s.newPlanet(grid);
        resetRun(item.at);
      }
    } else if (pending) {
      const { at, tool }: { at: number; tool: ToolId } = pending;
      if (at < blockedUntil) {
        pending = { at: blockedUntil, tool };
        continue;
      }
      pending = null;
      fire(at, tool);
      planDecision();
    }
  }
  sampleUntil(endSec);
  clearStorage();
  return {
    bot: opts.bot,
    seed: opts.seed,
    durationSec: endSec,
    events,
    planetsWrecked,
    stars,
    allUnlockedSec,
  };
}
