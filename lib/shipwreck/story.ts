import { titanic } from "./ships/titanic";
import type { ShipId, ShipSpec } from "./ships/types";
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
  /** Before the first event (a torpedo's run-in): "Just before the torpedo". */
  justBefore: string;
  /** "night" / "afternoon": the story's time of day. */
  period: string;
  /** The title screen's first button: "The real night". */
  realLabel: string;
}

export function storyOf(
  ship: Pick<ShipSpec, "cause">,
  /** Torpedo ships: how many hit (a What if may have more than one). */
  hits = 1
): ShipStory {
  if (ship.cause === "storm")
    return {
      cause: "the storm",
      justHit: "Her first report",
      justBefore: "Before her first report",
      period: "storm",
      realLabel: "The real storm",
    };
  const torpedo = hits > 1 ? "the torpedoes" : "the torpedo";
  return ship.cause === "torpedo"
    ? {
        cause: torpedo,
        justHit: `Just hit by ${torpedo}`,
        justBefore: `Just before ${torpedo}`,
        period: "afternoon",
        realLabel: "The real afternoon",
      }
    : {
        cause: "the iceberg",
        justHit: "Just hit the iceberg",
        justBefore: "Just before the iceberg",
        period: "night",
        realLabel: "The real night",
      };
}

/** "Two" for 2 (small counts in words, then digits). */
function countWord(n: number): string {
  const words = ["No", "One", "Two", "Three", "Four", "Five", "Six"];
  return words[n] ?? String(n);
}

/**
 * The caption for a torpedo's run-in before the hit (the pre-roll), or
 * null for a ship without one. `hits`: how many torpedoes (default one).
 */
export function runInCaption(
  ship: Pick<ShipSpec, "cause">,
  hits = 1
): string | null {
  if (ship.cause !== "torpedo") return null;
  return hits > 1
    ? `${countWord(hits)} torpedoes are coming! Their white trails of bubbles streak toward her starboard side.`
    : "A torpedo is coming! Its white trail of bubbles streaks toward her starboard side.";
}

/**
 * "2 h 07 min after the iceberg" (or "Just hit the iceberg"). A storm
 * ship counts from her first report: "2 h 10 min into the storm".
 */
export function sinceText(
  secondsAfter: number,
  ship: Pick<ShipSpec, "cause"> = titanic,
  hits = 1
): string {
  const story = storyOf(ship, hits);
  if (secondsAfter < 0) return story.justBefore;
  const total = Math.max(0, Math.floor(secondsAfter / 60));
  if (total < 1) return story.justHit;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const since =
    ship.cause === "storm" ? `into ${story.cause}` : `after ${story.cause}`;
  if (h === 0) return `${m} min ${since}`;
  return `${h} h ${String(m).padStart(2, "0")} min ${since}`;
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
  /** False when an event of the same kind came before it in the run. */
  first?: boolean;
  /** How many torpedoes hit (torpedo ships; default one). */
  hits?: number;
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
  if (ship.cause === "storm") return stormCaption(e, ship, ctx);
  if (ship.cause === "torpedo") {
    const hits = ctx.hits ?? 1;
    switch (e.kind) {
      case "collision":
        return hits > 1
          ? `${countWord(hits)} torpedoes hit the starboard side. Water rushes in.`
          : "A torpedo hits the starboard side, just behind the bridge. Water rushes in.";
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
      case "hatch-fails":
      case "sheltered":
      case "radio":
        // A storm's events: she had no storm.
        return null;
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
    case "hatch-fails":
    case "sheltered":
    case "radio":
      // A storm's events: she had no storm.
      return null;
    default:
      return null;
  }
}

/**
 * A storm ship's captions (the Fitzgerald's): her first report, her
 * radars, her last message, the first hatch cover, the dive, the wreck, or
 * shelter. Calm, no people, no blame, nothing of the song.
 */
function stormCaption(
  e: Pick<SimEvent, "kind" | "index">,
  ship: ShipSpec,
  ctx: CaptionContext
): string | null {
  const depth = `${ship.seaDepthM.toLocaleString("en-US")} m`;
  switch (e.kind) {
    case "collision":
      return "Her captain radios the Arthur M. Anderson, the ship behind her: a railing is down, two vents are broken, and she is leaning. The storm is building.";
    case "radio":
      if (e.index === 0)
        return "Both of her radars stop working. The Anderson keeps watch and helps her find the way.";
      if (e.index === 1)
        return "Her captain radios the Anderson: \u201cWe are holding our own.\u201d";
      return null;
    case "hatch-fails":
      // Once: the covers go one after another within seconds.
      return ctx.first === false
        ? null
        : "Huge waves sweep over her deck. A hatch cover gives way, and the lake pours into her hold.";
    case "bow-under":
      return "Her bow dips under a giant wave and does not come back up. She dives.";
    case "lights-out":
      return "Her lights go out.";
    case "bow-lands":
      return ctx.sternUnder
        ? `Her bow strikes the bottom of the lake, only ${depth} down.`
        : `Her bow strikes the bottom of the lake, only ${depth} down, while her stern is still at the surface.`;
    case "breakup":
      return "The ship breaks in two.";
    case "stern-under":
      return "Her stern slips under the waves. She has sunk.";
    case "stern-lands":
      return `Her stern turns over as it sinks, and lands upside down on the bottom, ${depth} down.`;
    case "sheltered":
      return "She reaches the shelter of Whitefish Bay, where the waves are smaller. She made it!";
    // Her lights fail as she dives (one caption is enough), the bow says
    // the forecastle, and the rest never happen in a storm: no rockets,
    // boats lowered or explosions, no steam, a welded funnel that stays,
    // and no steady float while the next big wave can always come.
    case "lights-flicker":
    case "forecastle-under":
    case "bridge-under":
    case "explosion":
    case "steam-start":
    case "steam-stop":
    case "rocket":
    case "boat-lowered":
    case "last-boat":
    case "funnel-falls":
    case "floating-steady":
    default:
      return null;
  }
}

/** What the track says about the run at an event's time (for its caption). */
export function captionContext(
  track: SimTrack | null,
  t: number,
  event?: SimEvent
): CaptionContext {
  if (!track) return {};
  const ctx: CaptionContext = {
    sternUnder: track.events.some(
      (e) => e.kind === "stern-under" && e.t <= t + 0.01
    ),
    sunk: track.sankAtT !== null && track.sankAtT <= t + 0.5,
  };
  if (event)
    ctx.first = track.events.find((e) => e.kind === event.kind) === event;
  return ctx;
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
  | "iceberg"
  | "rocket"
  | "boat"
  | "lights"
  | "break"
  | "sinks"
  | "afloat"
  | "hatch"
  | "shelter";

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
  "hatch-fails": ["hatch", "A hatch cover gives way"],
  sheltered: ["shelter", "Whitefish Bay"],
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
  shelter: 3,
  break: 2,
  hatch: 1,
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

/**
 * Ruling R16: no "New ending found!" badge on the Fitzgerald's real run
 * (a 1975 loss with all hands and living families: not a prize). Her
 * What-if endings, and every other ship's, keep the badge.
 */
export const NO_BADGE_REAL_RUN: readonly ShipId[] = ["fitzgerald"];

/** Whether the end card shows "New ending found!" for this run. */
export function showsNewEnding(
  ship: ShipId,
  mode: "real" | "whatif",
  isNew: boolean
): boolean {
  return isNew && !(mode === "real" && NO_BADGE_REAL_RUN.includes(ship));
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
  /** How many torpedoes hit (torpedo ships; default one). */
  hits?: number;
  /** The What-if storm (storm ships; default "real"). */
  storm?: "real" | "calmer" | "worse";
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
  const storm = ship.cause === "storm";
  const torpedoes = (ctx.hits ?? 1) > 1 ? "the torpedoes" : "the torpedo";
  if (outcome === "floated") {
    if (storm) {
      const safe = track.events.find((e) => e.kind === "sheltered");
      const at = clockText(safe?.realT ?? track.endT, ship.clockStartS);
      const sea =
        ctx.storm === "calmer"
          ? "In a calmer storm"
          : ctx.storm === "worse"
            ? "Even in a worse storm"
            : "In the storm";
      return {
        outcome,
        title: `She made it to ${ship.shelter?.name ?? "shelter"}.`,
        lines: [
          `${sea}, she held on and reached the shelter of ${ship.shelter?.name ?? "the bay"} at ${at.replace(" ", "\u00a0")}, where the waves are smaller.`,
          "On the real night the biggest waves came just after 7:10\u00a0PM, and she never reached the bay. Experts still argue about why she sank. What if lets you switch each cause off.",
        ],
      };
    }
    if (torpedo) {
      return {
        outcome,
        title: "She stayed afloat!",
        lines: [
          ctx.portholesOpen === false
            ? `With her portholes shut, the water stayed in the rooms ${torpedoes} opened, and she floated on.`
            : `The water stayed in the rooms ${torpedoes} opened, and she floated on.`,
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
  const hit = storm
    ? `her ${clockText(0, ship.clockStartS).replace(" ", "\u00a0")} report`
    : torpedo
      ? `${torpedoes} hit`
      : "hitting the iceberg";
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
            storm
              ? "The lake there is not as deep as she was long: her bow hit the bottom while her stern was still at the surface."
              : "The sea there is not as deep as she was long: her bow hit the floor while her stern was still up out of the water.",
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
  if (ship.id === "fitzgerald")
    return "What really happened: the real Edmund Fitzgerald sank in the storm just after 7:10\u00a0PM, about 17 miles from the shelter of Whitefish Bay. She very nearly made it. Experts still argue about why she sank.";
  return ship.id === "lusitania"
    ? "What really happened: the real Lusitania sank at 2:28\u00a0PM, just 18 minutes after the torpedo. Boats came out from the Irish coast and picked up the people in the lifeboats."
    : HISTORY_NOTE;
}
