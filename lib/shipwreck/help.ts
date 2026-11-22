import { PLACES_BY_SHIP } from "./places";
import { titanic } from "./ships/titanic";
import type { ShipSpec } from "./ships/types";
import type { SimFrame } from "./sim/track";
import { walkMapFor } from "./walk";

/** The controls card's walk line (a ship you can walk on only). */
function walkLines(ship: ShipSpec): string[] {
  return walkMapFor(ship.id)
    ? [
        "The walking button puts you on her deck: the stick walks, drag to look. If she sinks under you, you float; the eye button looks under the water, and the bird button goes back to flying.",
      ]
    : [];
}

/** What a help card says. Short words: the players are young. */
export interface Help {
  title: string;
  /** One line on how things are right now (optional). */
  now?: string;
  lines: string[];
}

export type HelpTopic = "controls" | "water" | "bow" | "lean" | "power";

/** "12,400 t of water". */
export function waterText(f: Pick<SimFrame, "waterAboardT">): string {
  const t = Math.max(0, Math.round(f.waterAboardT / 100) * 100);
  return `${t.toLocaleString("en-US")} t of water`;
}

/** "4.2°" bow down (0 when she is level or stern down). */
export function bowDownText(
  f: Pick<SimFrame, "trimDeg"> & Partial<Pick<SimFrame, "bodies">>
): string {
  // After the break the frame's trim is the stern's: the chip says "bow",
  // so read the bow half's own pitch.
  const bow = f.bodies?.find((b) => b.part === "bow");
  const deg = bow ? (bow.pitch * 180) / Math.PI : f.trimDeg;
  return `${Math.max(0, deg).toFixed(1)}°`;
}

/** "1.1° to port" (listDeg + is to starboard). */
export function leanText(f: Pick<SimFrame, "listDeg">): string {
  const a = Math.abs(f.listDeg);
  if (a < 0.05) return "Upright";
  return `${a.toFixed(1)}° to ${f.listDeg < 0 ? "port" : "starboard"}`;
}

export function powerText(f: Pick<SimFrame, "power">): string {
  if (f.power >= 0.999) return "Lights on";
  if (f.power <= 0.001) return "Lights out";
  return "Lights flickering";
}

/** "the Bridge, the Grand Staircase, Boiler Room 6 and the Engine Room". */
function placeList(ship: ShipSpec): string {
  // "Boiler Room 1" is a name: no "the".
  const names = PLACES_BY_SHIP[ship.id].map((p) =>
    /\d$/.test(p.label) ? p.label : `the ${p.label}`
  );
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The torpedo ship's cards (the Titanic's are below, as in 1.0). */
function torpedoHelp(
  topic: HelpTopic,
  frame: SimFrame | null,
  ship: ShipSpec
): Help {
  switch (topic) {
    case "water":
      return {
        title: "Water aboard",
        now: frame ? waterText(frame) : undefined,
        lines: [
          "How much sea water has come inside the ship, in tonnes. One tonne is about a bathtub and a half.",
          `${ship.name} weighed about ${(Math.round(ship.displacementT / 1000) * 1000).toLocaleString("en-US")} t. The more water comes in, the lower she sits.`,
        ],
      };
    case "bow":
      return {
        title: "Bow down",
        now: frame ? bowDownText(frame) : undefined,
        lines: [
          "How far the front of the ship tips down.",
          `The sea here is only ${ship.seaDepthM} m deep, less than her length: her bow can reach the sea floor while her stern is still up.`,
        ],
      };
    case "lean":
      return {
        title: "Lean",
        now: frame ? leanText(frame) : undefined,
        lines: [
          "How far the ship leans to one side. Port is the left side looking forward, starboard the right.",
          "Long coal bunkers ran down both her sides. When the sea filled the ones on the starboard side, she leaned over a long way, fast.",
        ],
      };
    case "power":
      return {
        title: "Power",
        now: frame ? powerText(frame) : undefined,
        lines: [
          "The boilers made the steam that turned the engines and the dynamos that made the electricity.",
          "On the real afternoon the steam failed a few minutes after the torpedo, and the lights went out.",
        ],
      };
    case "controls":
    default:
      return {
        title: "How to watch",
        lines: [
          "Drag to look around the ship. Pinch to zoom in and out. Two fingers move the view. Double-tap the ship to fly close.",
          "Play and pause, and choose how fast the afternoon goes: ×1 is real time.",
          "Drag the timeline, or tap an icon on it, to jump to that moment.",
          `X-ray shows the water inside. The pins fly you to ${placeList(ship)}.`,
          "The camera button picks a view: the bridge, the stern, a lifeboat, under the water, or the movie camera.",
          ...walkLines(ship),
        ],
      };
  }
}

/** The words on the card for `topic`, now (`frame` null before a run). */
export function helpFor(
  topic: HelpTopic,
  frame: SimFrame | null,
  ship: ShipSpec = titanic
): Help {
  if (ship.cause === "torpedo") return torpedoHelp(topic, frame, ship);
  switch (topic) {
    case "water":
      return {
        title: "Water aboard",
        now: frame ? waterText(frame) : undefined,
        lines: [
          "How much sea water has come inside the ship, in tonnes. One tonne is about a bathtub and a half.",
          "Titanic weighed about 49,000 t. The more water comes in, the lower she sits.",
        ],
      };
    case "bow":
      return {
        title: "Bow down",
        now: frame ? bowDownText(frame) : undefined,
        lines: [
          "How far the front of the ship tips down.",
          "The real Titanic broke apart at about 15°.",
        ],
      };
    case "lean":
      return {
        title: "Lean",
        now: frame ? leanText(frame) : undefined,
        lines: [
          "How far the ship leans to one side. Port is the left side looking forward, starboard the right.",
          "Water lies flat inside her, so she leans only a little.",
        ],
      };
    case "power":
      return {
        title: "Power",
        now: frame ? powerText(frame) : undefined,
        lines: [
          "The engineers kept the dynamos running so the lights stayed on almost to the end.",
          "When the water reached them, or the ship broke, the lights went out.",
        ],
      };
    case "controls":
    default:
      return {
        title: "How to watch",
        lines: [
          "Drag to look around the ship. Pinch to zoom in and out. Two fingers move the view. Double-tap the ship to fly close.",
          "Play and pause, and choose how fast the night goes: ×1 is real time.",
          "Drag the timeline, or tap an icon on it, to jump to that moment.",
          "X-ray shows the water inside. The pins fly you to the Bridge, the Grand Staircase, Boiler Room 6 and the Engine Room.",
          "The camera button picks a view: the bridge, the stern, a lifeboat, under the water, or the movie camera.",
          ...walkLines(ship),
        ],
      };
  }
}
