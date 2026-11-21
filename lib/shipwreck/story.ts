import type { SimEvent } from "./sim/events";
import type { SimTrack } from "./sim/track";
import type { OutcomeId } from "./types";

/**
 * Words and times for the HUD, the captions, the timeline and the end card.
 * Every time comes from the track (`t` / `realT` seconds after the
 * collision); nothing here is a fixed historical clock.
 */

/** The collision, 11:40 PM, as seconds after midnight. */
export const CLOCK_START_S = 23 * 3600 + 40 * 60;

/** "1:47 AM" for seconds after the first event (the collision by default). */
export function clockText(
  secondsAfter: number,
  startS: number = CLOCK_START_S
): string {
  const s = (((startS + Math.floor(secondsAfter)) % 86400) + 86400) % 86400;
  const h24 = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/** "2 h 07 min after the iceberg" (or "Just hit the iceberg"). */
export function sinceText(secondsAfter: number): string {
  const total = Math.max(0, Math.floor(secondsAfter / 60));
  if (total < 1) return "Just hit the iceberg";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min after the iceberg`;
  return `${h} h ${String(m).padStart(2, "0")} min after the iceberg`;
}

/** "2 hours 40 minutes" (whole minutes). */
export function durationWords(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hs = h === 1 ? "1 hour" : `${h} hours`;
  const ms = m === 1 ? "1 minute" : `${m} minutes`;
  if (h === 0) return ms;
  if (m === 0) return hs;
  return `${hs} ${ms}`;
}

/** The calm caption for an event, without the clock (null: no caption). */
export function captionText(
  e: Pick<SimEvent, "kind" | "index">
): string | null {
  switch (e.kind) {
    case "collision":
      return "The iceberg scrapes along the starboard side. Water starts coming in.";
    case "steam-start":
      return "The engines stop. Steam roars out of the funnels.";
    case "steam-stop":
      return "The steam stops. The night goes quiet.";
    case "rocket":
      return e.index === 0 || e.index === undefined
        ? "The first distress rocket goes up, calling for help."
        : null;
    case "boat-lowered":
      return e.index === 0 || e.index === undefined
        ? "The first lifeboat is lowered."
        : null;
    case "last-boat":
      return "The last lifeboat leaves the ship.";
    case "forecastle-under":
      return "The front deck goes under the water.";
    case "bridge-under":
      return "The sea reaches the bridge.";
    case "funnel-falls":
      return e.index === 0 || e.index === undefined
        ? "The front funnel falls."
        : null;
    case "lights-flicker":
      return "The lights flicker.";
    case "lights-out":
      return "The lights go out.";
    case "breakup":
      return "The ship breaks in two.";
    case "bow-under":
      return "The bow slips under the water.";
    case "stern-under":
      return "The stern goes under. She has sunk.";
    case "bow-lands":
      return "The bow ploughs into the sea floor, 3,800 m down.";
    case "stern-lands":
      return "The stern lands on the sea floor.";
    case "floating-steady":
      return "The water stops rising. She is staying afloat!";
    default:
      return null;
  }
}

/** A caption with its clock ("12:45 AM — The first lifeboat is lowered."). */
export function captionFor(e: SimEvent): string | null {
  const text = captionText(e);
  return text ? `${clockText(e.realT)} — ${text}` : null;
}

export type MarkKind =
  "iceberg" | "rocket" | "boat" | "lights" | "break" | "sinks" | "afloat";

export interface TimelineMark {
  kind: MarkKind;
  /** Shown time to jump to. */
  t: number;
  realT: number;
  label: string;
}

const MARK_OF: Partial<Record<SimEvent["kind"], [MarkKind, string]>> = {
  rocket: ["rocket", "First rocket"],
  "boat-lowered": ["boat", "First lifeboat"],
  "lights-out": ["lights", "Lights out"],
  breakup: ["break", "Breaks in two"],
  "stern-under": ["sinks", "Sinks"],
  "floating-steady": ["afloat", "Stays afloat"],
};

/** The timeline's event icons: the first of each kind, in time order. */
export function timelineMarks(track: SimTrack | null): TimelineMark[] {
  if (!track) return [];
  const seen = new Set<MarkKind>();
  const out: TimelineMark[] = [];
  for (const e of track.events) {
    const m = MARK_OF[e.kind];
    if (!m || seen.has(m[0])) continue;
    seen.add(m[0]);
    out.push({
      kind: m[0],
      t: e.t,
      realT: e.realT,
      label: `${m[1]}, ${clockText(e.realT)}`,
    });
  }
  return out;
}

/**
 * Lays marks in rows so their icons do not overlap: `minGap` is the least
 * fraction of the timeline between two icons in a row. Marks with a higher
 * `priority` are placed first (the end of the story wins over the lights
 * going out when they crowd together); then the rest in time order. Returns
 * the row (0 or 1) for each mark, or -1 to fold it into its neighbour.
 */
export function markRows(
  fractions: readonly number[],
  minGap: number,
  priority: readonly number[] = []
): number[] {
  const order = fractions.map((_, i) => i);
  // Stable: equal priorities keep time order.
  order.sort((a, b) => (priority[b] ?? 0) - (priority[a] ?? 0) || a - b);
  const placed: number[][] = [[], []];
  const rows = fractions.map(() => -1);
  for (const i of order) {
    const f = fractions[i];
    for (let r = 0; r < 2; r += 1) {
      if (placed[r].every((g) => Math.abs(f - g) >= minGap)) {
        placed[r].push(f);
        rows[i] = r;
        break;
      }
    }
  }
  return rows;
}

/** Which icons win a crowded spot: the end of the story first. */
export const MARK_PRIORITY: Record<MarkKind, number> = {
  sinks: 3,
  afloat: 3,
  break: 2,
  iceberg: 1,
  rocket: 1,
  boat: 1,
  lights: 0,
};

/**
 * Where the story ends (shown s), once the run is done: the moment she
 * stopped taking water if she floats (the run then just holds her pose to
 * 6:00 AM), otherwise the last frame (both halves at rest on the floor).
 */
export function storyEndT(
  track: SimTrack | null,
  done: boolean
): number | null {
  if (!track || !done || track.frames.length === 0) return null;
  const last = track.frames[track.frames.length - 1].t;
  if (track.outcome === "floated") {
    const steady = track.events.find((e) => e.kind === "floating-steady");
    return Math.min(last, steady ? steady.t + 20 : last);
  }
  return last;
}

/** The ending to record: sank in one piece, broke in two, or floated. */
export function outcomeOf(track: SimTrack): OutcomeId {
  if (track.outcome === "floated") return "floated";
  return track.brokeAtT !== null ? "broke-in-two" : "sank";
}

export interface EndWords {
  outcome: OutcomeId;
  title: string;
  lines: string[];
}

/** The end card's words. `holes` is how many compartments were opened. */
export function endWords(
  track: SimTrack,
  shipName: string,
  seaDepthM: number,
  holes: number
): EndWords {
  const outcome = outcomeOf(track);
  if (outcome === "floated") {
    return {
      outcome,
      title: "She stayed afloat!",
      lines: [
        `With ${holes} ${holes === 1 ? "hole" : "holes"}, her bulkheads held. The water filled only the rooms that were opened, and she floated on.`,
        "Titanic was built to float with any four of her front compartments full of water. On the real night, six were opened.",
      ],
    };
  }
  const sank = track.events.find((e) => e.kind === "stern-under");
  const at = sank?.realT ?? track.sankAtT ?? track.endT;
  const miles = (seaDepthM / 1609.344).toFixed(1);
  return {
    outcome,
    title: `${shipName} sank at ${clockText(at)}`,
    lines: [
      outcome === "broke-in-two"
        ? `She broke in two and sank ${durationWords(at)} after hitting the iceberg. She lies ${seaDepthM.toLocaleString("en-US")} m (${miles} miles) down.`
        : `She sank ${durationWords(at)} after hitting the iceberg. She lies ${seaDepthM.toLocaleString("en-US")} m (${miles} miles) down.`,
    ],
  };
}

/** The "What really happened" note (history, labelled as such). */
export const HISTORY_NOTE =
  "What really happened: the real Titanic sank at 2:20 AM. The ship Carpathia raced through the night, arrived at 4:10 AM and picked up the people in the lifeboats.";
