import { PLACES_BY_SHIP } from "./places";
import { titanic } from "./ships/titanic";
import { resolveLivery, storyIdOf, type ShipSpec } from "./ships/types";
import type { SimFrame } from "./sim/track";
import type { WaveVariant } from "./sim/wave";
import { leanFromUpright } from "./story";
import { walkMapFor } from "./walk";

/** The controls card's walk line (a ship you can walk on only). */
function walkLines(ship: ShipSpec): string[] {
  return walkMapFor(ship.id)
    ? [
        "The walking button puts you on her deck: the stick walks, drag to look. If she sinks under you, you float; the eye button looks under the water, and the bird button goes back to flying." +
          (ship.id === "titanic"
            ? " Beside a door, the door button takes you inside; inside, the other door button takes you back outside."
            : ""),
      ]
    : [];
}

/** The controls card's paint line (a ship with more than one livery). */
function liveryLines(ship: ShipSpec): string[] {
  return resolveLivery(ship, null) !== null
    ? [
        "The paint brush opens her paints, even while she sinks. The anchor row is paint she really wore; the sparkle row is just for fun.",
      ]
    : [];
}

/** The controls card's time line (every ship: 1.9). */
const TIME_LINE =
  "The sun-and-moon button (top) changes the time of day, even while she sinks. The anchor is the time she really sank; the sparkle row is just for fun. The water row makes the water under the sea clearer and lighter.";

/** What each livery was, in a young player's words. */
const LIVERY_WORDS: Readonly<Record<string, string>> = {
  "white-star-1912":
    "Her real White Star colours: a black hull with a thin gold line, white decks and buff funnels with black tops.",
  "columbia-1975":
    "Her real colours: a dark red hull, white cabins and a dark red stack with a buff band, a red star and a black top.",
  "war-1915":
    "In 1915 there was a war. She sailed with her funnels painted dark, so she was harder to see. Her name stayed on her bow in gold letters.",
  "cunard-1907":
    "When she was new in 1907 she wore Cunard's colours: red funnels with black tops and black bands, a black hull and white decks.",
  "dazzle-1918":
    "In the war, ships were painted in wild stripes called dazzle. The stripes made it hard to tell which way a ship was going.",
  "cunard-1912":
    "In 1912, when she rescued the Titanic's survivors, she wore Cunard's colours: a red funnel with a black top, a black hull and white decks.",
  hospital:
    "In 1916 she was a hospital ship, painted white with a green stripe and big red crosses, so every ship could see what she was.",
  liner:
    "She was built to carry passengers in White Star's colours, like her sisters: a black hull, white decks and buff funnels with black tops. She never sailed in them.",
  "costa-2012":
    "Her real Costa colours: all white, with a thin blue line at the water and a big yellow funnel with a blue C on it.",
  poseidon:
    "Her own colours: all white, with a sea-blue band and a white funnel with a blue top. She is a made-up ship.",
};

/** What the paint brush says when tapped: the livery she is in now. */
export function liveryHelp(ship: ShipSpec, id: string | null): Help | null {
  const now = resolveLivery(ship, id);
  const livery = ship.liveries?.find((l) => l.id === now);
  if (!livery) return null;
  return {
    title: livery.label,
    lines: [
      livery.fun
        ? "Just for fun: real ships of her day wore colours like these, but she never did."
        : (LIVERY_WORDS[livery.id] ??
          `${ship.name} as she was in ${livery.year}.`),
      "Tap another paint to compare.",
    ],
  };
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
  // Past her side the angle means little: say where she is (a ship that
  // rolls right over, the Poseidon, can go past 180\u00b0 and round again).
  const far = leanFromUpright(f.listDeg);
  if (far > 135) return "upside down";
  if (far >= 90) return "on her side";
  // Round to (-180, 180]: 287\u00b0 to starboard is 73\u00b0 to port.
  const n = ((((f.listDeg + 180) % 360) + 360) % 360) - 180;
  return `${Math.abs(n).toFixed(1)}\u00b0 to ${n < 0 ? "port" : "starboard"}`;
}

export function powerText(
  f: Pick<SimFrame, "power">,
  /** A wave ship holds her emergency level: that is no flicker. */
  ship?: Pick<ShipSpec, "cause" | "blackout">
): string {
  const em = ship?.cause === "wave" ? ship.blackout?.emergencyLight : undefined;
  if (em !== undefined && f.power > 0.001 && Math.abs(f.power - em) < 0.02)
    return "Emergency lights";
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

/**
 * The lines that differ between the torpedo ships: the Lusitania's (1.1)
 * by default, the Carpathia's own.
 */
function torpedoLines(ship: ShipSpec): {
  lean: string;
  power: string;
  speed: string;
  extra: string[];
} {
  if (storyIdOf(ship) === "carpathia")
    return {
      lean: "The first torpedo let the sea into a coal bunker on her port side, so she leaned a little to port. As the water spread inside her, she came nearly upright again.",
      power:
        "On the real morning the second torpedo flooded her engine room: her engines stopped, and the lights went out at once.",
      speed:
        "Play and pause, and choose how fast the morning goes: ×1 is real time. She stays afloat for more than an hour and a half, so try ×30.",
      extra: [
        "The torpedo on the timeline jumps to 10:50 AM, when the U-boat came back.",
      ],
    };
  return {
    lean: "Long coal bunkers ran down both her sides. When the sea filled the ones on the starboard side, she leaned over a long way, fast.",
    power:
      "On the real afternoon the steam failed a few minutes after the torpedo, and the lights went out.",
    speed:
      "Play and pause, and choose how fast the afternoon goes: ×1 is real time.",
    extra: [],
  };
}

/** The torpedo ship's cards (the Titanic's are below, as in 1.0). */
function torpedoHelp(
  topic: HelpTopic,
  frame: SimFrame | null,
  ship: ShipSpec
): Help {
  const own = torpedoLines(ship);
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
          own.lean,
        ],
      };
    case "power":
      return {
        title: "Power",
        now: frame ? powerText(frame) : undefined,
        lines: [
          "The boilers made the steam that turned the engines and the dynamos that made the electricity.",
          own.power,
        ],
      };
    case "controls":
    default:
      return {
        title: "How to watch",
        lines: [
          "Drag to look around the ship. Pinch to zoom in and out. Two fingers move the view. Double-tap the ship to fly close.",
          own.speed,
          "Drag the timeline, or tap an icon on it, to jump to that moment.",
          ...own.extra,
          `X-ray shows the water inside. The pins fly you to ${placeList(ship)}.`,
          "The camera button picks a view: the bridge, the stern, a lifeboat, under the water, or the movie camera.",
          ...walkLines(ship),
          ...liveryLines(ship),
          TIME_LINE,
        ],
      };
  }
}

/** The mine ship's cards (the Britannic's): a mine, her morning, her roll. */
function mineHelp(
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
          "How far the front of the ship tips down. As her front sinks lower, the sea reaches rows of open portholes and comes in faster.",
          `The sea here is only ${ship.seaDepthM} m deep, less than her length: her bow can reach the sea floor while her stern is still up.`,
        ],
      };
    case "lean":
      return {
        title: "Lean",
        now: frame ? leanText(frame) : undefined,
        lines: [
          "How far the ship leans to one side. Port is the left side looking forward, starboard the right.",
          "The mine opened her starboard side. She leaned only a little until the very end, when she rolled over onto her side.",
        ],
      };
    case "power":
      return {
        title: "Power",
        now: frame ? powerText(frame) : undefined,
        lines: [
          "Her boilers made the steam that turned her engines and the dynamos that made the electricity.",
          "Her lights stayed on almost to the end, until she rolled over.",
        ],
      };
    case "controls":
    default:
      return {
        title: "How to watch",
        lines: [
          "Drag to look around the ship. Pinch to zoom in and out. Two fingers move the view. Double-tap the ship to fly close.",
          "Play and pause, and choose how fast the morning goes: ×1 is real time.",
          "Drag the timeline, or tap an icon on it, to jump to that moment.",
          `X-ray shows the water inside. The pins fly you to ${placeList(ship)}.`,
          "The camera button picks a view: the bridge, the stern, a lifeboat, under the water, or the movie camera.",
          ...walkLines(ship),
          ...liveryLines(ship),
          TIME_LINE,
        ],
      };
  }
}

/**
 * The rocks ship's cards (the Costa Concordia's): a rock, a blackout, a long
 * slow lean, and a rest on the rocks. No people, no blame.
 */
function rocksHelp(
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
          `${ship.name} weighed about ${(Math.round(ship.displacementT / 1000) * 1000).toLocaleString("en-US")} t. A rock tore her left side open, and the sea filled her engine rooms first.`,
        ],
      };
    case "bow":
      return {
        title: "Bow down",
        now: frame ? bowDownText(frame) : undefined,
        lines: [
          "How far the front of the ship tips down. She sank a little by the stern, so this stays at zero.",
          `The sea by the island is shallow, about ${ship.seaDepthM} m, so the rocks held her up.`,
        ],
      };
    case "lean":
      return {
        title: "Lean",
        now: frame ? leanText(frame) : undefined,
        lines: [
          "How far the ship leans to one side. Port is the left side looking forward, starboard the right.",
          "The rock tore her port side, but the water and the wind slowly tipped her over to starboard. At the end she lay on her side on the rocks.",
        ],
      };
    case "power":
      return {
        title: "Power",
        now: frame ? powerText(frame) : undefined,
        lines: [
          "Her engines turned generators that made the electricity for everything, even her propellers.",
          "When the sea reached her generators, her main lights went out. Small emergency lights stayed on.",
        ],
      };
    case "controls":
    default:
      return {
        title: "How to watch",
        lines: [
          "Drag to look around the ship. Pinch to zoom in and out. Two fingers move the view. Double-tap the ship to fly close.",
          "Play and pause, and choose how fast the night goes: ×1 is real time. Her night lasts three hours, so try ×30.",
          "Drag the timeline, or tap an icon on it, to jump to that moment.",
          `X-ray shows the water inside. The pins fly you to ${placeList(ship)}.`,
          "The camera button picks a view: the bridge, the stern, a lifeboat, under the water, or the movie camera.",
          ...walkLines(ship),
          ...liveryLines(ship),
        ],
      };
  }
}

/** The lean card's second line, by the wave the run has. */
const LEAN_WAVE: Record<WaveVariant, string> = {
  real: "The wave hit her port side and rolled her all the way over, until she floated upside down. Air caught inside her, like a cup pushed upside down into the bath, kept her up.",
  smaller:
    "A smaller wave hit her port side and leaned her far over, but not all the way. Air and her own weight swung her back upright.",
  ahead:
    "The wave came at her bow, not her side, so it mostly lifted her. It leaned her far less than a wave on her side.",
};

/**
 * The wave ship's cards (the Poseidon's): a giant wave, a roll right over,
 * the air that holds her up and the sea that takes its place. A made-up
 * ship; no people.
 */
function waveHelp(
  topic: HelpTopic,
  frame: SimFrame | null,
  ship: ShipSpec,
  variant: WaveVariant = "real"
): Help {
  switch (topic) {
    case "water":
      return {
        title: "Water aboard",
        now: frame ? waterText(frame) : undefined,
        lines: [
          "How much sea water has come inside the ship, in tonnes. One tonne is about a bathtub and a half.",
          `${ship.name} weighed about ${(Math.round(ship.displacementT / 1000) * 1000).toLocaleString("en-US")} t. The wave smashed windows and doors, and the sea poured in through them.`,
        ],
      };
    case "bow":
      return {
        title: "Bow down",
        now: frame ? bowDownText(frame) : undefined,
        lines: [
          "How far the front of the ship tips down. Upside down, she floats level for a long time.",
          `At the end her bow goes down first, and she sinks to the sea floor, ${ship.seaDepthM.toLocaleString("en-US")} m below.`,
        ],
      };
    case "lean":
      return {
        title: "Lean",
        now: frame ? leanText(frame) : undefined,
        lines: [
          "How far the ship leans to one side. Port is the left side looking forward, starboard the right.",
          LEAN_WAVE[variant],
        ],
      };
    case "power":
      return {
        title: "Power",
        now: frame ? powerText(frame) : undefined,
        lines: [
          "Her engines turned generators that made the electricity for everything on board.",
          "When she rolled over, the generators stopped and her main lights went out. Small emergency lights stayed on.",
        ],
      };
    case "controls":
    default:
      return {
        title: "How to watch",
        lines: [
          "Drag to look around the ship. Pinch to zoom in and out. Two fingers move the view. Double-tap the ship to fly close.",
          "Play and pause, and choose how fast the night goes: ×1 is real time. The wave comes fast, then she floats upside down for most of an hour, so try ×30 after the roll.",
          "Drag the timeline, or tap an icon on it, to jump to that moment.",
          `X-ray shows the water inside. The pins fly you to ${placeList(ship)}.`,
          "The camera button picks a view: the bridge, the stern, a lifeboat, under the water, or the movie camera.",
          ...liveryLines(ship),
          TIME_LINE,
        ],
      };
  }
}

/** The storm ship's cards (the Fitzgerald's): a laker in a lake storm. */
function stormHelp(
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
          "How much lake water has come inside the ship, in tonnes. One tonne is about a bathtub and a half.",
          `${ship.name} weighed about ${(Math.round(ship.displacementT / 1000) * 1000).toLocaleString("en-US")} t with her cargo of iron ore pellets. Waves washed over her low deck, and water got in through her hatch covers, her broken vents and her tanks.`,
        ],
      };
    case "bow":
      return {
        title: "Bow down",
        now: frame ? bowDownText(frame) : undefined,
        lines: [
          "How far the front of the ship tips down. In the storm she pitches up and down on every wave.",
          `The lake here is only ${ship.seaDepthM} m deep, less than her length: if she dives, her bow can hit the bottom while her stern is still at the surface.`,
        ],
      };
    case "lean":
      return {
        title: "Lean",
        now: frame ? leanText(frame) : undefined,
        lines: [
          "How far the ship leans to one side. Port is the left side looking forward, starboard the right.",
          "Her captain reported a lean in the afternoon. Water in the tanks along one side makes her lean that way. Experts still argue about how it got in: What if lets you switch each cause off.",
        ],
      };
    case "power":
      return {
        title: "Power",
        now: frame ? powerText(frame) : undefined,
        lines: [
          "Her steam turbine turned the propeller and made the electricity for her lights.",
          "Her two big pumps worked all afternoon, pumping water out of her tanks.",
        ],
      };
    case "controls":
    default:
      return {
        title: "How to watch",
        lines: [
          "Drag to look around the ship. Pinch to zoom in and out. Two fingers move the view. Double-tap the ship to fly close.",
          "Play and pause, and choose how fast the storm goes: ×1 is real time, and her storm lasts almost four hours, so try ×100.",
          "Drag the timeline, or tap an icon on it, to jump to that moment.",
          `X-ray shows the water inside, and her cargo of iron ore pellets. The pins fly you to ${placeList(ship)}.`,
          "The camera button picks a view: the bridge, the stern, a lifeboat, under the water, or the movie camera.",
          ...liveryLines(ship),
          TIME_LINE,
        ],
      };
  }
}

/** The words on the card for `topic`, now (`frame` null before a run). */
export function helpFor(
  topic: HelpTopic,
  frame: SimFrame | null,
  ship: ShipSpec = titanic,
  wave?: WaveVariant
): Help {
  if (ship.cause === "wave") return waveHelp(topic, frame, ship, wave);
  if (ship.cause === "storm") return stormHelp(topic, frame, ship);
  if (ship.cause === "torpedo") return torpedoHelp(topic, frame, ship);
  if (ship.cause === "mine") return mineHelp(topic, frame, ship);
  if (ship.cause === "rocks") return rocksHelp(topic, frame, ship);
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
          ...liveryLines(ship),
          TIME_LINE,
        ],
      };
  }
}
