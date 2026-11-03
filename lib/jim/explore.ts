import { useCallback, useEffect, useRef, useState } from "react";
import { getIdToken } from "@/lib/jim/auth";
import { JIM_API, JimError, type JimErrorKind } from "@/lib/jim/api";
import { callJim } from "@/lib/jim/view";

/**
 * Explore's data: the note graph, the timeline and the ballot, each from its
 * own `POST /api/<kind>` read on Jim's server. They are big or seasonal, so
 * each is fetched when its page opens and held in that page's memory only:
 * this module touches no storage API, and `clearExplore` drops everything on
 * sign-out. Every string is ready to show; nothing here names a note.
 */

export type ExploreKind = "graph" | "timeline" | "ballot";

export interface GraphNode {
  /** The note's repo path, e.g. "home/garden.md". */
  id: string;
  title: string;
  /** Its top folder ("people", "home"…). */
  folder: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  stale?: boolean;
}

export type TimelineKind = "log" | "done" | "note" | "due";

export interface TimelineEvent {
  /** YYYY-MM-DD. */
  date: string;
  /** "9:30", when the event has one. */
  time?: string;
  kind: TimelineKind;
  title?: string;
  text: string;
  /** The note it comes from (repo path). */
  path: string;
  /** Where it came from, worded ("todos", the note's title). */
  src: string;
}

export interface TimelineData {
  /** Newest first. */
  events: TimelineEvent[];
  stale?: boolean;
}

export interface BallotTable {
  heading: string;
  header: string[];
  rows: string[][];
}

export interface BallotSection {
  heading: string;
  /** Markdown before and after the section's tables. */
  before: string;
  after: string;
  tables: BallotTable[];
}

export interface BallotGuide {
  path: string;
  title: string;
  intro: string;
  /** Election day, YYYY-MM-DD, or "". */
  date: string;
  sections: BallotSection[];
}

export interface BallotVoted {
  path: string;
  title: string;
  /** Label → value pairs, in the note's order. */
  facts: Record<string, string>;
  sections: BallotSection[];
}

export interface BallotData {
  guide: BallotGuide | null;
  voted: BallotVoted | null;
  stale?: boolean;
}

export interface ExploreData {
  graph: GraphData;
  timeline: TimelineData;
  ballot: BallotData;
}

/** Caps matching the server's, so a runaway payload can't flood the page. */
export const MAX_NODES = 1500;
export const MAX_LINKS = 6000;
export const MAX_EVENTS = 3000;

/** A cold start plus reading every note fits well inside this. */
export const EXPLORE_TIMEOUT_MS = 30_000;

type GetToken = (force?: boolean) => Promise<string | null>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function text(r: Record<string, unknown>, key: string): string {
  return isString(r[key]) ? (r[key] as string) : "";
}

function keep<T>(value: unknown, ok: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    const kept = ok(item);
    if (kept !== null) out.push(kept);
  }
  return out;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// ---------- graph ----------

function toNode(v: unknown): GraphNode | null {
  if (!isRecord(v) || !isString(v.id) || v.id === "") return null;
  return {
    id: v.id,
    title: text(v, "title") || v.id.replace(/\.md$/, ""),
    folder: text(v, "folder"),
  };
}

/** The graph with unknown ends, self-links and repeats dropped. */
export function normalizeGraph(raw: unknown): GraphData | null {
  if (!isRecord(raw) || !Array.isArray(raw.nodes)) return null;
  const nodes: GraphNode[] = [];
  const ids = new Set<string>();
  for (const node of keep(raw.nodes, toNode)) {
    if (ids.has(node.id) || nodes.length >= MAX_NODES) continue;
    ids.add(node.id);
    nodes.push(node);
  }
  const links: GraphLink[] = [];
  const seen = new Set<string>();
  for (const l of Array.isArray(raw.links) ? raw.links : []) {
    if (links.length >= MAX_LINKS) break;
    if (!isRecord(l) || !isString(l.source) || !isString(l.target)) continue;
    const { source, target } = l;
    if (source === target || !ids.has(source) || !ids.has(target)) continue;
    const key = source < target ? `${source}|${target}` : `${target}|${source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ source, target });
  }
  return { nodes, links, ...(raw.stale === true ? { stale: true } : {}) };
}

// ---------- timeline ----------

const KINDS: readonly string[] = ["log", "done", "note", "due"];

function toEvent(v: unknown): TimelineEvent | null {
  if (
    !isRecord(v) ||
    !isString(v.date) ||
    !ISO.test(v.date) ||
    !KINDS.includes(v.kind as string) ||
    !isString(v.text)
  ) {
    return null;
  }
  const time = text(v, "time");
  const title = text(v, "title");
  return {
    date: v.date,
    ...(time ? { time } : {}),
    kind: v.kind as TimelineKind,
    ...(title ? { title } : {}),
    text: v.text,
    path: text(v, "path"),
    src: text(v, "src"),
  };
}

export function normalizeTimeline(raw: unknown): TimelineData | null {
  if (!isRecord(raw) || !Array.isArray(raw.events)) return null;
  return {
    events: keep(raw.events, toEvent).slice(0, MAX_EVENTS),
    ...(raw.stale === true ? { stale: true } : {}),
  };
}

// ---------- ballot ----------

function toTable(v: unknown): BallotTable | null {
  if (!isRecord(v) || !Array.isArray(v.header)) return null;
  if (!v.header.length || !v.header.every(isString)) return null;
  const width = v.header.length;
  const rows = keep(v.rows, (r) =>
    Array.isArray(r) && r.every(isString)
      ? // Short rows padded, long ones cut: every row lines up with the header.
        Array.from({ length: width }, (_, i) => (r[i] as string) ?? "")
      : null
  );
  return { heading: text(v, "heading"), header: v.header as string[], rows };
}

function toSection(v: unknown): BallotSection | null {
  if (!isRecord(v)) return null;
  const section = {
    heading: text(v, "heading"),
    before: text(v, "before"),
    after: text(v, "after"),
    tables: keep(v.tables, toTable),
  };
  return section.heading ||
    section.before ||
    section.after ||
    section.tables.length
    ? section
    : null;
}

function toGuide(v: unknown): BallotGuide | null {
  if (!isRecord(v) || !isString(v.title)) return null;
  const date = text(v, "date");
  return {
    path: text(v, "path"),
    title: v.title,
    intro: text(v, "intro"),
    date: ISO.test(date) ? date : "",
    sections: keep(v.sections, toSection),
  };
}

function toVoted(v: unknown): BallotVoted | null {
  if (!isRecord(v) || !isString(v.title)) return null;
  const facts: Record<string, string> = {};
  if (isRecord(v.facts)) {
    for (const [label, value] of Object.entries(v.facts)) {
      if (isString(value) && value.trim() !== "") facts[label] = value;
    }
  }
  return {
    path: text(v, "path"),
    title: v.title,
    facts,
    sections: keep(v.sections, toSection),
  };
}

/** The ballot; `{}` (no guide, no ballot) is a fine answer too. */
export function normalizeBallot(raw: unknown): BallotData | null {
  if (!isRecord(raw)) return null;
  return {
    guide: toGuide(raw.guide),
    voted: toVoted(raw.voted),
    ...(raw.stale === true ? { stale: true } : {}),
  };
}

const NORMALIZE: {
  [K in ExploreKind]: (raw: unknown) => ExploreData[K] | null;
} = {
  graph: normalizeGraph,
  timeline: normalizeTimeline,
  ballot: normalizeBallot,
};

/**
 * One Explore read. Throws JimError: waking (a 503, offline, the time
 * limit), denied, or server (any other failure or a malformed body).
 */
export async function fetchExplore<K extends ExploreKind>(
  kind: K,
  getToken: GetToken = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API,
  timeoutMs: number = EXPLORE_TIMEOUT_MS
): Promise<ExploreData[K]> {
  const res = await callJim(
    `/api/${kind}`,
    { method: "POST", body: {} },
    getToken,
    fetchFn,
    api,
    timeoutMs
  );
  if (res.status === 503) throw new JimError("waking");
  if (!res.ok) throw new JimError("server");
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new JimError("server");
  }
  const data = NORMALIZE[kind](body);
  if (!data) throw new JimError("server");
  return data as ExploreData[K];
}

/** Bumped on sign-out, so a read still out then is thrown away. */
let generation = 0;
/** Every mounted useExplore, told to forget on sign-out. */
const forgetters = new Set<() => void>();

/** Sign-out: every Explore page drops what it holds. */
export function clearExplore(): void {
  generation += 1;
  forgetters.forEach((forget) => forget());
}

export interface ExploreState<K extends ExploreKind> {
  status: "idle" | "loading" | "ready" | "error";
  data: ExploreData[K] | null;
  error: JimErrorKind | null;
  reload: () => Promise<void>;
}

/**
 * One Explore page's data, fetched the first time the page is `active` and
 * held in this component's state only.
 */
export function useExplore<K extends ExploreKind>(
  kind: K,
  getToken: GetToken,
  api: string,
  active: boolean,
  fetchFn?: typeof fetch
): ExploreState<K> {
  const [status, setStatus] = useState<ExploreState<K>["status"]>("idle");
  const [data, setData] = useState<ExploreData[K] | null>(null);
  const [error, setError] = useState<JimErrorKind | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const asked = useRef(false);
  const args = useRef({ kind, getToken, api, fetchFn });
  useEffect(() => {
    args.current = { kind, getToken, api, fetchFn };
  });

  useEffect(() => {
    const forget = () => {
      inflight.current = null;
      asked.current = false;
      setData(null);
      setError(null);
      setStatus("idle");
    };
    forgetters.add(forget);
    return () => {
      forgetters.delete(forget);
    };
  }, []);

  const reload = useCallback((): Promise<void> => {
    if (inflight.current) return inflight.current;
    asked.current = true;
    const startedIn = generation;
    setStatus("loading");
    setError(null);
    const run = (async () => {
      try {
        const { kind, getToken, api, fetchFn } = args.current;
        const next = await fetchExplore(kind, getToken, fetchFn, api);
        if (startedIn !== generation) return;
        setData(next as ExploreData[K]);
        setStatus("ready");
      } catch (err) {
        if (startedIn !== generation) return;
        const errKind = err instanceof JimError ? err.kind : "server";
        if (errKind === "denied") setData(null);
        setError(errKind);
        setStatus("error");
      } finally {
        if (startedIn === generation) inflight.current = null;
      }
    })();
    inflight.current = run;
    return run;
  }, []);

  useEffect(() => {
    if (active && !asked.current) void reload();
  }, [active, reload]);

  return { status, data, error, reload };
}
