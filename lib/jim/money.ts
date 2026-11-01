import { useCallback, useEffect, useRef, useState } from "react";
import { getIdToken } from "@/lib/firebase/client";
import { JIM_API, JimError, type JimErrorKind } from "@/lib/jim/api";
import { callJim } from "@/lib/jim/view";

/**
 * The Money page's data: `POST /api/money` on Jim's server, a summary built
 * at request time (aggregates and ready-to-show strings, never the ledger).
 *
 * Money never rests on the device: this module touches no storage API. The
 * summary lives in React state while the page is open and is dropped on
 * sign-out (`clearMoney`).
 */

export interface MoneyTile {
  label: string;
  value: string;
  /** "good", "bad" or "". */
  tone: string;
}

/** A category against its typical month. */
export interface MoneyDriver {
  cat: string;
  amount: number;
  typical: number;
  /** amount − typical: over when positive. */
  diff: number;
}

export interface MoneyTransaction {
  date: string;
  payee: string;
  category: string;
  /** Spent, as a positive number. */
  amount: number;
}

export interface MoneyMonth {
  /** YYYY-MM. */
  m: string;
  /** "Oct", or "Oct 25" outside this year. */
  label: string;
  /** Still in progress. */
  partial: boolean;
  net: number;
  cameIn: number;
  spent: number;
  /** Spent per group (the keys of `groups`). */
  byGroup: Record<string, number>;
  over: MoneyDriver[];
  under: MoneyDriver[];
  /** The largest transactions. */
  top: MoneyTransaction[];
  /** The month's notes (Markdown), or "". */
  note: string;
  /** A short warning, or "". */
  flag: string;
}

export interface MoneyCash {
  /** A statement date, YYYY-MM-DD. */
  date: string;
  amount: number;
}

export interface CheckinPlanRow {
  cat: string;
  target: number;
  actual: number;
  why: string;
}

export interface CheckinComing {
  /** YYYY-MM-DD or YYYY-MM. */
  when: string;
  label: string;
  what: string;
  amount: number | null;
}

export interface CheckinLog {
  date: string;
  kind: string;
  text: string;
}

export interface MoneyCheckin {
  /** The month the plan is measured against, YYYY-MM. */
  month: string;
  plan: CheckinPlanRow[];
  coming: CheckinComing[];
  /** The latest entries, newest first. */
  log: CheckinLog[];
  /** The next check-in's date, or "". */
  next: string;
}

export interface MoneySummary {
  /** What "on track" means, worded. */
  rule: string;
  /** The full months covered, worded. */
  range: string;
  tiles: MoneyTile[];
  /** Spending groups, in display order. */
  groups: string[];
  /** Oldest first. */
  months: MoneyMonth[];
  typicalSpend: number;
  typicalIn: number;
  cash: MoneyCash[];
  /** The Watch list (Markdown), or "". */
  watch: string;
  checkin: MoneyCheckin | null;
  /** The server couldn't sync, so this may be behind. */
  stale?: boolean;
}

/** The summary reads the whole ledger: a cold start plus a sync fits. */
export const MONEY_TIMEOUT_MS = 30_000;

type GetToken = (force?: boolean) => Promise<string | null>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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

function has(
  r: Record<string, unknown>,
  text: string[],
  numbers: string[] = []
): boolean {
  return (
    text.every((k) => isString(r[k])) && numbers.every((k) => isNumber(r[k]))
  );
}

function toTile(v: unknown): MoneyTile | null {
  return isRecord(v) && has(v, ["label", "value", "tone"])
    ? {
        label: v.label as string,
        value: v.value as string,
        tone: v.tone as string,
      }
    : null;
}

function toDriver(v: unknown): MoneyDriver | null {
  return isRecord(v) && has(v, ["cat"], ["amount", "typical", "diff"])
    ? {
        cat: v.cat as string,
        amount: v.amount as number,
        typical: v.typical as number,
        diff: v.diff as number,
      }
    : null;
}

function toTransaction(v: unknown): MoneyTransaction | null {
  return isRecord(v) && has(v, ["date", "payee", "category"], ["amount"])
    ? {
        date: v.date as string,
        payee: v.payee as string,
        category: v.category as string,
        amount: v.amount as number,
      }
    : null;
}

function toMonth(v: unknown): MoneyMonth | null {
  if (
    !isRecord(v) ||
    !has(v, ["m", "label", "note", "flag"], ["net", "cameIn", "spent"]) ||
    typeof v.partial !== "boolean"
  ) {
    return null;
  }
  const byGroup: Record<string, number> = {};
  if (isRecord(v.byGroup)) {
    for (const [group, amount] of Object.entries(v.byGroup)) {
      if (isNumber(amount)) byGroup[group] = amount;
    }
  }
  return {
    m: v.m as string,
    label: v.label as string,
    partial: v.partial,
    net: v.net as number,
    cameIn: v.cameIn as number,
    spent: v.spent as number,
    byGroup,
    over: keep(v.over, toDriver),
    under: keep(v.under, toDriver),
    top: keep(v.top, toTransaction),
    note: v.note as string,
    flag: v.flag as string,
  };
}

function toCash(v: unknown): MoneyCash | null {
  return isRecord(v) && has(v, ["date"], ["amount"])
    ? { date: v.date as string, amount: v.amount as number }
    : null;
}

function toPlanRow(v: unknown): CheckinPlanRow | null {
  return isRecord(v) && has(v, ["cat", "why"], ["target", "actual"])
    ? {
        cat: v.cat as string,
        target: v.target as number,
        actual: v.actual as number,
        why: v.why as string,
      }
    : null;
}

function toComing(v: unknown): CheckinComing | null {
  return isRecord(v) && has(v, ["when", "label", "what"])
    ? {
        when: v.when as string,
        label: v.label as string,
        what: v.what as string,
        amount: isNumber(v.amount) ? v.amount : null,
      }
    : null;
}

function toLog(v: unknown): CheckinLog | null {
  return isRecord(v) && has(v, ["date", "kind", "text"])
    ? { date: v.date as string, kind: v.kind as string, text: v.text as string }
    : null;
}

function toCheckin(v: unknown): MoneyCheckin | null {
  if (!isRecord(v) || !isString(v.month)) return null;
  return {
    month: v.month,
    plan: keep(v.plan, toPlanRow),
    coming: keep(v.coming, toComing),
    log: keep(v.log, toLog),
    next: isString(v.next) ? v.next : "",
  };
}

/**
 * The summary with every list present and malformed rows dropped, or null
 * when it isn't a summary at all (no month list). Never throws.
 */
export function normalizeMoney(raw: unknown): MoneySummary | null {
  if (!isRecord(raw) || !Array.isArray(raw.months)) return null;
  const text = (k: string) => (isString(raw[k]) ? (raw[k] as string) : "");
  const num = (k: string) => (isNumber(raw[k]) ? (raw[k] as number) : 0);
  const out: MoneySummary = {
    rule: text("rule"),
    range: text("range"),
    tiles: keep(raw.tiles, toTile),
    groups: keep(raw.groups, (g) => (isString(g) ? g : null)),
    months: keep(raw.months, toMonth),
    typicalSpend: num("typicalSpend"),
    typicalIn: num("typicalIn"),
    cash: keep(raw.cash, toCash),
    watch: text("watch"),
    checkin: toCheckin(raw.checkin),
  };
  if (raw.stale === true) out.stale = true;
  return out;
}

/**
 * The money summary, or null when there's no ledger (404). Throws JimError:
 * waking (a 503, offline, the time limit), denied, or server.
 */
export async function fetchMoney(
  getToken: GetToken = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API,
  timeoutMs: number = MONEY_TIMEOUT_MS
): Promise<MoneySummary | null> {
  const res = await callJim(
    "/api/money",
    { method: "POST", body: {} },
    getToken,
    fetchFn,
    api,
    timeoutMs
  );
  if (res.status === 404) return null;
  if (res.status === 503) throw new JimError("waking");
  if (!res.ok) throw new JimError("server");
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new JimError("server");
  }
  const data = normalizeMoney(body);
  if (!data) throw new JimError("server");
  return data;
}

/** Bumped on sign-out, so a fetch still out then is thrown away. */
let generation = 0;
/** Every mounted useMoney, told to forget on sign-out. */
const forgetters = new Set<() => void>();

/** Sign-out: every summary held is dropped, and any fetch out is ignored. */
export function clearMoney(): void {
  generation += 1;
  forgetters.forEach((forget) => forget());
}

export interface MoneyState {
  /** idle: nothing asked yet (or signed out); ready: data is final. */
  status: "idle" | "loading" | "ready" | "error";
  /** The summary, or null (not loaded, or no ledger when ready). */
  data: MoneySummary | null;
  error: JimErrorKind | null;
  /** Loads again (the Refresh button, Try again). */
  reload: () => Promise<void>;
}

/**
 * The Money page's summary, fetched the first time the page is `active` and
 * held in this component's state only. `reload` fetches again.
 */
export function useMoney(
  getToken: GetToken,
  api: string,
  active: boolean,
  fetchFn?: typeof fetch
): MoneyState {
  const [status, setStatus] = useState<MoneyState["status"]>("idle");
  const [data, setData] = useState<MoneySummary | null>(null);
  const [error, setError] = useState<JimErrorKind | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const asked = useRef(false);
  /** The latest arguments, so `reload` stays one function. */
  const args = useRef({ getToken, api, fetchFn });
  useEffect(() => {
    args.current = { getToken, api, fetchFn };
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
        const { getToken, api, fetchFn } = args.current;
        const next = await fetchMoney(getToken, fetchFn, api);
        if (startedIn !== generation) return;
        setData(next);
        setStatus("ready");
      } catch (err) {
        if (startedIn !== generation) return;
        setError(err instanceof JimError ? err.kind : "server");
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
