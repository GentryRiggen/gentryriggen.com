import { useEffect, useState } from "react";
import {
  addFriend,
  collectVisits,
  ensureCode,
  lookupFriend,
  refreshFriends,
} from "@/lib/flamelings/online/controller";
import { cardOf, CODE_LENGTH } from "@/lib/flamelings/online/card";
import { canPlaydate } from "@/lib/flamelings/online/friendActions";
import { onlineName } from "@/lib/flamelings/online/names";
import { stageTitle } from "@/lib/flamelings/status";
import { useFlamelings } from "@/lib/flamelings/store";
import type { Friend, PetCard } from "@/lib/flamelings/types";
import { MAX_FRIENDS } from "@/lib/flamelings/types";
import FlIcon from "../FlIcon";
import PanelHeader from "../PanelHeader";
import SoundToggle from "../SoundToggle";
import {
  CHROME_BG,
  DISPLAY,
  FOCUS_RING,
  JAR_CARD,
  PRIMARY_BUTTON,
  PRIMARY_BUTTON_BASE,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
  STICKER,
  STICKER_BUTTON,
} from "../styles";
import CardBlob from "./CardBlob";
import CodeKeypad from "./CodeKeypad";
import NamePicker from "./NamePicker";
import PlaydateScene from "./PlaydateScene";

type Online = "checking" | "online" | "offline";

type Lookup =
  | { kind: "idle" }
  | { kind: "looking" }
  | { kind: "found"; card: PetCard }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "self" }
  | { kind: "already" };

/** A round blue action button (copy, retry), like the shelf's friends button. */
const BLUE_BUTTON = `grid size-16 shrink-0 place-items-center rounded-full border-4 border-[#fff6e6] bg-[#7cc4ff] text-3xl shadow-[inset_0_-4px_0_rgba(0,0,0,.15),0_4px_10px_rgba(30,10,40,.25)] transition-transform active:translate-y-[2px] ${FOCUS_RING}`;

/** A green "yes" button. */
const YES_BUTTON = `grid min-h-16 min-w-24 place-items-center rounded-3xl bg-gradient-to-b from-[#6ee7a0] to-[#22b864] px-6 shadow-[0_5px_0_#15803d,0_10px_20px_rgba(30,10,40,.25)] transition-transform active:translate-y-[3px] ${FOCUS_RING}`;

/** The big code, one box per letter. */
function CodeBoxes({ code }: { code: string }) {
  return (
    <p
      data-testid="my-code"
      aria-label={`Your code is ${[...code].join(" ")}`}
      role="img"
      className="flex gap-1.5 sm:gap-2"
    >
      {[...code].map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`${DISPLAY} grid h-14 w-12 place-items-center rounded-2xl bg-[#fff6e6] text-4xl font-bold text-[#3a2340] shadow-[0_4px_0_#e7c9a3,0_8px_16px_rgba(30,10,40,.18)] sm:h-20 sm:w-16 sm:text-5xl`}
        >
          {ch}
        </span>
      ))}
    </p>
  );
}

function CloudOff({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      data-testid="friends-offline"
      className={`${STICKER} fl-pop-in flex flex-col items-center gap-3 p-6 text-center`}
    >
      <span
        role="img"
        aria-label="No connection to friends right now"
        className="text-7xl"
      >
        ☁️🚫
      </span>
      <button
        type="button"
        onClick={onRetry}
        aria-label="Try again"
        className={BLUE_BUTTON}
      >
        <span aria-hidden="true">🔄</span>
      </button>
    </div>
  );
}

/** Add a friend: the keypad, then their pet to look at before confirming. */
function AddFriend({ petId, onClose }: { petId: string; onClose: () => void }) {
  const pet = useFlamelings((s) => s.save.pets.find((p) => p.id === petId));
  const [code, setCode] = useState("");
  const [remote, setRemote] = useState<{ code: string; result: Lookup } | null>(
    null
  );

  const own = pet?.online.code ?? null;
  const known = pet?.online.friends.some((f) => f.code === code) ?? false;
  const settled: Lookup | null =
    code.length !== CODE_LENGTH
      ? { kind: "idle" }
      : code === own
        ? { kind: "self" }
        : known
          ? { kind: "already" }
          : null;
  const lookup: Lookup =
    settled ?? (remote?.code === code ? remote.result : { kind: "looking" });

  useEffect(() => {
    if (settled) return;
    let cancelled = false;
    void lookupFriend(code).then((found) => {
      if (cancelled) return;
      setRemote({
        code,
        result: found.kind === "found" ? found : { kind: found.kind },
      });
    });
    return () => {
      cancelled = true;
    };
    // `settled` is a function of code, own and known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, own, known]);

  function confirm(card: PetCard) {
    if (addFriend(petId, { code, card })) onClose();
  }

  return (
    <div
      role="group"
      aria-label="Add a friend"
      data-testid="add-friend"
      className={`${JAR_CARD} fl-sheet-up flex flex-col items-center gap-4 px-2 py-4 sm:p-5`}
    >
      <CodeKeypad
        value={code}
        onChange={setCode}
        hideKeys={lookup.kind === "found"}
      >
        <div
          aria-live="polite"
          data-testid="lookup"
          data-state={lookup.kind}
          className={`flex w-full flex-col items-center justify-center gap-3 ${lookup.kind === "idle" ? "" : "min-h-24"}`}
        >
          {lookup.kind === "looking" && (
            <span role="img" aria-label="Looking" className="text-6xl">
              🔎
            </span>
          )}
          {lookup.kind === "missing" && (
            <span
              role="img"
              aria-label="No pet has that code"
              className="text-6xl"
            >
              🤷
            </span>
          )}
          {lookup.kind === "error" && (
            <span
              role="img"
              aria-label="Cannot reach friends right now"
              className="text-6xl"
            >
              ☁️🚫
            </span>
          )}
          {lookup.kind === "self" && (
            <span
              role="img"
              aria-label="That is your own code"
              className="text-6xl"
            >
              🪞
            </span>
          )}
          {lookup.kind === "already" && (
            <span
              role="img"
              aria-label="Already your friend"
              className="text-6xl"
            >
              ✅
            </span>
          )}
          {lookup.kind === "found" && (
            <>
              <div
                className="flex items-center gap-3"
                data-testid="friend-preview"
              >
                <CardBlob
                  card={lookup.card}
                  mood="excited"
                  className="size-40"
                />
                <p className={`${DISPLAY} text-left text-3xl font-bold`}>
                  {onlineName(lookup.card.nameId)}
                  <span className="block font-sans text-base font-extrabold text-[#7a5a78] dark:text-[#c9a9d6]">
                    Lv {lookup.card.level} ·{" "}
                    {stageTitle(
                      lookup.card.level,
                      lookup.card.form === "none" ? null : lookup.card.form
                    )}
                  </span>
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => confirm(lookup.card)}
                  aria-label="Add this friend"
                  data-testid="confirm-friend"
                  className={YES_BUTTON}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-11 place-items-center rounded-full bg-[#fff6e6]"
                  >
                    <FlIcon name="check" className="size-8" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCode("")}
                  aria-label="Not this one"
                  className={`${STICKER_BUTTON} size-16`}
                >
                  <FlIcon name="close" className="size-8" />
                </button>
              </div>
            </>
          )}
        </div>
      </CodeKeypad>
      <button
        type="button"
        onClick={onClose}
        className={`${DISPLAY} flex min-h-16 items-center gap-1 rounded-full bg-[#fff6e6] pl-4 pr-6 text-xl font-semibold text-[#3a2340] shadow-[0_4px_0_#e7c9a3,0_8px_18px_rgba(30,10,40,.25)] transition-transform active:translate-y-[3px] ${FOCUS_RING}`}
      >
        <FlIcon name="back" className="size-7" />
        Back
      </button>
    </div>
  );
}

function FriendCard({
  friend,
  canPlay,
  onPlay,
  onRemove,
}: {
  friend: Friend;
  canPlay: boolean;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const name = onlineName(friend.card.nameId);
  return (
    <li
      data-testid="friend-card"
      className={`${JAR_CARD} fl-pop-in flex flex-col items-center gap-1 px-3 pb-3 pt-5`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-3 w-2/5 -translate-x-1/2 rounded-b-xl bg-gradient-to-b from-[#c98a55] to-[#8a5230]"
      />
      <CardBlob card={friend.card} className="size-32" />
      <span className={`${DISPLAY} max-w-full truncate text-2xl font-bold`}>
        {name}
      </span>
      <span className="text-sm font-extrabold text-[#7a5a78] dark:text-[#c9a9d6]">
        Lv {friend.card.level}
      </span>
      <div className="mt-1 flex w-full gap-2">
        <button
          type="button"
          disabled={!canPlay}
          onClick={onPlay}
          aria-label={`Playdate with ${name}`}
          data-testid="playdate-button"
          className={`${PRIMARY_BUTTON_BASE} relative grid flex-1 place-items-center px-4 py-4 text-3xl`}
        >
          <span aria-hidden="true">🎈</span>
          {!canPlay && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-2 grid size-8 place-items-center rounded-full bg-[#e0e7ff] text-base shadow"
            >
              💤
            </span>
          )}
        </button>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Remove ${name} from my friends`}
            className={`grid size-16 shrink-0 place-items-center rounded-full bg-[#fff6e6]/80 text-2xl shadow-[0_2px_0_#e7c9a3] ${FOCUS_RING}`}
          >
            <span aria-hidden="true">🗑️</span>
          </button>
        )}
      </div>
      {confirming && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Yes, remove ${name}`}
            data-testid="remove-yes"
            className={`grid size-16 place-items-center rounded-full bg-gradient-to-b from-[#ff6b5a] to-[#e0352b] text-2xl shadow-[0_4px_0_#a8231b] transition-transform active:translate-y-[3px] ${FOCUS_RING}`}
          >
            <span aria-hidden="true">🗑️</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            aria-label="Keep this friend"
            className={`${STICKER_BUTTON} size-16 text-2xl`}
          >
            <span aria-hidden="true">↩️</span>
          </button>
        </div>
      )}
    </li>
  );
}

/** One pet's friends: its code, adding a friend, the friend list and playdates. */
export default function FriendsScreen({
  petId,
  from,
}: {
  petId: string;
  from: "shelf" | "pet";
}) {
  const pet = useFlamelings((s) => s.save.pets.find((p) => p.id === petId));
  const clock = useFlamelings((s) => s.clock);
  const go = useFlamelings((s) => s.go);
  const chooseName = useFlamelings((s) => s.chooseOnlineName);
  const removeFriend = useFlamelings((s) => s.removeFriend);
  const [online, setOnline] = useState<Online>("checking");
  const [adding, setAdding] = useState(false);
  const [naming, setNaming] = useState(false);
  const [playingWith, setPlayingWith] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pet) go({ screen: "shelf" });
  }, [pet, go]);

  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    setOnline("checking");
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await ensureCode(petId);
      if (cancelled) return;
      setOnline(ok ? "online" : "offline");
      if (ok) await Promise.all([refreshFriends(petId), collectVisits(true)]);
    })();
    return () => {
      cancelled = true;
    };
  }, [petId, attempt]);

  if (!pet) return null;

  const code = pet.online.code;
  const card = cardOf(pet);
  const friends = pet.online.friends;
  const playing = friends.find((f) => f.code === playingWith);
  const back = () =>
    go(from === "pet" ? { screen: "pet", petId } : { screen: "shelf" });

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the code is on screen to read out.
    }
  }

  return (
    <div
      className={`flex h-full flex-col overflow-y-auto overflow-x-hidden ${CHROME_BG} ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
      data-testid="friends-screen"
    >
      <div className="mx-auto w-full max-w-3xl">
        <PanelHeader
          icon="friends"
          iconClass="bg-[#7cc4ff]"
          title="Friends"
          level={1}
          lead={
            <button
              type="button"
              onClick={back}
              aria-label="Back"
              className={`${STICKER_BUTTON} size-16 shrink-0`}
            >
              <FlIcon name="back" className="size-8" />
            </button>
          }
        >
          <SoundToggle />
        </PanelHeader>
      </div>

      {/* The slide-up sits on the content, not the screen: a transform would
          trap the fixed playdate and name picker inside this scroll box. */}
      <main className="fl-sheet-up mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 py-3">
        {online === "offline" && <CloudOff onRetry={retry} />}

        {!adding && (
          <section
            aria-label="My code"
            className={`${JAR_CARD} flex flex-col items-center gap-3 px-3 pb-6 pt-5 sm:px-6`}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-0 h-3 w-1/3 -translate-x-1/2 rounded-b-xl bg-gradient-to-b from-[#c98a55] to-[#8a5230]"
            />
            <CardBlob card={card} className="size-52 sm:size-64" />
            <div className="flex items-center gap-3">
              <span
                data-testid="my-name"
                className={`${DISPLAY} text-3xl font-bold sm:text-4xl`}
              >
                {onlineName(card.nameId)}
              </span>
              <button
                type="button"
                onClick={() => setNaming(true)}
                aria-label="Change the name friends see"
                data-testid="change-name"
                className={`${STICKER_BUTTON} size-16 text-2xl`}
              >
                <span aria-hidden="true">🏷️</span>
              </button>
            </div>
            {code ? (
              <>
                <CodeBoxes code={code} />
                <button
                  type="button"
                  onClick={() => void copy()}
                  aria-label={copied ? "Copied" : "Copy my code"}
                  data-testid="copy-code"
                  className={BLUE_BUTTON}
                >
                  {copied ? (
                    <span
                      aria-hidden="true"
                      className="grid size-10 place-items-center rounded-full bg-[#fff6e6]"
                    >
                      <FlIcon name="check" className="size-7" />
                    </span>
                  ) : (
                    <span aria-hidden="true">📋</span>
                  )}
                </button>
              </>
            ) : (
              online === "checking" && (
                <span
                  role="img"
                  aria-label="Getting your code"
                  className="text-5xl"
                >
                  ⏳
                </span>
              )
            )}
          </section>
        )}

        {adding ? (
          <AddFriend petId={petId} onClose={() => setAdding(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={friends.length >= MAX_FRIENDS}
            aria-label="Add a friend"
            data-testid="add-friend-button"
            className={`${PRIMARY_BUTTON} flex items-center gap-2 self-center`}
          >
            <FlIcon name="plus" className="size-8" />
            <FlIcon name="friends" className="size-9" />
          </button>
        )}

        {!adding && friends.length > 0 && (
          <ul
            aria-label="My friends"
            className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))]"
          >
            {friends.map((friend) => (
              <FriendCard
                key={friend.code}
                friend={friend}
                canPlay={canPlaydate(pet, friend.code, clock)}
                onPlay={() => setPlayingWith(friend.code)}
                onRemove={() => removeFriend(petId, friend.code)}
              />
            ))}
          </ul>
        )}
        {!adding && friends.length === 0 && (
          <p
            role="img"
            aria-label="No friends yet. Add a friend with their code."
            className="mx-auto rounded-full bg-white/40 px-8 py-4 text-center text-6xl dark:bg-white/[.06]"
          >
            👫❓
          </p>
        )}
      </main>

      {naming && (
        <NamePicker
          selected={card.nameId}
          onPick={(id) => {
            chooseName(petId, id);
            setNaming(false);
          }}
          onClose={() => setNaming(false)}
        />
      )}
      {playing && (
        <PlaydateScene
          pet={pet}
          friend={playing}
          onClose={() => setPlayingWith(null)}
        />
      )}
    </div>
  );
}
