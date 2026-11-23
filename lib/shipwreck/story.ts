import { titanic } from "./ships/titanic";
import type { Opening, ShipId, ShipSpec } from "./ships/types";
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
  /** "the iceberg" / "the torpedo" / "the mine". */
  cause: string;
  /** "Just hit the iceberg" / "Just hit by the torpedo". */
  justHit: string;
  /** Before the first event (a torpedo's run-in): "Just before the torpedo". */
  justBefore: string;
  /** "night" / "afternoon" / "morning": the story's time of day. */
  period: string;
  /** The title screen's first button: "The real night". */
  realLabel: string;
}

/** A ship as the story's words need it: what sank her, and which she is. */
type StoryShip = Pick<ShipSpec, "cause"> & Partial<Pick<ShipSpec, "id">>;

export function storyOf(
  ship: StoryShip,
  /** Torpedo and mine ships: how many hit (a What if may have more than one). */
  hits = 1
): ShipStory {
  if (ship.id === "carpathia") {
    // Her clock counts from the first torpedo (more may come later).
    const torpedo = hits > 1 ? "the first torpedo" : "the torpedo";
    return {
      cause: torpedo,
      justHit: hits > 1 ? "Just hit by a torpedo" : "Just hit by the torpedo",
      justBefore: "Just before the torpedo",
      period: "morning",
      realLabel: "The real morning",
    };
  }
  if (ship.cause === "mine") {
    const mine = hits > 1 ? "the mines" : "the mine";
    return {
      cause: mine,
      justHit: `Just hit by ${mine}`,
      justBefore: `Just before ${mine}`,
      period: "morning",
      realLabel: "The real morning",
    };
  }
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
  ship: Pick<ShipSpec, "cause"> & Partial<Pick<ShipSpec, "torpedo">>,
  hits = 1
): string | null {
  if (ship.cause !== "torpedo") return null;
  const side = ship.torpedo?.side ?? "starboard";
  return hits > 1
    ? `${countWord(hits)} torpedoes are coming! Their white trails of bubbles streak toward her ${side} side.`
    : `A torpedo is coming! Its white trail of bubbles streaks toward her ${side} side.`;
}

/**
 * Shown seconds of a run's first torpedo hit: its earliest hole (0 for a
 * run with none, or a hit at the first event). The Carpathia's What if
 * with only the U-boat's return is hit at 10:50 AM, 95 minutes in.
 */
export function firstHitS(openings: readonly Pick<Opening, "t">[]): number {
  if (openings.length === 0) return 0;
  return Math.max(0, Math.min(...openings.map((o) => o.t ?? 0)));
}

/** "1 h 05 min" or "12 min" for whole minutes. */
function hm(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, "0")} min`;
}

/**
 * "2 h 07 min after the iceberg" (or "Just hit the iceberg"). A storm
 * ship counts from her first report: "2 h 10 min into the storm".
 */
export function sinceText(
  secondsAfter: number,
  ship: StoryShip = titanic,
  hits = 1,
  /** Shown seconds of the first hit (`firstHitS`): a later first torpedo
   *  counts down to it ("20 min before the torpedo"), then from it. */
  firstHit = 0
): string {
  const story = storyOf(ship, hits);
  const s = secondsAfter - firstHit;
  if (s < 0) {
    const left = Math.ceil(-s / 60);
    return firstHit > 0 && left > 1
      ? `${hm(left)} before ${story.cause}`
      : story.justBefore;
  }
  const total = Math.max(0, Math.floor(s / 60));
  if (total < 1) return story.justHit;
  const since =
    ship.cause === "storm" ? `into ${story.cause}` : `after ${story.cause}`;
  return `${hm(total)} ${since}`;
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
  /** The run's holes (`PlaybackState.openings`): where and when each
   *  torpedo strikes (the Carpathia's words). */
  openings?: readonly Opening[];
}

/** The calm caption for an event, without the clock (null: no caption). */
export function captionText(
  e: Pick<SimEvent, "kind" | "index"> & Partial<Pick<SimEvent, "t">>,
  ship: ShipSpec = titanic,
  ctx: CaptionContext = {}
): string | null {
  const first = e.index === 0 || e.index === undefined;
  const depth = `${ship.seaDepthM.toLocaleString("en-US")} m`;
  // The sea is shallower than she is long: her ends touch the floor while
  // the rest of her is still up.
  const shallow = ship.seaDepthM < ship.lbp;
  if (ship.cause === "storm") return stormCaption(e, ship, ctx);
  if (ship.id === "carpathia") return carpathiaCaption(e, ship, ctx);
  if (ship.cause === "mine") return mineCaption(e, ship, ctx);
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
      case "torpedo-hit":
        // A ship with her own hits only (`spec.torpedo`): the Lusitania's
        // torpedoes all land in the collision caption.
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
    case "torpedo-hit":
      // No torpedoes on an iceberg night.
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
    // and no steady float while the next big wave can always come; no
    // torpedoes in a storm.
    case "torpedo-hit":
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

const ORDINAL = [
  "",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
];

/**
 * Where a hit strikes her, in a few words, from the spaces its holes open:
 * "by her boiler room", "into her engine room", "by hold 5".
 */
function hitWhere(ship: ShipSpec, ids: readonly string[]): string {
  const comps = ship.compartments.filter((c) => ids.includes(c.id));
  if (comps.some((c) => c.kind === "boiler")) return "by her boiler room";
  if (comps.some((c) => c.kind === "engine")) return "into her engine room";
  const c = comps[0];
  if (!c) return "";
  if (c.kind === "peak") return "right at her bow";
  if (c.kind === "stern") return "right at her stern";
  const n = /(\d+)/.exec(c.label)?.[1];
  return n ? `by hold ${n}` : `by her ${c.label.toLowerCase()}`;
}

/**
 * The Carpathia's captions (17 July 1918): torpedoes into her port side,
 * rockets to call the patrol ships, her boats away and her convoy gone, a
 * long wait while she settles slowly, the U-boat's return at 10:50 AM and
 * her end, bow first, upright on the floor. No people, no wireless (R14:
 * the hit wrecked it). A What if whose first torpedo comes late (the
 * U-boat's return alone) has no hit at 9:15 AM, and her historical events
 * before that hit go uncaptioned: nothing has happened to her yet.
 */
function carpathiaCaption(
  e: Pick<SimEvent, "kind" | "index"> & Partial<Pick<SimEvent, "t">>,
  ship: ShipSpec,
  ctx: CaptionContext
): string | null {
  const first = e.index === 0 || e.index === undefined;
  const depth = `${ship.seaDepthM.toLocaleString("en-US")} m`;
  const side = ship.torpedo?.side ?? "port";
  const openings = ctx.openings;
  // No hole at the first event: her first torpedo comes later.
  const lateHit = openings !== undefined && firstHitS(openings) > 0;
  const before = lateHit && (e.t ?? 0) < firstHitS(openings);
  const at = (t: number) =>
    (openings ?? [])
      .filter((o) => (o.t ?? 0) === t)
      .map((o) => o.compartmentId);
  const where = (t: number) => {
    const w = hitWhere(ship, at(t));
    return w ? `, ${w}` : "";
  };
  switch (e.kind) {
    case "collision":
      return lateHit
        ? "A calm summer morning at sea. She steams along with her convoy."
        : `A torpedo hits her ${side} side${where(0)}. Water rushes in.`;
    case "torpedo-hit": {
      const n = e.index ?? 2;
      const fin = ship.torpedo?.finisher;
      const finisher =
        fin !== undefined && e.t !== undefined && Math.abs(e.t - fin.t) < 1;
      const w = e.t !== undefined ? where(e.t) : "";
      if (n <= 1)
        // The only hit of the run (the U-boat's return alone): index 1.
        return `A torpedo hits her ${side} side${w}. Water rushes in.`;
      if (finisher)
        return `The U-boat comes back. Its last torpedo hits her ${side} side${w}.`;
      return `A ${ORDINAL[n] ?? "another"} torpedo hits her ${side} side${w}.`;
    }
    case "steam-start":
      return before ? null : "Steam roars out of her funnel.";
    case "steam-stop":
      return before
        ? null
        : "The steam stops. Her convoy steams away fast, as ships in a convoy must.";
    case "rocket":
      return first && !before
        ? "A rocket goes up, calling the patrol ships for help."
        : null;
    case "boat-lowered":
      return first && !before ? "The first lifeboat is lowered." : null;
    case "last-boat":
      // The long quiet middle: tell a player at ×1 what is happening.
      return before
        ? null
        : "The last lifeboat pulls clear. Her boats wait nearby while she settles slowly, down at the front.";
    case "explosion":
      // Her torpedoes' own captions say it.
      return null;
    case "forecastle-under":
      return "Her front deck goes under the water.";
    case "bridge-under":
      return "The sea reaches the bridge.";
    case "funnel-falls":
      return first ? "Her tall funnel falls." : null;
    case "lights-flicker":
      // Her lights went out with the engine room: one caption is enough.
      return null;
    case "lights-out":
      return "Her engines stop, and the lights go out.";
    case "breakup":
      return "The ship breaks in two.";
    case "bow-under":
      return "Her bow slips under the water. She is going down bow first.";
    case "stern-under":
      return "Her stern goes under. She has sunk.";
    case "bow-lands":
      return ctx.sternUnder
        ? `Her bow ploughs into the sea floor, only ${depth} down.`
        : `Her bow ploughs into the sea floor, only ${depth} down. Her stern is still up out of the water!`;
    case "stern-lands":
      return ctx.sunk
        ? `She has sunk. She rests upright on the sea floor, ${depth} down.`
        : `Her stern touches the sea floor, only ${depth} down.`;
    case "floating-steady":
      return "The water stops rising. She is staying afloat!";
    case "hatch-fails":
    case "sheltered":
    case "radio":
      // A storm's events, and her wireless was wrecked (R14).
      return null;
    default:
      return null;
  }
}

/**
 * A mine ship's captions (the Britannic's morning): the mine, the boats
 * from her davits, the sea creeping up her front, the whistle at 9:00, the
 * roll onto her side, the floor. Calm, no people, no blame, and nothing of
 * the boats drawn into her propellers (R15: the parent line only).
 */
function mineCaption(
  e: Pick<SimEvent, "kind" | "index">,
  ship: ShipSpec,
  ctx: CaptionContext
): string | null {
  const depth = `${ship.seaDepthM.toLocaleString("en-US")} m`;
  const shallow = ship.seaDepthM < ship.lbp;
  // The first of its kind in the run (the track's order: her boats are
  // lowered aft first, not by number).
  const first = ctx.first ?? (e.index === 0 || e.index === undefined);
  const hits = ctx.hits ?? 1;
  switch (e.kind) {
    case "collision":
      return hits > 1
        ? `${countWord(hits)} mines explode against her starboard side. Water rushes in.`
        : "A mine explodes against her starboard side, near the front. Water rushes in.";
    case "boat-lowered":
      return first
        ? "The first lifeboat is lowered from her giant crane-like davits."
        : null;
    case "last-boat":
      return "The last lifeboat pulls clear of the ship.";
    case "forecastle-under":
      return "The front deck goes under the water.";
    case "bridge-under":
      return "The sea reaches the bridge.";
    case "radio":
      // Her whistle at 9:00 AM (the ship's signal, index 0).
      return e.index === 0
        ? "Her engines stop. Two long blasts on her whistle."
        : null;
    case "funnel-falls":
      return first ? "She leans over, and her funnels begin to fall." : null;
    case "lights-out":
      return "The power fails. The lights go out.";
    case "breakup":
      return "The ship breaks in two.";
    case "stern-under":
      return "The stern goes under. She has sunk.";
    case "bow-lands":
      if (!shallow) return `The bow ploughs into the sea floor, ${depth} down.`;
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
    case "sheltered":
      return "She reaches the shore of Kea. She made it!";
    // The mine is her collision (the scripted blast at the same moment is
    // for the sound and the scene); she had no rockets, no steam venting
    // and no hatch covers; her lights flicker just before they go out (one
    // caption is enough); her front deck and bridge going under say the bow.
    case "explosion":
    case "steam-start":
    case "steam-stop":
    case "rocket":
    case "lights-flicker":
    case "bow-under":
    case "hatch-fails":
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
  | "shelter"
  | "torpedo";

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
  "torpedo-hit": ["torpedo", "Torpedo"],
};

/**
 * A torpedo this long after the first event earns its own mark (the
 * Carpathia's 10:50 AM torpedo, after the long wait); hits seconds apart
 * at the start sit on the start of the bar.
 */
export const LATE_HIT_MARK_S = 600;

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
    if (e.kind === "torpedo-hit" && e.t < LATE_HIT_MARK_S) continue;
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
  torpedo: 2,
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
  /** Shown seconds of the first hit (`firstHitS`; default 0). */
  firstHitS?: number;
  /** Mine ships: every watertight door shut (default false). */
  doorsClosed?: boolean;
  /** Mine ships: her engines stopped at the mine, no run for the shore. */
  enginesStopped?: boolean;
  /** Mine ships: the mine at her real spot and nowhere else (default false). */
  realSpot?: boolean;
}

/**
 * Mine ships: how long after the mine she really sank (s), for the Run
 * for Kea lesson: the Britannic 55 minutes [WP] (her sim's 54:01).
 */
const REAL_SANK_S: Partial<Record<ShipId, number>> = { britannic: 55 * 60 };
/** How close to it a run with only her engines stopped counts as "little". */
const LITTLE_S = 120;

/**
 * Run for Kea off and nothing else changed from her real morning, and she
 * sank within LITTLE_S of the real time (R20b: her way was mostly off by
 * 8:18, so stopping her engines changes her end by seconds): the card names
 * what mattered (Task 2b).
 */
const ENGINES_LESSON =
  "Stopping her engines changed little. Her open portholes and the door that did not shut mattered most.";
function enginesLesson(ship: ShipSpec, at: number, ctx: EndContext): string[] {
  const real = REAL_SANK_S[ship.id];
  const onlyEngines =
    ship.cause === "mine" &&
    ctx.enginesStopped === true &&
    ctx.realSpot === true &&
    (ctx.hits ?? 1) === 1 &&
    ctx.portholesOpen !== false &&
    ctx.doorsClosed !== true;
  return onlyEngines && real !== undefined && Math.abs(at - real) <= LITTLE_S
    ? [ENGINES_LESSON]
    : [];
}

/** The end card's name for a ship, where it differs (R1: "HMHS Britannic"). */
const END_NAME: Partial<Record<ShipId, string>> = {
  britannic: "HMHS Britannic",
};

/** "her portholes shut, her doors closed and her engines stopped". */
function andList(parts: readonly string[]): string {
  if (parts.length < 2) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** A mine ship's floating end (the Britannic's What if). */
function mineAfloat(
  track: SimTrack,
  ship: ShipSpec,
  ctx: EndContext
): EndWords {
  const mines = (ctx.hits ?? 1) > 1 ? "the mines" : "the mine";
  const safe = track.events.find((e) => e.kind === "sheltered");
  const fixes = [
    ...(ctx.portholesOpen === false ? ["her portholes shut"] : []),
    ...(ctx.doorsClosed ? ["her doors closed"] : []),
    ...(ctx.enginesStopped ? ["her engines stopped"] : []),
  ];
  const held =
    fixes.length > 0
      ? `With ${andList(fixes)}, the water stayed in the rooms ${mines} opened, and she floated on.`
      : `The water stayed in the rooms ${mines} opened, and she floated on.`;
  const lesson =
    "She was built to float with six of her front compartments full of water. On the real morning, open portholes and a watertight door that did not shut let the sea into more of her.";
  if (safe) {
    const at = clockText(safe.realT, ship.clockStartS).replace(" ", "\u00a0");
    return {
      outcome: "floated",
      title: "She reached Kea.",
      lines: [
        `She reached the shore of the island of Kea at ${at} and was safe there.`,
        lesson,
      ],
    };
  }
  return {
    outcome: "floated",
    title: "She stayed afloat.",
    lines: [held, lesson],
  };
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
  if (outcome === "floated" && ship.cause === "mine")
    return mineAfloat(track, ship, ctx);
  const torpedo = ship.cause === "torpedo";
  const mine = ship.cause === "mine";
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
    if (ship.id === "carpathia")
      return {
        outcome,
        title: "She stayed afloat!",
        lines: [
          `The water stayed in the rooms ${torpedoes} opened, and she floated on.`,
          "On the real morning two torpedoes hit her at 9:15\u00a0AM, and she stayed afloat for an hour and a half, until the U-boat came back at 10:50\u00a0AM with a third.",
        ],
      };
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
  const fromHit = Math.max(0, at - (ctx.firstHitS ?? 0));
  const hit = storm
    ? `her ${clockText(0, ship.clockStartS).replace(" ", "\u00a0")} report`
    : ship.id === "carpathia"
      ? `${storyOf(ship, ctx.hits ?? 1).cause} hit`
      : torpedo
        ? `${torpedoes} hit`
        : mine
          ? (ctx.hits ?? 1) > 1
            ? "the mines"
            : "the mine"
          : "hitting the iceberg";
  const broke = outcome === "broke-in-two" ? "broke in two and sank" : "sank";
  const bowLands = track.events.find((e) => e.kind === "bow-lands");
  const bowFirst =
    bowLands !== undefined && (sank === undefined || bowLands.t < sank.t);
  return {
    outcome,
    title: `${END_NAME[ship.id] ?? ship.name} sank at ${clockText(at, ship.clockStartS)}`,
    lines: [
      `She ${broke} ${durationWords(fromHit)} after ${hit}. She lies ${depthWords(ship.seaDepthM)} down.`,
      ...(bowFirst && ship.seaDepthM < ship.lbp
        ? [
            storm
              ? "The lake there is not as deep as she was long: her bow hit the bottom while her stern was still at the surface."
              : "The sea there is not as deep as she was long: her bow hit the floor while her stern was still up out of the water.",
          ]
        : []),
      ...enginesLesson(ship, at, ctx),
    ],
  };
}

/** The "What really happened" note (history, labelled as such). */
export const HISTORY_NOTE =
  "What really happened: the real Titanic sank at 2:20 AM. The ship Carpathia raced through the night, arrived at 4:10 AM and picked up the people in the lifeboats.";

/** Each ship's "What really happened" note. */
export function historyNote(ship: Pick<ShipSpec, "id">): string {
  if (ship.id === "carpathia")
    return "What really happened: the real Carpathia sank at about 11:00\u00a0AM, ten minutes after the U-boat's third torpedo. At about 1\u00a0PM the warship HMS Snowdrop came and picked up her lifeboats.";
  if (ship.id === "britannic")
    return "What really happened: the real Britannic was steaming up the Kea Channel when the mine went off. She sank at 9:07\u00a0AM, 55 minutes after the mine. British warships came and picked up the people in the lifeboats.";
  if (ship.id === "fitzgerald")
    return "What really happened: the real Edmund Fitzgerald sank in the storm just after 7:10\u00a0PM, about 17 miles from the shelter of Whitefish Bay. She very nearly made it. Experts still argue about why she sank.";
  return ship.id === "lusitania"
    ? "What really happened: the real Lusitania sank at 2:28\u00a0PM, just 18 minutes after the torpedo. Boats came out from the Irish coast and picked up the people in the lifeboats."
    : HISTORY_NOTE;
}
