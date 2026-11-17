import {
  FOODS,
  FOOD_GLYPH,
  FOOD_INFO,
  unlockKey,
  type FoodId,
} from "@/lib/flamelings/catalog";
import { lockText } from "@/lib/flamelings/status";
import type { Pet } from "@/lib/flamelings/types";
import FlIcon from "./FlIcon";
import { DISPLAY, TRAY, TRAY_TILE } from "./styles";

interface FeedTrayProps {
  pet: Pet;
  onPick: (food: FoodId) => void;
}

/** The food basket: tap a food and it flies to the pet. */
export default function FeedTray({ pet, onPick }: FeedTrayProps) {
  return (
    <div
      role="group"
      aria-label="Food"
      className={`${TRAY} flex max-w-full flex-wrap justify-center gap-2 sm:gap-3`}
    >
      {FOODS.map((food) => {
        const key = unlockKey("food", food);
        const owned = pet.unlocked.includes(key);
        return (
          <button
            key={food}
            type="button"
            disabled={!owned}
            onClick={() => onPick(food)}
            aria-label={
              owned
                ? FOOD_INFO[food].label
                : `${FOOD_INFO[food].label}, locked, ${lockText(key)}`
            }
            className={TRAY_TILE}
          >
            <span
              aria-hidden="true"
              className={`text-5xl ${owned ? "" : "opacity-25 grayscale"}`}
            >
              {FOOD_GLYPH[food]}
            </span>
            {!owned && (
              <span
                aria-hidden="true"
                className={`${DISPLAY} absolute inset-x-0 bottom-1 flex items-center justify-center gap-0.5 text-xs font-semibold text-[#7a5a78]`}
              >
                <FlIcon name="lock" className="size-3.5" />
                {lockText(key)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
