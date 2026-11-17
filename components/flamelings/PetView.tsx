import { useCallback, useEffect, useRef, useState } from "react";
import {
  FOOD_GLYPH,
  type EmoteId,
  type FoodId,
} from "@/lib/flamelings/catalog";
import { sparkRoundsLeft } from "@/lib/flamelings/actions";
import { currentHappening } from "@/lib/flamelings/happenings";
import { hasGiftWaiting, stageFor, xpToNext } from "@/lib/flamelings/progress";
import { isAwake, moodOf, RELIGHT_FEEDS } from "@/lib/flamelings/sim";
import {
  emotesOf,
  fadeLevel,
  stageTitle,
  tidiness,
} from "@/lib/flamelings/status";
import { playSound } from "@/lib/flamelings/sound";
import { useFlamelings } from "@/lib/flamelings/store";
import EmotePanel from "./EmotePanel";
import FlIcon, { type FlIconName } from "./FlIcon";
import FeedTray from "./FeedTray";
import FireflyCatch from "./FireflyCatch";
import LogStack from "./LogStack";
import MarshmallowToast from "./MarshmallowToast";
import PlayPicker from "./PlayPicker";
import Glade from "./Glade";
import HappeningLayer from "./HappeningLayer";
import Blob from "./Blob";
import Meters from "./Meters";
import Shop from "./Shop";
import SoundToggle from "./SoundToggle";
import SparkCounter from "./SparkCounter";
import SparkFlights, { FLIGHT_TOTAL_MS, type Burst } from "./SparkFlights";
import Wardrobe from "./Wardrobe";
import {
  DISPLAY,
  FOCUS_RING,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
  STICKER,
  STICKER_BUTTON,
} from "./styles";
import type { Pet, PlayGame } from "@/lib/flamelings/types";
import { useEmote } from "./useEmote";

type Panel = "feed" | "emotes" | "wardrobe" | "shop" | "play" | null;

/** Where each uncleaned ash pile sits on the glade floor (centred, in the stage). */
const ASH_SPOTS = [
  "left-[12%] top-[78%]",
  "left-[88%] top-[80%]",
  "left-[25%] top-[89%]",
  "left-[75%] top-[90%]",
];

/**
 * The glade's box: everything above the dock (two rows of tiles on phones,
 * one from `sm`). The ground runs on under the dock.
 */
const STAGE =
  "fl-stage absolute inset-x-0 top-0 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))_+_10.25rem)] sm:bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))_+_6.25rem)]";

/** Where the wish bubble sits above the pet, by stage (the pet shrinks towards its feet). */
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

/** What the pet wishes for, by its lowest need. */
const WISH_TEXT = {
  fuel: "Snack time?",
  joy: "Play with me!",
  tidy: "It's messy!",
} as const;

type Need = keyof typeof WISH_TEXT;

/** The lowest need under 30, or null when the pet is content. */
function lowestNeed(pet: Pet): Need | null {
  const needs: [Need, number][] = [
    ["fuel", pet.fuel],
    ["joy", pet.joy],
    ["tidy", tidiness(pet)],
  ];
  let found: [Need, number] | null = null;
  for (const need of needs) {
    if (need[1] < 30 && (!found || need[1] < found[1])) found = need;
  }
  return found ? found[0] : null;
}

const RING_LENGTH = 2 * Math.PI * 21;

function BarButton({
  icon,
  iconClass,
  label,
  text,
  active,
  disabled,
  hot,
  badge,
  onClick,
}: {
  icon: FlIconName;
  /** The background class of the rounded square behind the icon. */
  iconClass: string;
  /** The accessible name. */
  label: string;
  /** What the tile shows, when it should differ from the name. */
  text?: string;
  active?: boolean;
  disabled?: boolean;
  /** A need this action answers is running low: a red "!" in the corner. */
  hot?: boolean;
  /** A tiny icon in the corner (decoration; the label stays the name). */
  badge?: { glyph: string; testId: string };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      className={`${DISPLAY} relative flex min-h-[4.5rem] min-w-16 flex-col items-center justify-center gap-0.5 rounded-3xl sm:min-h-[5.25rem] sm:gap-1 px-0.5 text-base font-semibold text-[#3a2340] transition-transform active:translate-y-[2px] disabled:opacity-40 disabled:active:translate-y-0 sm:text-lg ${FOCUS_RING} ${
        active ? "bg-[#ffd9b0]" : hot ? "bg-[#ffe9cc]" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid size-11 place-items-center rounded-2xl sm:size-[50px] shadow-[inset_0_-4px_0_rgba(0,0,0,.15)] ${iconClass}`}
      >
        <FlIcon name={icon} className="size-7 sm:size-8" />
      </span>
      <span aria-hidden="true">{text ?? label}</span>
      {hot && !badge && (
        <span
          aria-hidden="true"
          data-testid="need-badge"
          className="absolute right-1 top-1 grid size-[22px] place-items-center rounded-full bg-[#ef4444] text-[13px] font-bold leading-none text-white shadow-[0_0_0_3px_#fff6e6]"
        >
          !
        </span>
      )}
      {badge && (
        <span
          aria-hidden="true"
          data-testid={badge.testId}
          className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-indigo-100 text-xs shadow dark:bg-indigo-200"
        >
          {badge.glyph}
        </span>
      )}
    </button>
  );
}

function PlayGameScreen({
  game,
  pet,
  onDone,
}: {
  game: PlayGame;
  pet: Pet;
  onDone: (score: number) => void;
}) {
  if (game === "marshmallow")
    return <MarshmallowToast pet={pet} onDone={onDone} />;
  if (game === "logs") return <LogStack pet={pet} onDone={onDone} />;
  return <FireflyCatch onDone={onDone} />;
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
  const countEmote = useFlamelings((s) => s.emote);
  const [panel, setPanel] = useState<Panel>(null);
  const [game, setGame] = useState<PlayGame | null>(null);
  const [flying, setFlying] = useState<FoodId | null>(null);
  const [eating, setEating] = useState(false);
  const [shaking, setShaking] = useState(0);
  /** Taps so far: each one replays the squish (it flips between a and b). */
  const [squishes, setSquishes] = useState(0);
  const { emote, emoteKey, play } = useEmote();
  const timers = useRef<number[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [burstPet, setBurstPet] = useState(petId);
  /** Sparks earned but still flying: the counter does not show them yet. */
  const [inFlight, setInFlight] = useState(0);
  /** Sparks of each burst that have not landed yet, by burst id. */
  const unlanded = useRef(new Map<number, number>());
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
        const id = last.id;
        unlanded.current.set(id, amount);
        setInFlight((n) => n + amount);
        setBursts((list) => [...list, { id, amount, x: from.x, y: from.y }]);
        // If the animation never reports back (a hidden page, a browser
        // without it), settle the burst anyway so the counter catches up.
        timers.current.push(
          window.setTimeout(() => {
            const rest = unlanded.current.get(id);
            if (rest === undefined) return;
            unlanded.current.delete(id);
            setInFlight((n) => Math.max(0, n - rest));
            setBursts((list) => list.filter((b) => b.id !== id));
          }, FLIGHT_TOTAL_MS + 500)
        );
      }),
    [petId]
  );

  const handleLand = useCallback((sparks: number, id: number) => {
    const rest = unlanded.current.get(id);
    if (rest === undefined) return;
    unlanded.current.set(id, rest - sparks);
    setInFlight((n) => Math.max(0, n - sparks));
    playSound("coin");
  }, []);
  const handleFlightDone = useCallback((id: number) => {
    unlanded.current.delete(id);
    setBursts((list) => list.filter((b) => b.id !== id));
  }, []);

  // A different pet starts with nothing in flight (reset while rendering).
  if (burstPet !== petId) {
    setBurstPet(petId);
    setInFlight(0);
    setBursts([]);
  }

  if (!pet) return null;

  const awake = isAwake(clock);
  const alive = pet.state === "alive";
  const canCare = awake && alive;
  const stage = stageFor(pet.level);
  const baseMood = moodOf(pet, clock);
  const mood = eating && alive ? "eating" : baseMood;
  const gift = hasGiftWaiting(pet, clock) && awake;

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
    setSquishes((n) => n + 1);
    if (!awake) {
      play("sleepy");
      return;
    }
    tapPet(pet.id);
    const known = emotesOf(pet);
    play(known[Math.floor(Math.random() * known.length)] ?? "love");
  }

  function pickEmote(choice: EmoteId) {
    if (pet) countEmote(pet.id);
    play(choice);
    setPanel(null);
  }

  function toggle(next: Exclude<Panel, null>) {
    setPanel((current) => (current === next ? null : next));
  }

  const xpNeeded = xpToNext(pet.level);
  const xpLeft = Math.max(0, Math.ceil(xpNeeded - pet.xp));
  const xpFraction = Math.min(1, Math.max(0, pet.xp / xpNeeded));
  const need = lowestNeed(pet);
  const happening = currentHappening(pet, clock);
  const happeningOpen = happening !== null && !happening.done;
  const showWish =
    canCare && need !== null && !panel && !game && !happeningOpen && !eating;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-slate-900"
      onPointerDownCapture={(e) => {
        lastTap.current = { x: e.clientX, y: e.clientY, at: Date.now() };
      }}
    >
      <div className={STAGE}>
        <Glade nowMs={clock} decor={pet.decor} />

        {/* The pet is the campfire: its feet rest in the logs. */}
        <div className="fl-hearth-anchor absolute left-1/2">
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
              data-squish={
                squishes === 0 ? undefined : squishes % 2 ? "a" : "b"
              }
              className={`fl-hearth-pet block rounded-full ${FOCUS_RING}`}
            >
              <Blob
                look={pet.look}
                worn={pet.worn}
                form={pet.form}
                fade={fadeLevel(pet)}
                mood={mood}
                stage={stage.id}
                emote={emote}
                emoteKey={emoteKey}
                className="size-full"
              />
            </button>
            {showWish && need && (
              <div
                aria-hidden="true"
                data-testid="wish-bubble"
                className={`fl-wish absolute left-[-6%] ${BUBBLE_TOP[stage.id]} whitespace-nowrap rounded-[20px] bg-white px-4 py-2 text-lg font-semibold text-[#3a2340] shadow-[0_8px_20px_rgba(30,10,40,.3)] after:absolute after:-bottom-2.5 after:left-[18px] after:border-x-[10px] after:border-t-[10px] after:border-x-transparent after:border-t-white after:content-[''] ${DISPLAY}`}
              >
                {WISH_TEXT[need]}
              </div>
            )}
          </div>
        </div>
      </div>

      <HappeningLayer
        pet={pet}
        clock={clock}
        paused={panel === "wardrobe" || panel === "shop" || panel === "play"}
        onCheer={(emote) => play(emote ?? "laugh")}
      />

      <div className={`${STAGE} pointer-events-none`}>
        {flying && (
          <div className="fl-hearth-anchor absolute left-1/2">
            <span aria-hidden="true" className="fl-food-arc block text-6xl">
              {FOOD_GLYPH[flying]}
            </span>
          </div>
        )}

        {Array.from({ length: alive ? pet.ash : 0 }, (_, i) => (
          <button
            key={i}
            type="button"
            disabled={!canCare}
            onClick={() => clean(pet.id)}
            aria-label="Clean up the ash"
            data-testid="ash"
            className={`pointer-events-auto absolute grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-5xl active:scale-90 disabled:opacity-70 ${ASH_SPOTS[i]} ${FOCUS_RING}`}
          >
            <span aria-hidden="true">💨</span>
          </button>
        ))}
      </div>

      {/* Top: back, name, level, needs. */}
      <div
        className={`absolute inset-x-0 top-0 flex flex-col gap-2 ${SAFE_TOP} ${SAFE_SIDES}`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 sm:flex-nowrap sm:gap-x-3">
          <button
            type="button"
            onClick={() => go({ screen: "shelf" })}
            aria-label="Back to the shelf"
            className={`${STICKER_BUTTON} size-16 shrink-0`}
          >
            <FlIcon name="home" className="size-8" />
          </button>
          <div
            className={`${DISPLAY} flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-[#fff6e6] p-1 pr-2 text-[#3a2340] shadow-[0_4px_0_#e7c9a3,0_10px_24px_rgba(30,10,40,.35)] sm:flex-none sm:gap-3 sm:p-1.5 sm:pr-5`}
          >
            <div
              role="progressbar"
              aria-label="Experience"
              aria-valuenow={Math.round(pet.xp)}
              aria-valuemin={0}
              aria-valuemax={xpNeeded}
              className="relative size-11 shrink-0 sm:size-[52px]"
            >
              <svg
                viewBox="0 0 52 52"
                aria-hidden="true"
                className="absolute inset-0"
              >
                <circle
                  cx="26"
                  cy="26"
                  r="21"
                  fill="#fff"
                  stroke="#f3dcc0"
                  strokeWidth="6"
                />
                <circle
                  cx="26"
                  cy="26"
                  r="21"
                  fill="none"
                  stroke="#ff8a3d"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={RING_LENGTH}
                  strokeDashoffset={RING_LENGTH * (1 - xpFraction)}
                  transform="rotate(-90 26 26)"
                />
              </svg>
              <span
                aria-hidden="true"
                className="absolute inset-0 grid place-items-center text-base font-bold text-[#c2410c] sm:text-xl"
              >
                {pet.level}
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-none sm:text-[22px]">
                {pet.name}
              </p>
              <p className="mt-1 truncate font-sans text-[11px] font-extrabold leading-none text-[#7a5a78] sm:text-[13px]">
                {stageTitle(pet.level, pet.form)} · {xpLeft} to grow
              </p>
            </div>
          </div>
          {alive && (
            <div className="order-last basis-full sm:order-none sm:basis-auto">
              <Meters pet={pet} />
            </div>
          )}
          <div className="hidden flex-1 sm:block" />
          <SparkCounter
            ref={counterRef}
            className="max-sm:ml-auto"
            value={Math.max(0, pet.sparks - inFlight)}
          />
          <SoundToggle />
        </div>
        {!alive && (
          <p
            data-testid="ember-hint"
            className={`${STICKER} px-4 py-3 text-center text-lg font-extrabold text-[#c2410c]`}
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
            className="rounded-3xl bg-indigo-950/70 px-4 py-2 text-center text-lg font-extrabold text-indigo-100 backdrop-blur-sm"
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
          className={`fl-gift-bounce absolute right-[max(1rem,env(safe-area-inset-right))] top-[25%] grid size-20 place-items-center rounded-full bg-white/80 text-5xl sm:top-[47%] sm:size-24 sm:text-6xl shadow-xl dark:bg-slate-800/80 ${FOCUS_RING}`}
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
        <div
          className={`mx-auto grid max-w-3xl grid-cols-3 gap-1 rounded-[34px] bg-[#fff6e6]/95 p-2 shadow-[0_6px_0_#e2c19a,0_18px_40px_rgba(30,10,40,.45)] sm:grid-cols-6 sm:gap-2`}
        >
          <BarButton
            icon="feed"
            iconClass="bg-[#ffb36b]"
            label="Feed"
            active={panel === "feed"}
            disabled={!awake}
            hot={canCare && pet.fuel < 30}
            onClick={() => toggle("feed")}
          />
          <BarButton
            icon="play"
            iconClass="bg-[#b69cff]"
            label="Play"
            disabled={!canCare}
            hot={canCare && pet.joy < 30}
            badge={
              canCare && sparkRoundsLeft(pet, clock) === 0
                ? { glyph: "💤", testId: "sparks-resting" }
                : undefined
            }
            onClick={() => setPanel("play")}
          />
          <BarButton
            icon="dress"
            iconClass="bg-[#ff8fb1]"
            label="Wardrobe"
            text="Dress up"
            onClick={() => setPanel("wardrobe")}
          />
          <BarButton
            icon="shop"
            iconClass="bg-[#ffd166]"
            label="Shop"
            onClick={() => setPanel("shop")}
          />
          <BarButton
            icon="emotes"
            iconClass="bg-[#6fd3a8]"
            label="Emotes"
            active={panel === "emotes"}
            onClick={() => toggle("emotes")}
          />
          <BarButton
            icon="friends"
            iconClass="bg-[#7cc4ff]"
            label="Friends"
            onClick={() => go({ screen: "friends", petId, from: "pet" })}
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
      {panel === "play" && !game && (
        <PlayPicker
          roundsLeft={sparkRoundsLeft(pet, clock)}
          onPick={setGame}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === "play" && game && (
        <PlayGameScreen
          game={game}
          pet={pet}
          onDone={(score) => {
            finishPlay(pet.id, game, score);
            setGame(null);
            setPanel(null);
            play("dance");
          }}
        />
      )}
    </div>
  );
}
