import { titanic } from "./ships/titanic";
import type { ShipSpec } from "./ships/types";
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

/** Words that differ by what sank her and when. */
export interface ShipStory {
  /** "the iceberg" / "the torpedo". */
  cause: string;
  /** "Just hit the iceberg" / "Just hit by the torpedo". */
  justHit: string;
  /** "night" / "afternoon": the story's time of day. */
  period: string;
  /** The title screen's first button: "The real night". */
  realLabel: string;
}

export function storyOf(ship: Pick<ShipSpec, "cause">): ShipStory {
  return ship.cause === "torpedo"
    ? {
        cause: "the torpedo",
        justHit: "Just hit by the torpedo",
        period: "afternoon",
        realLabel: "The real afternoon",
      }
    : {
        cause: "the iceberg",
        justHit: "Just hit the iceberg",
        period: "night",
        realLabel: "The real night",
      };
}

/** "2 h 07 min after the iceberg" (or "Just hit the iceberg"). */
export function sinceText(
  secondsAfter: number,
  ship: Pick<ShipSpec, "cause"> = titanic
): string {
  const story = storyOf(ship);
  const total = Math.max(0, Math.floor(secondsAfter / 60));
  if (total < 1) return story.justHit;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min after ${story.cause}`;
  return `${h} h ${String(m).padStart(2, "0")} min after ${story.cause}`;
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

/**
 * What a caption may know about the run beyond its own event: whether the
 * stern has gone under by then (`sternUnder`) and whether all of her has
 * (`sunk`). The Titanic's words never need it.
 */
export interface CaptionContext {
  sternUnder?: boolean;
  sunk?: boolean;
}

/** The calm caption for an event, without the clock (null: no caption). */
export function captionText(
  e: Pick<SimEvent, "kind" | "index">,
  ship: ShipSpec = titanic,
  ctx: CaptionContext = {}
): string | null {
  const first = e.index === 0 || e.index === undefined;
  const depth = `${ship.seaDepthM.toLocaleString("en-US")} m`;
  // The sea is shallower than she is long: her ends touch the floor while
  // the rest of her is still up.
  const shallow = ship.seaDepthM < ship.lbp;
  if (ship.cause === "torpedo") {
    switch (e.kind) {
      case "collision":
        return "A torpedo hits the starboard side, just behind the bridge. Water rushes in.";
      case "explosion":
        return "A second, bigger explosion booms from deep inside the ship.";
      case "steam-start":
        return "Steam and smoke pour out of the funnels.";
      case "steam-stop":
        return "The steam stops.";
      case "rocket":
        // She fired none.
        return null;
      case "boat-lowered":
        return first
          ? "The first lifeboat is lowered. She leans so far that it swings out wide from her side."
          : null;
      case "last-boat":
        return "The last lifeboat pulls clear of the ship.";
      case "forecastle-under":
        return "The front deck goes under the water.";
      case "bridge-under":
        return "The sea reaches the bridge.";
      case "funnel-falls":
        return first ? "The front funnel falls." : null;
      case "lights-flicker":
        // Her lights failed early, then went out: one caption is enough.
        return null;
      case "lights-out":
        return "The power fails. The lights go out.";
      case "breakup":
        return "The ship breaks in two.";
      case "bow-under":
        return "The bow slips under the water.";
      case "stern-under":
        return "The stern goes under. She has sunk.";
      case "bow-lands":
        if (!shallow)
          return `The bow ploughs into the sea floor, ${depth} down.`;
        return ctx.sternUnder
          ? `The bow ploughs into the sea floor, only ${depth} down.`
          : `The bow ploughs into the sea floor, only ${depth} down. Her stern is still up out of the water!`;
      case "stern-lands":
        if (!shallow) return "The stern lands on the sea floor.";
        return ctx.sunk
          ? `She has sunk. She lies on the sea floor, ${depth} down.`
          : `The stern touches the sea floor, only ${depth} down.`;
      case "floating-steady":
        return "The water stops rising. She is staying afloat!";
      default:
        return null;
    }
  }
  switch (e.kind) {
    case "collision":
      return "The iceberg scrapes along the starboard side. Water starts coming in.";
    case "steam-start":
      return "The engines stop. Steam roars out of the funnels.";
    case "steam-stop":
      return "The steam stops. The night goes quiet.";
    case "rocket":
      return first
        ? "The first distress rocket goes up, calling for help."
        : null;
    case "boat-lowered":
      return first ? "The first lifeboat is lowered." : null;
    case "last-boat":
      return "The last lifeboat leaves the ship.";
    case "forecastle-under":
      return "The front deck goes under the water.";
    case "bridge-under":
      return "The sea reaches the bridge.";
    case "funnel-falls":
      return first ? "The front funnel falls." : null;
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
      return `The bow ploughs into the sea floor, ${depth} down.`;
    case "stern-lands":
      return "The stern lands on the sea floor.";
    case "floating-steady":
      return "The water stops rising. She is staying afloat!";
    default:
      return null;
  }
}

/** What the track says about the run at an event's time (for its caption). */
export function captionContext(
  track: SimTrack | null,
  t: number
): CaptionContext {
  if (!track) return {};
  return {
    sternUnder: track.events.some(
      (e) => e.kind === "stern-under" && e.t <= t + 0.01
    ),
    sunk: track.sankAtT !== null && track.sankAtT <= t + 0.5,
  };
}

/** A caption with its clock ("12:45 AM — The first lifeboat is lowered."). */
export function captionFor(
  e: SimEvent,
  ship: ShipSpec = titanic,
  ctx: CaptionContext = {}
): string | null {
  const text = captionText(e, ship, ctx);
  return text ? `${clockText(e.realT, ship.clockStartS)} — ${text}` : null;
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
export function timelineMarks(
  track: SimTrack | null,
  ship: Pick<ShipSpec, "clockStartS"> = titanic
): TimelineMark[] {
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
      label: `${m[1]}, ${clockText(e.realT, ship.clockStartS)}`,
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

/** Optional facts about the run for the end card. */
export interface EndContext {
  /** Whether her portholes were open (torpedo ships; default true). */
  portholesOpen?: boolean;
}

/** "93 m (305 feet)" for a shallow sea, "3,800 m (2.4 miles)" for a deep one. */
function depthWords(seaDepthM: number): string {
  const m = seaDepthM.toLocaleString("en-US");
  if (seaDepthM >= 1609.344) {
    return `${m} m (${(seaDepthM / 1609.344).toFixed(1)} miles)`;
  }
  // No break inside "93 m" or "305 feet".
  return `${m}\u00a0m (${Math.round(seaDepthM / 0.3048).toLocaleString("en-US")}\u00a0feet)`;
}

/** The end card's words. `holes` is how many compartments were opened. */
export function endWords(
  track: SimTrack,
  ship: ShipSpec,
  holes: number,
  ctx: EndContext = {}
): EndWords {
  const outcome = outcomeOf(track);
  const torpedo = ship.cause === "torpedo";
  if (outcome === "floated") {
    if (torpedo) {
      return {
        outcome,
        title: "She stayed afloat!",
        lines: [
          ctx.portholesOpen === false
            ? "With her portholes shut, the water stayed in the rooms the torpedo opened, and she floated on."
            : "The water stayed in the rooms the torpedo opened, and she floated on.",
          `On the real afternoon the torpedo hit beside her front boiler room. Water in her starboard coal bunkers made her lean over, and the sea poured in through open portholes.`,
        ],
      };
    }
    return {
      outcome,
      title: "She stayed afloat!",
      lines: [
        `With ${holes} ${holes === 1 ? "hole" : "holes"}, her bulkheads held. The water filled only the rooms that were opened, and she floated on.`,
        `${ship.name} was built to float with any four of her front compartments full of water. On the real night, six were opened.`,
      ],
    };
  }
  const sank = track.events.find((e) => e.kind === "stern-under");
  const at = sank?.realT ?? track.sankAtT ?? track.endT;
  const hit = torpedo ? "the torpedo hit" : "hitting the iceberg";
  const broke = outcome === "broke-in-two" ? "broke in two and sank" : "sank";
  const bowLands = track.events.find((e) => e.kind === "bow-lands");
  const bowFirst =
    bowLands !== undefined && (sank === undefined || bowLands.t < sank.t);
  return {
    outcome,
    title: `${ship.name} sank at ${clockText(at, ship.clockStartS)}`,
    lines: [
      `She ${broke} ${durationWords(at)} after ${hit}. She lies ${depthWords(ship.seaDepthM)} down.`,
      ...(bowFirst && ship.seaDepthM < ship.lbp
        ? [
            "The sea there is not as deep as she was long: her bow hit the floor while her stern was still up out of the water.",
          ]
        : []),
    ],
  };
}

/** The "What really happened" note (history, labelled as such). */
export const HISTORY_NOTE =
  "What really happened: the real Titanic sank at 2:20 AM. The ship Carpathia raced through the night, arrived at 4:10 AM and picked up the people in the lifeboats.";

/** Each ship's "What really happened" note. */
export function historyNote(ship: Pick<ShipSpec, "id">): string {
  return ship.id === "lusitania"
    ? "What really happened: the real Lusitania sank at 2:28\u00a0PM, just 18 minutes after the torpedo. Boats came out from the Irish coast and picked up the people in the lifeboats."
    : HISTORY_NOTE;
}
