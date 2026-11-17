import {
  DECOR,
  SHOP_FACES,
  SHOP_HATS,
  SHOP_NECKS,
  unlockKey,
  type UnlockKey,
} from "./catalog";

/**
 * The shop: what each item costs in sparks. A pet earns roughly 40 to 80
 * sparks a day (see SPARKS in actions.ts), so a few small things are within
 * reach on day one and the big ones take a week or more.
 */
export type ShopTab = "hat" | "face" | "neck" | "decor";

export const SHOP_TABS: readonly {
  tab: ShopTab;
  label: string;
  icon: string;
}[] = [
  { tab: "hat", label: "Hats", icon: "🎩" },
  { tab: "face", label: "Face", icon: "🕶️" },
  { tab: "neck", label: "Neck", icon: "🎀" },
  { tab: "decor", label: "Glade", icon: "🏕️" },
];

export interface ShopItem {
  key: UnlockKey;
  tab: ShopTab;
  id: string;
  price: number;
}

const PRICES: Record<string, number> = {
  // Hats
  bunny: 50,
  chef: 60,
  flowerCrown: 90,
  pirate: 90,
  headphones: 110,
  partyCrown: 140,
  witch: 160,
  astronaut: 300,
  // Face
  freckles: 30,
  clownNose: 40,
  eyepatch: 60,
  heartGlasses: 70,
  // Neck
  bandana: 40,
  necklace: 80,
  lei: 100,
  cape: 220,
  // Glade
  plant: 50,
  rug: 60,
  banner: 80,
  lanterns: 100,
  toyBox: 120,
  fairyLights: 140,
  snowman: 150,
  bed: 160,
  crystals: 200,
  tent: 280,
  mushroomHouse: 400,
};

function itemsOf(tab: ShopTab, ids: readonly string[]): ShopItem[] {
  return ids
    .map((id) => ({
      key: unlockKey(tab, id),
      tab,
      id,
      price: PRICES[id],
    }))
    .sort((a, b) => a.price - b.price);
}

/** Every item for sale, cheapest first within its tab. */
export const SHOP_ITEMS: Record<ShopTab, ShopItem[]> = {
  hat: itemsOf("hat", SHOP_HATS),
  face: itemsOf("face", SHOP_FACES),
  neck: itemsOf("neck", SHOP_NECKS),
  decor: itemsOf("decor", DECOR),
};

const BY_KEY = new Map<UnlockKey, ShopItem>(
  Object.values(SHOP_ITEMS)
    .flat()
    .map((item) => [item.key, item])
);

export function shopItem(key: UnlockKey): ShopItem | null {
  return BY_KEY.get(key) ?? null;
}

/** Sparks still missing for an item (0 when the pet can pay). */
export function sparksShort(sparks: number, price: number): number {
  return Math.max(0, price - sparks);
}
