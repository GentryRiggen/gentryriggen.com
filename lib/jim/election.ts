/**
 * Election nights: what `POST /api/elections` sends, cleaned up, and how a
 * night looks at any one update. The server reads snapshots/elections/*.json
 * from the notes repo (format: jimlib/election.py there). An update is a
 * moment Gentry asked for the latest, and holds only what was read then, so
 * `electionAt` carries each race and chamber forward from its last reading.
 */

export type Party = "D" | "R" | "I";
export type RaceKind = "senate" | "house" | "governor" | "other";
export type Side = "a" | "b";

export interface ElectionRace {
  id: string;
  name: string;
  kind: RaceKind;
  a: string;
  aParty: Party;
  b: string;
  bParty: Party;
  /** The party holding the seat going in. */
  seat: Party;
  /** On Gentry's own ballot. */
  mine: boolean;
}

export interface RaceResult {
  a: number;
  b: number;
  counted: number;
  called: Side | null;
}

export interface Chamber {
  d: number;
  r: number;
  uncalled: number;
  flips: number | null;
  /** The forecast of Democratic seats at the end, when there is one. */
  estimate: number | null;
}

export interface ElectionUpdate {
  /** ISO time with its offset. */
  at: string;
  asked: string;
  headline: string;
  senate: Chamber | null;
  house: Chamber | null;
  results: Record<string, RaceResult>;
}

export interface Election {
  slug: string;
  title: string;
  /** YYYY-MM-DD. */
  date: string;
  races: ElectionRace[];
  /** Oldest first. */
  updates: ElectionUpdate[];
}

export interface ElectionsData {
  /** Newest first. */
  elections: Election[];
  stale?: boolean;
}

export interface RaceAt {
  race: ElectionRace;
  now: RaceResult;
  /** Lead of a over b at each reading with votes, oldest first. */
  trail: number[];
  /** Called for someone other than the party holding the seat. */
  flip: boolean;
}

export interface ElectionAt {
  update: ElectionUpdate;
  senate: Chamber | null;
  house: Chamber | null;
  /** Every race read so far, in catalog order. */
  races: RaceAt[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(r: Record<string, unknown>, key: string): string {
  return typeof r[key] === "string" ? (r[key] as string) : "";
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function party(value: unknown): Party | null {
  return value === "D" || value === "R" || value === "I" ? value : null;
}

function toRace(id: string, v: unknown): ElectionRace | null {
  if (!isRecord(v)) return null;
  const aParty = party(v.aParty);
  const bParty = party(v.bParty);
  const seat = party(v.seat);
  const name = str(v, "name");
  const a = str(v, "a");
  const b = str(v, "b");
  if (!aParty || !bParty || !seat || !name || !a || !b) return null;
  const k = v.kind;
  const kind: RaceKind =
    k === "senate" || k === "house" || k === "governor" ? k : "other";
  return { id, name, kind, a, aParty, b, bParty, seat, mine: v.mine === true };
}

function toResult(v: unknown): RaceResult | null {
  if (!isRecord(v)) return null;
  const a = count(v.a);
  const b = count(v.b);
  const counted = count(v.counted);
  if (a === null || b === null || counted === null) return null;
  const called = v.called === "a" || v.called === "b" ? v.called : null;
  return { a, b, counted, called };
}

function toChamber(v: unknown): Chamber | null {
  if (!isRecord(v)) return null;
  const d = count(v.d);
  const r = count(v.r);
  const uncalled = count(v.uncalled);
  if (d === null || r === null || uncalled === null) return null;
  return { d, r, uncalled, flips: count(v.flips), estimate: count(v.estimate) };
}

function toUpdate(v: unknown, known: Set<string>): ElectionUpdate | null {
  if (!isRecord(v)) return null;
  const at = str(v, "at");
  const headline = str(v, "headline");
  if (!headline || Number.isNaN(Date.parse(at))) return null;
  const results: Record<string, RaceResult> = {};
  if (isRecord(v.results)) {
    for (const [id, raw] of Object.entries(v.results)) {
      const result = toResult(raw);
      if (result && known.has(id)) results[id] = result;
    }
  }
  return {
    at,
    asked: str(v, "asked"),
    headline,
    senate: toChamber(v.senate),
    house: toChamber(v.house),
    results,
  };
}

function toElection(v: unknown): Election | null {
  if (!isRecord(v) || !isRecord(v.races) || !Array.isArray(v.updates)) {
    return null;
  }
  const races: ElectionRace[] = [];
  for (const [id, raw] of Object.entries(v.races)) {
    const race = toRace(id, raw);
    if (race) races.push(race);
  }
  const known = new Set(races.map((r) => r.id));
  const updates: ElectionUpdate[] = [];
  for (const raw of v.updates) {
    const update = toUpdate(raw, known);
    if (update) updates.push(update);
  }
  const slug = str(v, "slug");
  if (!slug || updates.length === 0) return null;
  return {
    slug,
    title: str(v, "title") || slug,
    date: str(v, "date"),
    races,
    updates,
  };
}

export function normalizeElections(raw: unknown): ElectionsData | null {
  if (!isRecord(raw) || !Array.isArray(raw.elections)) return null;
  const elections: Election[] = [];
  for (const v of raw.elections) {
    const election = toElection(v);
    if (election) elections.push(election);
  }
  return raw.stale === true ? { elections, stale: true } : { elections };
}

/** The whole night as it stood at update `index`. */
export function electionAt(election: Election, index: number): ElectionAt {
  const last = Math.min(Math.max(index, 0), election.updates.length - 1);
  const seen = election.updates.slice(0, last + 1);
  let senate: Chamber | null = null;
  let house: Chamber | null = null;
  for (const u of seen) {
    senate = u.senate ?? senate;
    house = u.house ?? house;
  }
  const races: RaceAt[] = [];
  for (const race of election.races) {
    const readings = seen.flatMap((u) => u.results[race.id] ?? []);
    const now = readings.at(-1);
    if (!now) continue;
    const winner = now.called === "a" ? race.aParty : race.bParty;
    races.push({
      race,
      now,
      trail: readings.filter((r) => r.counted > 0).map((r) => r.a - r.b),
      flip: now.called !== null && winner !== race.seat,
    });
  }
  return { update: election.updates[last], senate, house, races };
}
