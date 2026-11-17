import { useEffect, useRef, useState } from "react";
import { type DecorId } from "@/lib/flamelings/catalog";
import type { DressSlot } from "@/lib/flamelings/actions";
import {
  SHOP_ITEMS,
  SHOP_TABS,
  priceOf,
  shopItem,
  sparksShort,
  type ShopItem,
  type ShopTab,
} from "@/lib/flamelings/shop";
import { moodOf } from "@/lib/flamelings/sim";
import { labelOf } from "@/lib/flamelings/status";
import { useFlamelings } from "@/lib/flamelings/store";
import type { Pet } from "@/lib/flamelings/types";
import { AccessoryIcon } from "./Accessories";
import Blob from "./Blob";
import { DecorIcon } from "./DecorArt";
import SparkCounter from "./SparkCounter";
import SparkIcon from "./SparkIcon";
import {
  BIG_BUTTON,
  CHROME_BG,
  FOCUS_RING,
  PRIMARY_BUTTON,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
} from "./styles";

const SHORT_MS = 2600;

function isOn(pet: Pet, item: ShopItem): boolean {
  if (item.tab === "decor") return pet.decor.includes(item.id as DecorId);
  return pet.worn[item.tab] === item.id;
}

interface ItemCardProps {
  pet: Pet;
  item: ShopItem;
  shaking: boolean;
  short: number;
  onBuy: (item: ShopItem) => void;
  onToggle: (item: ShopItem) => void;
}

function ItemCard({
  pet,
  item,
  shaking,
  short,
  onBuy,
  onToggle,
}: ItemCardProps) {
  const owned = pet.unlocked.includes(item.key);
  const on = owned && isOn(pet, item);
  const missing = sparksShort(pet.sparks, item.price);
  const name = labelOf(item.key);
  return (
    <div
      data-testid={`shop-item-${item.id}`}
      data-owned={owned}
      className={`flex min-w-0 flex-col items-center gap-1 rounded-3xl bg-white/75 p-2 shadow-md dark:bg-slate-800/75 ${
        shaking ? "fl-shop-shake" : ""
      }`}
    >
      <div className="grid h-20 w-full place-items-center">
        {item.tab === "decor" ? (
          <DecorIcon id={item.id as DecorId} className="h-20 w-full" />
        ) : (
          <AccessoryIcon kind={item.tab} id={item.id} className="h-20 w-full" />
        )}
      </div>
      <span aria-hidden="true" className="text-sm font-bold">
        {name}
        {!owned && item.price < (shopItem(item.key)?.price ?? 0) && (
          <span
            data-testid="shop-sale"
            className="ml-1 rounded-full bg-sky-500 px-2 py-0.5 text-xs font-black text-white"
          >
            ❄ SALE
          </span>
        )}
      </span>
      {owned ? (
        <button
          type="button"
          aria-pressed={on}
          aria-label={`${name}, ${on ? "on" : "off"}`}
          onClick={() => onToggle(item)}
          className={`${BIG_BUTTON} w-full px-2 text-lg ${
            on
              ? "bg-emerald-500 text-white dark:bg-emerald-400 dark:text-stone-900"
              : "bg-stone-200 text-stone-900 dark:bg-slate-700 dark:text-amber-50"
          }`}
        >
          {on ? "On ✓" : "Off"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onBuy(item)}
          aria-label={
            missing === 0
              ? `Buy ${name} for ${item.price} sparks`
              : `${name}, ${item.price} sparks, ${missing} more needed`
          }
          className={`${BIG_BUTTON} flex w-full items-center justify-center gap-1.5 px-2 text-2xl font-black tabular-nums ${
            missing === 0
              ? "bg-orange-500 text-white dark:bg-orange-400 dark:text-stone-900"
              : "bg-stone-300 text-stone-600 dark:bg-slate-600 dark:text-slate-300"
          }`}
        >
          <SparkIcon className="size-7" />
          {item.price}
        </button>
      )}
      <p
        aria-live="polite"
        className="flex h-6 items-center gap-1 text-base font-black text-rose-700 dark:text-rose-300"
      >
        {short > 0 && !owned && (
          <span data-testid="shop-short" aria-label={`${short} more sparks`}>
            <SparkIcon className="inline size-5 align-text-bottom" /> {short}{" "}
            more
          </span>
        )}
      </p>
    </div>
  );
}

interface ShopProps {
  pet: Pet;
  nowMs: number;
  onClose: () => void;
}

/** The shop: spend sparks on hats, face and neck items, and glade decor. */
export default function Shop({ pet, nowMs, onClose }: ShopProps) {
  const buy = useFlamelings((s) => s.buy);
  const dress = useFlamelings((s) => s.dress);
  const setDecor = useFlamelings((s) => s.setDecor);
  const [tab, setTab] = useState<ShopTab>("hat");
  const [shake, setShake] = useState<{ key: string; n: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [shortKey, setShortKey] = useState<string | null>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function handleBuy(item: ShopItem) {
    if (pet.sparks < item.price) {
      setShake((s) => ({ key: item.key, n: (s?.n ?? 0) + 1 }));
      setShortKey(item.key);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setShortKey(null), SHORT_MS);
      return;
    }
    buy(pet.id, item.key);
  }

  function handleToggle(item: ShopItem) {
    if (item.tab === "decor") {
      setDecor(
        pet.id,
        item.id as DecorId,
        !pet.decor.includes(item.id as DecorId)
      );
    } else {
      dress(pet.id, item.tab as DressSlot, isOn(pet, item) ? null : item.id);
    }
  }

  const mood = moodOf(pet, nowMs);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shop"
      className={`fixed inset-0 z-30 flex flex-col overflow-hidden ${CHROME_BG} ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <div className="flex items-center justify-between gap-3 py-2">
        <h2 className="text-2xl font-black">
          <span aria-hidden="true">🛒 </span>Shop
        </h2>
        <SparkCounter value={pet.sparks} />
        <button type="button" onClick={onClose} className={PRIMARY_BUTTON}>
          Done
        </button>
      </div>
      <div className="flex justify-center py-1">
        <Blob
          look={pet.look}
          worn={pet.worn}
          mood={mood === "asleep" ? "happy" : mood}
          stage="bonfire"
          className="size-44 sm:size-60 landscape:size-36"
        />
      </div>
      <div
        role="tablist"
        aria-label="What to shop for"
        className="flex gap-2 overflow-x-auto py-2"
      >
        {SHOP_TABS.map((t) => (
          <button
            key={t.tab}
            type="button"
            role="tab"
            aria-selected={t.tab === tab}
            onClick={() => setTab(t.tab)}
            className={`${BIG_BUTTON} flex shrink-0 flex-col items-center justify-center px-4 py-2 text-base ${
              t.tab === tab
                ? "bg-orange-500 text-white dark:bg-orange-400 dark:text-stone-900"
                : "bg-white/80 dark:bg-slate-800/80"
            }`}
          >
            <span aria-hidden="true" className="text-2xl">
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        aria-label={SHOP_TABS.find((t) => t.tab === tab)?.label}
        className={`grid flex-1 content-start gap-3 overflow-y-auto overflow-x-hidden py-2 [grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr))] ${FOCUS_RING}`}
      >
        {SHOP_ITEMS[tab].map((full) => {
          const item = { ...full, price: priceOf(full, nowMs) };
          return (
            <ItemCard
              key={`${item.key}-${shake?.key === item.key ? shake.n : 0}`}
              pet={pet}
              item={item}
              shaking={shake?.key === item.key}
              short={
                shortKey === item.key ? sparksShort(pet.sparks, item.price) : 0
              }
              onBuy={handleBuy}
              onToggle={handleToggle}
            />
          );
        })}
      </div>
    </div>
  );
}
