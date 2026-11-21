import type { SimFrame } from "./sim/track";

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

/** The words on the card for `topic`, now (`frame` null before a run). */
export function helpFor(topic: HelpTopic, frame: SimFrame | null): Help {
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
        ],
      };
  }
}
