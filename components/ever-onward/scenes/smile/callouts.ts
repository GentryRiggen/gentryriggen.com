import type { SmileSceneInfo } from "@/lib/ever-onward/universes/smile";
import type { LastBuy } from "../../universes/types";

export interface Callout {
  x: number;
  y: number;
  text: string;
}

type Place = (n: number) => Callout;

const at =
  (x: number, y: number, text: string): Place =>
  () => ({ x, y, text });

const counted =
  (x: number, y: number, label: string, dx = 0, cap = 6): Place =>
  (n) => ({
    x: x + (Math.min(n, cap) - 1) * dx,
    y,
    text: `${label} ${n}`,
  });

const FRIEND: Record<string, Place> = {
  balloon: counted(132, 96, "Balloons", 8, 4),
  "joke-book": at(246, 214, "Joke book"),
  puppy: counted(60, 232, "Puppy", 40, 4),
  bracelet: at(184, 180, "Bracelet"),
  lemonade: counted(56, 180, "Lemonade"),
  "magic-hat": at(308, 214, "Magic hat"),
  "next-door": at(335, 120, "Next door"),
};

const TOWN: Record<string, Place> = {
  clown: counted(30, 200, "Clown", 24),
  bunting: at(130, 132, "Bunting"),
  band: counted(40, 232, "Band", 28),
  bench: counted(150, 258, "Benches", 70, 3),
  "smile-factory": counted(50, 148, "Factory"),
  fireworks: counted(80, 58, "Fireworks", 70, 4),
  "key-to-town": at(150, 116, "The key"),
};

const WORLD: Record<string, Place> = {
  poster: counted(28, 122, "Poster", 40, 8),
  "bigger-brush": at(200, 150, "Wider smiles"),
  loudspeaker: counted(72, 146, "Loudspeaker", 30),
  "mask-booth": at(336, 186, "Masks"),
  "cheer-tower": counted(60, 38, "Tower", 40),
  "cheer-blimp": counted(90, 34, "Blimp", 60, 3),
  "no-bad-days": at(200, 210, "The sign"),
  "cheer-satellite": at(186, 14, "Satellite"),
};

const QUIET: Record<string, Place> = {
  tea: at(280, 220, "Tea"),
  "long-silence": at(200, 40, "A long silence"),
  blanket: at(190, 200, "Blanket"),
  rain: at(200, 90, "Rain"),
  candle: at(112, 196, "Candle"),
  kettle: at(338, 190, "Kettle"),
  "room-on-bench": at(218, 170, "Room on the bench"),
};

const PLACES: Record<SmileSceneInfo["phase"], Record<string, Place>> = {
  friend: FRIEND,
  town: TOWN,
  world: WORLD,
  quiet: QUIET,
};

/** The callout for a purchase, or null when the scene has no spot for it. */
export function calloutFor(
  buy: Pick<LastBuy, "upgradeId" | "n">,
  info: SmileSceneInfo
): Callout | null {
  const place = PLACES[info.phase][buy.upgradeId];
  return place ? place(buy.n) : null;
}

/** Upgrade ids with a callout, by part (a test keeps this in step with the shop). */
export const CALLOUT_IDS: Readonly<
  Record<SmileSceneInfo["phase"], readonly string[]>
> = {
  friend: Object.keys(FRIEND),
  town: Object.keys(TOWN),
  world: Object.keys(WORLD),
  quiet: Object.keys(QUIET),
};
