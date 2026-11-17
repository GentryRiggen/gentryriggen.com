import {
  DECOR_GLYPH,
  EMOTE_GLYPH,
  FOOD_GLYPH,
  parseUnlockKey,
  type DecorId,
  type EmoteId,
  type FoodId,
  type UnlockKey,
} from "@/lib/flamelings/catalog";
import type { Look } from "@/lib/flamelings/types";
import { AccessoryIcon } from "./Accessories";
import Blob from "./Blob";

const BASE_LOOK: Look = { colour: "ember", shape: "flame", eyes: "round" };

interface ItemPreviewProps {
  itemKey: UnlockKey;
  /** The pet's current look, so a hat is shown beside the colour it wears. */
  look?: Look;
  className?: string;
  /** Draw as a dark silhouette (a locked item). */
  silhouette?: boolean;
}

/** A picture of one catalog item, whatever kind it is. */
export default function ItemPreview({
  itemKey,
  look = BASE_LOOK,
  className = "size-16",
  silhouette = false,
}: ItemPreviewProps) {
  const parsed = parseUnlockKey(itemKey);
  if (!parsed) return null;
  const tone = silhouette ? "brightness-0 opacity-30 dark:invert" : "";
  switch (parsed.kind) {
    case "hat":
    case "face":
    case "neck":
      return (
        <AccessoryIcon
          kind={parsed.kind}
          id={parsed.id}
          className={`${className} ${tone}`}
        />
      );
    case "decor":
      return (
        <span
          aria-hidden="true"
          className={`grid place-items-center text-4xl ${className} ${tone}`}
        >
          {DECOR_GLYPH[parsed.id as DecorId]}
        </span>
      );
    case "emote":
      return (
        <span
          aria-hidden="true"
          className={`grid place-items-center text-4xl ${className} ${tone}`}
        >
          {EMOTE_GLYPH[parsed.id as EmoteId]}
        </span>
      );
    case "food":
      return (
        <span
          aria-hidden="true"
          className={`grid place-items-center text-4xl ${className} ${tone}`}
        >
          {FOOD_GLYPH[parsed.id as FoodId]}
        </span>
      );
    case "colour":
    case "shape":
    case "eyes":
      return (
        <div className={`fl-still ${className} ${tone}`}>
          <Blob
            look={{ ...look, [parsed.kind]: parsed.id }}
            mood="happy"
            className="size-full"
          />
        </div>
      );
  }
}
