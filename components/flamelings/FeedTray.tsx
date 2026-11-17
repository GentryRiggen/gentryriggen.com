import {
  FOODS,
  FOOD_GLYPH,
  FOOD_INFO,
  unlockKey,
  type FoodId,
} from "@/lib/flamelings/catalog";
import { lockText } from "@/lib/flamelings/status";
import type { Pet } from "@/lib/flamelings/types";
import { FOCUS_RING } from "./styles";

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
      className="flex justify-center gap-3 rounded-t-3xl bg-amber-900/85 p-3 backdrop-blur"
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
            className={`relative grid size-20 place-items-center rounded-2xl bg-amber-100 shadow active:scale-95 disabled:bg-amber-100/30 sm:size-24 ${FOCUS_RING}`}
          >
            <span
              aria-hidden="true"
              className={`text-5xl ${owned ? "" : "opacity-30 grayscale"}`}
            >
              {FOOD_GLYPH[food]}
            </span>
            {!owned && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-1 text-center text-xs font-bold text-amber-950"
              >
                🔒 {lockText(key)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
