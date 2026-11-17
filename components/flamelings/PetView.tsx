import { useCallback, useEffect, useRef, useState } from "react";
import {
  FOOD_GLYPH,
  type EmoteId,
  type FoodId,
} from "@/lib/flamelings/catalog";
import { hasGiftWaiting, stageFor, xpToNext } from "@/lib/flamelings/progress";
import { isAwake, moodOf, RELIGHT_FEEDS } from "@/lib/flamelings/sim";
import {
  BUBBLE_GLYPH,
  bubblesFor,
  emotesOf,
  fadeLevel,
} from "@/lib/flamelings/status";
import { playSound } from "@/lib/flamelings/sound";
import { useFlamelings } from "@/lib/flamelings/store";
import EmotePanel from "./EmotePanel";
import FeedTray from "./FeedTray";
import FireflyCatch from "./FireflyCatch";
import Glade from "./Glade";
import Blob from "./Blob";
import Meters from "./Meters";
import Shop from "./Shop";
import SoundToggle from "./SoundToggle";
import SparkCounter from "./SparkCounter";
import SparkFlights, { type Burst } from "./SparkFlights";
import Wardrobe from "./Wardrobe";
import { FOCUS_RING, SAFE_BOTTOM, SAFE_SIDES, SAFE_TOP } from "./styles";
import { useEmote } from "./useEmote";

type Panel = "feed" | "emotes" | "wardrobe" | "shop" | "play" | null;

/** Where each uncleaned ash pile sits on the glade floor. */
const ASH_SPOTS = [
  "left-[16%] top-[74%]",
  "right-[16%] top-[75%]",
  "left-[30%] top-[82%]",
  "right-[30%] top-[83%]",
];

/** Where the thought bubbles sit above the pet, by stage (the pet shrinks towards its feet). */
const BUBBLE_TOP: Record<string, string> = {
  spark: "top-[30%]",
  flicker: "top-[22%]",
  flame: "top-[15%]",
  blaze: "top-[8%]",
  bonfire: "top-[1%]",
};

/** A tap this recent is where fresh sparks fly out from. */
const RECENT_TAP_MS = 4000;

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const EATING_MS = 1500;
const FLY_MS = 600;

function BarButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex min-h-20 min-w-0 flex-col items-center justify-center rounded-3xl px-0.5 text-[0.7rem] font-extrabold sm:text-base shadow-lg transition-transform active:scale-95 disabled:opacity-40 disabled:active:scale-100 ${FOCUS_RING} ${
        active
          ? "bg-orange-500 text-white dark:bg-orange-300 dark:text-stone-900"
          : "bg-white/90 text-stone-900 dark:bg-slate-800/90 dark:text-amber-50"
      }`}
    >
      <span aria-hidden="true" className="text-2xl leading-none sm:text-3xl">
        {icon}
      </span>
      {label}
    </button>
  );
}

/** One pet in the glade: needs, care buttons, ash, gift, emotes. */
export default function PetView({ petId }: { petId: string }) {
  const pet = useFlamelings((s) => s.save.pets.find((p) => p.id === petId));
  const clock = useFlamelings((s) => s.clock);
  const go = useFlamelings((s) => s.go);
  const feed = useFlamelings((s) => s.feed);
  const clean = useFlamelings((s) => s.clean);
  const tapPet = useFlamelings((s) => s.tapPet);
  const openGift = useFlamelings((s) => s.openGift);
  const finishPlay = useFlamelings((s) => s.finishPlay);
  const [panel, setPanel] = useState<Panel>(null);
  const [flying, setFlying] = useState<FoodId | null>(null);
  const [eating, setEating] = useState(false);
  const [shaking, setShaking] = useState(0);
  const { emote, emoteKey, play } = useEmote();
  const timers = useRef<number[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  /** Sparks earned but still flying: the counter does not show them yet. */
  const [inFlight, setInFlight] = useState(0);
  const counterRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef<{ x: number; y: number; at: number } | null>(null);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    if (!pet) go({ screen: "shelf" });
  }, [pet, go]);

  // Sparks earned by an action fly from where it was tapped to the counter.
  useEffect(
    () =>
      useFlamelings.subscribe((state, previous) => {
        const last = state.lastEvents;
        if (!last || last === previous.lastEvents || last.petId !== petId) {
          return;
        }
        const amount = last.events.reduce(
          (sum, e) => (e.type === "sparks" ? sum + e.amount : sum),
          0
        );
        if (amount <= 0 || reducedMotion()) return;
        const tap = lastTap.current;
        const from =
          tap && Date.now() - tap.at < RECENT_TAP_MS
            ? tap
            : { x: window.innerWidth / 2, y: window.innerHeight * 0.55 };
        setInFlight((n) => n + amount);
        setBursts((list) => [
          ...list,
          { id: last.id, amount, x: from.x, y: from.y },
        ]);
      }),
    [petId]
  );

  const handleLand = useCallback((sparks: number) => {
    setInFlight((n) => Math.max(0, n - sparks));
    playSound("coin");
  }, []);
  const handleFlightDone = useCallback((id: number) => {
    setBursts((list) => list.filter((b) => b.id !== id));
  }, []);

  if (!pet) return null;

  const awake = isAwake(clock);
  const alive = pet.state === "alive";
  const canCare = awake && alive;
  const stage = stageFor(pet.level);
  const baseMood = moodOf(pet, clock);
  const mood = eating && alive ? "eating" : baseMood;
  const gift = hasGiftWaiting(pet, clock) && awake;
  const bubbles = bubblesFor(pet, clock);

  function later(fn: () => void, ms: number) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function pickFood(food: FoodId) {
    if (!pet || flying) return;
    setPanel(null);
    setFlying(food);
    later(() => {
      setFlying(null);
      const events = feed(pet.id, food);
      if (events.some((e) => e.type === "overfed")) {
        setShaking((n) => n + 1);
      } else if (events.length > 0 || pet.state === "ember") {
        setEating(true);
        later(() => setEating(false), EATING_MS);
      }
    }, FLY_MS);
  }

  function pokePet() {
    if (!pet || !alive) return;
    if (!awake) {
      play("sleepy");
      return;
    }
    tapPet(pet.id);
    const known = emotesOf(pet);
    play(known[Math.floor(Math.random() * known.length)] ?? "love");
  }

  function pickEmote(choice: EmoteId) {
    play(choice);
    setPanel(null);
  }

  function toggle(next: Exclude<Panel, null>) {
    setPanel((current) => (current === next ? null : next));
  }

  const xpNeeded = xpToNext(pet.level);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-slate-900"
      onPointerDownCapture={(e) => {
        lastTap.current = { x: e.clientX, y: e.clientY, at: Date.now() };
      }}
    >
      <Glade nowMs={clock} decor={pet.decor} />

      {/* The pet sits on the hearth. */}
      <div className="absolute left-1/2 top-[80%] -translate-x-1/2 -translate-y-full">
        <div
          key={shaking}
          className={`relative ${shaking > 0 ? "fl-headshake" : ""}`}
        >
          <button
            type="button"
            onClick={pokePet}
            aria-label={`${pet.name}, tap to say hi`}
            data-testid="pet"
            data-mood={mood}
            className={`block size-[min(80vw,46vh)] max-h-[30rem] max-w-[30rem] rounded-full ${FOCUS_RING}`}
          >
            <Blob
              look={pet.look}
              worn={pet.worn}
              fade={fadeLevel(pet)}
              mood={mood}
              stage={stage.id}
              emote={emote}
              emoteKey={emoteKey}
              className="size-full"
            />
          </button>
          {bubbles.length > 0 && !eating && (
            <div
              data-testid="bubbles"
              className={`fl-bubbles right-[2%] ${BUBBLE_TOP[stage.id]}`}
            >
              {bubbles.map((b) => (
                <span key={b} className="fl-bubble" aria-hidden="true">
                  {BUBBLE_GLYPH[b]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {flying && (
        <span
          aria-hidden="true"
          className="fl-food-arc pointer-events-none absolute left-1/2 top-[72%] -ml-8 text-6xl"
        >
          {FOOD_GLYPH[flying]}
        </span>
      )}

      {Array.from({ length: alive ? pet.ash : 0 }, (_, i) => (
        <button
          key={i}
          type="button"
          disabled={!canCare}
          onClick={() => clean(pet.id)}
          aria-label="Clean up the ash"
          data-testid="ash"
          className={`absolute grid size-20 place-items-center rounded-full text-5xl active:scale-90 disabled:opacity-70 ${ASH_SPOTS[i]} ${FOCUS_RING}`}
        >
          <span aria-hidden="true">💨</span>
        </button>
      ))}

      {/* Top: back, name, level, needs. */}
      <div
        className={`absolute inset-x-0 top-0 flex flex-col gap-2 ${SAFE_TOP} ${SAFE_SIDES}`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => go({ screen: "shelf" })}
            aria-label="Back to the shelf"
            className={`grid size-16 shrink-0 place-items-center rounded-3xl bg-white/90 text-3xl shadow-lg active:scale-95 dark:bg-slate-800/90 ${FOCUS_RING}`}
          >
            <span aria-hidden="true">🏠</span>
          </button>
          <div className="min-w-0 flex-1 rounded-3xl bg-black/40 px-3 py-1.5 text-white backdrop-blur-sm sm:px-4 sm:py-2">
            <p className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
              <span className="truncate text-lg font-black leading-tight sm:text-xl">
                {pet.name}
              </span>
              <span className="shrink-0 text-xs font-bold leading-tight sm:text-sm">
                Lv {pet.level} · {stage.name}
              </span>
            </p>
            <progress
              aria-label="Experience"
              value={Math.round(pet.xp)}
              max={xpNeeded}
              className="mt-1 block h-3 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-amber-300 [&::-webkit-progress-bar]:bg-white/25 [&::-webkit-progress-value]:bg-amber-300"
            />
          </div>
          <SparkCounter
            ref={counterRef}
            value={Math.max(0, pet.sparks - inFlight)}
          />
          <SoundToggle />
        </div>
        {alive && <Meters pet={pet} />}
        {!alive && (
          <p
            data-testid="ember-hint"
            className="rounded-3xl bg-black/50 px-4 py-3 text-center text-lg font-extrabold text-orange-200"
          >
            {pet.name} is a sleepy ember. Feed it to light it up!{" "}
            <span aria-label={`${pet.relightFeeds} of ${RELIGHT_FEEDS} feeds`}>
              {Array.from({ length: RELIGHT_FEEDS }, (_, i) =>
                i < pet.relightFeeds ? "🔥" : "▫️"
              ).join(" ")}
            </span>
          </p>
        )}
        {alive && !awake && (
          <p
            data-testid="asleep-hint"
            className="rounded-3xl bg-indigo-950/70 px-4 py-2 text-center text-lg font-extrabold text-indigo-100"
          >
            💤 {pet.name} is asleep until morning
          </p>
        )}
      </div>

      {gift && (
        <button
          type="button"
          onClick={() => openGift(pet.id)}
          aria-label="Open the present"
          data-testid="gift"
          className={`fl-gift-bounce absolute right-[max(1rem,env(safe-area-inset-right))] top-[34%] grid size-24 place-items-center rounded-full bg-white/80 text-6xl shadow-xl dark:bg-slate-800/80 ${FOCUS_RING}`}
        >
          <span aria-hidden="true">🎁</span>
        </button>
      )}

      {/* Bottom: the care bar, with a tray above it. */}
      <div
        className={`absolute inset-x-0 bottom-0 ${SAFE_BOTTOM} ${SAFE_SIDES}`}
      >
        <div className="mb-2 flex justify-center">
          {panel === "feed" && <FeedTray pet={pet} onPick={pickFood} />}
          {panel === "emotes" && <EmotePanel pet={pet} onPick={pickEmote} />}
        </div>
        <div className="mx-auto grid max-w-3xl grid-cols-6 gap-1 sm:gap-2">
          <BarButton
            icon="🍖"
            label="Feed"
            active={panel === "feed"}
            disabled={!awake}
            onClick={() => toggle("feed")}
          />
          <BarButton
            icon="🦋"
            label="Play"
            disabled={!canCare}
            onClick={() => setPanel("play")}
          />
          <BarButton
            icon="👒"
            label="Wardrobe"
            onClick={() => setPanel("wardrobe")}
          />
          <BarButton icon="🛒" label="Shop" onClick={() => setPanel("shop")} />
          <BarButton
            icon="💬"
            label="Emotes"
            active={panel === "emotes"}
            onClick={() => toggle("emotes")}
          />
          <BarButton
            icon="🏠"
            label="Shelf"
            onClick={() => go({ screen: "shelf" })}
          />
        </div>
      </div>

      {panel === "wardrobe" && (
        <Wardrobe pet={pet} nowMs={clock} onClose={() => setPanel(null)} />
      )}
      {panel === "shop" && (
        <Shop pet={pet} nowMs={clock} onClose={() => setPanel(null)} />
      )}
      <SparkFlights
        bursts={bursts}
        target={counterRef}
        onLand={handleLand}
        onDone={handleFlightDone}
      />
      {panel === "play" && (
        <FireflyCatch
          onDone={(score) => {
            finishPlay(pet.id, score);
            setPanel(null);
            play("dance");
          }}
        />
      )}
    </div>
  );
}
