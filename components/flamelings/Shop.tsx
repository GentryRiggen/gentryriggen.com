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
import FlIcon, { type FlIconName } from "./FlIcon";
import PanelHeader from "./PanelHeader";
import HelpCard, { HelpTap, PRESSABLE } from "./HelpCard";
import { helpFor } from "@/lib/flamelings/help";
import { sparkRoundsLeft } from "@/lib/flamelings/actions";
import {
  CHROME_BG,
  DISPLAY,
  FOCUS_RING,
  DONE_BUTTON,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
  SPOTLIGHT,
  STICKER,
  TAB_CHIP,
  TAB_ICON_DISC,
  TAB_OFF,
  TAB_ON,
} from "./styles";

const TAB_ICON: Record<ShopTab, FlIconName> = {
  hat: "hat",
  face: "face",
  neck: "neck",
  decor: "glade",
};

const SHORT_MS = 2600;
/** How long a card just bought pops and sparkles. */
const JUST_BOUGHT_MS = 700;

function isOn(pet: Pet, item: ShopItem): boolean {
  if (item.tab === "decor") return pet.decor.includes(item.id as DecorId);
  return pet.worn[item.tab] === item.id;
}

interface ItemCardProps {
  pet: Pet;
  item: ShopItem;
  shaking: boolean;
  justBought: boolean;
  short: number;
  onBuy: (item: ShopItem) => void;
  onToggle: (item: ShopItem) => void;
}

/** The sparkles that fly out of a card just bought. */
const BUY_SPARKS = [
  "left-[12%] top-[18%] [--fl-dx:-26px] [--fl-dy:-30px]",
  "left-[50%] top-[8%] [--fl-dx:0px] [--fl-dy:-38px]",
  "left-[86%] top-[18%] [--fl-dx:26px] [--fl-dy:-30px]",
  "left-[8%] top-[52%] [--fl-dx:-34px] [--fl-dy:0px]",
  "left-[92%] top-[52%] [--fl-dx:34px] [--fl-dy:0px]",
  "left-[30%] top-[30%] [--fl-dx:-16px] [--fl-dy:-22px]",
  "left-[70%] top-[30%] [--fl-dx:16px] [--fl-dy:-22px]",
];

function ItemCard({
  pet,
  item,
  shaking,
  justBought,
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
      data-just-bought={justBought ? "true" : undefined}
      className={`${STICKER} relative flex min-w-0 flex-col items-center gap-1.5 p-2.5 ${
        shaking ? "fl-shop-shake" : ""
      } ${justBought ? "fl-purchase-pop" : ""}`}
    >
      {owned && (
        <span
          aria-hidden="true"
          data-testid="shop-owned-badge"
          className={`absolute -right-1.5 -top-1.5 z-10 grid size-8 place-items-center rounded-full border-[3px] border-[#fff6e6] shadow-[0_2px_6px_rgba(30,10,40,.25)] ${
            on ? "bg-[#4ade80]" : "bg-[#d9f5e4]"
          }`}
        >
          <FlIcon name="check" className="size-5" />
        </span>
      )}
      <div
        className={`grid h-24 w-full place-items-center rounded-[22px] ${SPOTLIGHT}`}
      >
        {item.tab === "decor" ? (
          <DecorIcon id={item.id as DecorId} className="h-20 w-full" />
        ) : (
          <AccessoryIcon kind={item.tab} id={item.id} className="h-20 w-full" />
        )}
      </div>
      <span
        aria-hidden="true"
        className={`${DISPLAY} flex flex-wrap items-center justify-center gap-1 text-center text-base font-semibold leading-tight`}
      >
        {name}
        {!owned && item.price < (shopItem(item.key)?.price ?? 0) && (
          <span
            data-testid="shop-sale"
            className="rounded-full bg-[#4aa3ff] px-2 py-0.5 text-xs font-bold text-white shadow-[0_2px_0_#2563eb]"
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
          className={`${DISPLAY} min-h-16 w-full rounded-full px-2 text-xl font-semibold transition-transform active:translate-y-[3px] ${FOCUS_RING} ${
            on
              ? "bg-gradient-to-b from-[#6ee7a0] to-[#22b864] text-white shadow-[0_4px_0_#15803d]"
              : "bg-[#f3e6d2] text-[#7a5a78] shadow-[0_4px_0_#dcc6a6]"
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
          className={`${DISPLAY} flex min-h-16 w-full items-center justify-center gap-1.5 rounded-full px-2 text-2xl font-bold tabular-nums transition-transform active:translate-y-[3px] ${FOCUS_RING} ${
            missing === 0
              ? "bg-gradient-to-b from-[#ffe58a] to-[#ffc53d] text-[#7a3d00] shadow-[0_4px_0_#d9952a,0_8px_14px_rgba(30,10,40,.18)]"
              : "bg-[#f3e6d2] text-[#9a7f8f] shadow-[0_4px_0_#dcc6a6]"
          }`}
        >
          <FlIcon name={missing === 0 ? "spark" : "lock"} className="size-7" />
          {item.price}
        </button>
      )}
      <p
        aria-live="polite"
        className="flex h-6 items-center gap-1 text-base font-extrabold text-[#c0264b]"
      >
        {short > 0 && !owned && (
          <span data-testid="shop-short" aria-label={`${short} more sparks`}>
            <FlIcon name="spark" className="inline size-5 align-text-bottom" />{" "}
            {short} more
          </span>
        )}
      </p>
      {justBought && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          {BUY_SPARKS.map((place) => (
            <span
              key={place}
              className={`fl-buy-spark absolute size-6 ${place}`}
            >
              <FlIcon name="spark" className="size-full" />
            </span>
          ))}
        </span>
      )}
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
  const [sparkHelp, setSparkHelp] = useState(false);
  const dress = useFlamelings((s) => s.dress);
  const setDecor = useFlamelings((s) => s.setDecor);
  const [tab, setTab] = useState<ShopTab>("hat");
  const [shake, setShake] = useState<{ key: string; n: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [shortKey, setShortKey] = useState<string | null>(null);
  const [justBought, setJustBought] = useState<string | null>(null);
  const boughtTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(boughtTimer.current);
    },
    []
  );

  function handleBuy(item: ShopItem) {
    if (pet.sparks < item.price) {
      setShake((s) => ({ key: item.key, n: (s?.n ?? 0) + 1 }));
      setShortKey(item.key);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setShortKey(null), SHORT_MS);
      return;
    }
    buy(pet.id, item.key);
    setJustBought(item.key);
    window.clearTimeout(boughtTimer.current);
    boughtTimer.current = window.setTimeout(
      () => setJustBought(null),
      JUST_BOUGHT_MS
    );
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
      className={`fl-sheet-up fixed inset-0 z-30 flex flex-col overflow-hidden ${CHROME_BG} ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
        <PanelHeader icon="shop" iconClass="bg-[#ffd166]" title="Shop">
          <div className={`${PRESSABLE} shrink-0`}>
            <SparkCounter value={pet.sparks} />
            <HelpTap
              label="How do I get sparks?"
              onOpen={() => setSparkHelp(true)}
            />
          </div>
          <button type="button" onClick={onClose} className={DONE_BUTTON}>
            Done
          </button>
        </PanelHeader>
        <div className="relative flex justify-center py-1">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,226,176,.9)_0%,rgba(255,226,176,0)_68%)] sm:size-72 landscape:size-48 dark:bg-[radial-gradient(circle,rgba(255,160,80,.38)_0%,rgba(255,160,80,0)_68%)]"
          />
          <Blob
            look={pet.look}
            worn={pet.worn}
            mood={mood === "asleep" ? "happy" : mood}
            stage="bonfire"
            className="relative size-40 sm:size-52 landscape:size-32"
          />
        </div>
        <div
          role="tablist"
          aria-label="What to shop for"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3 pt-1"
        >
          {SHOP_TABS.map((t) => (
            <button
              key={t.tab}
              type="button"
              role="tab"
              aria-selected={t.tab === tab}
              onClick={() => setTab(t.tab)}
              className={`${TAB_CHIP} ${t.tab === tab ? TAB_ON : TAB_OFF}`}
            >
              <span className={TAB_ICON_DISC}>
                <FlIcon name={TAB_ICON[t.tab]} className="size-7" />
              </span>
              {t.label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          aria-label={SHOP_TABS.find((t) => t.tab === tab)?.label}
          className={`grid flex-1 content-start gap-4 overflow-y-auto overflow-x-hidden px-1.5 pb-2 pt-2 [grid-template-columns:repeat(auto-fill,minmax(9rem,1fr))] ${FOCUS_RING}`}
        >
          {SHOP_ITEMS[tab].map((full) => {
            const item = { ...full, price: priceOf(full, nowMs) };
            return (
              <ItemCard
                key={`${item.key}-${shake?.key === item.key ? shake.n : 0}`}
                pet={pet}
                item={item}
                shaking={shake?.key === item.key}
                justBought={justBought === item.key}
                short={
                  shortKey === item.key
                    ? sparksShort(pet.sparks, item.price)
                    : 0
                }
                onBuy={handleBuy}
                onToggle={handleToggle}
              />
            );
          })}
        </div>
      </div>
      {sparkHelp && (
        <HelpCard
          help={helpFor("sparks", pet, sparkRoundsLeft(pet, nowMs))}
          icon="spark"
          onClose={() => setSparkHelp(false)}
        />
      )}
    </div>
  );
}
