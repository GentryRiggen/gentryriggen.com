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
import SoundToggle from "../SoundToggle";
import {
  BIG_BUTTON,
  CARD,
  CHROME_BG,
  FOCUS_RING,
  PRIMARY_BUTTON,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
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

const CODE_FONT = "font-mono";

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
          className={`${CODE_FONT} grid size-12 place-items-center rounded-2xl bg-white text-3xl font-black text-stone-900 shadow-md sm:size-16 sm:text-5xl dark:bg-slate-700 dark:text-amber-50`}
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
      className={`${CARD} flex flex-col items-center gap-3 p-6 text-center`}
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
        className={`${BIG_BUTTON} bg-sky-500 px-6 text-3xl text-white dark:bg-sky-300 dark:text-slate-900`}
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
      className={`${CARD} flex flex-col items-center gap-4 p-4`}
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
                <p className="text-left text-2xl font-black">
                  {onlineName(lookup.card.nameId)}
                  <span className="block text-base font-semibold opacity-75">
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
                  className={`${BIG_BUTTON} bg-emerald-600 px-8 text-4xl text-white`}
                >
                  <span aria-hidden="true">✅</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCode("")}
                  aria-label="Not this one"
                  className={`${BIG_BUTTON} bg-stone-200 px-8 text-4xl dark:bg-slate-600`}
                >
                  <span aria-hidden="true">❌</span>
                </button>
              </div>
            </>
          )}
        </div>
      </CodeKeypad>
      <button
        type="button"
        onClick={onClose}
        className={`${BIG_BUTTON} bg-stone-200 px-6 text-xl dark:bg-slate-600`}
      >
        <span aria-hidden="true">⬅️ </span>Back
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
      className={`${CARD} relative flex flex-col items-center gap-1 p-3`}
    >
      <CardBlob card={friend.card} className="size-32" />
      <span className="text-xl font-extrabold">{name}</span>
      <span className="text-sm font-semibold text-stone-600 dark:text-amber-200/80">
        Lv {friend.card.level}
      </span>
      <button
        type="button"
        disabled={!canPlay}
        onClick={onPlay}
        aria-label={`Playdate with ${name}`}
        data-testid="playdate-button"
        className={`${BIG_BUTTON} relative mt-1 w-full bg-orange-500 px-4 text-3xl text-white dark:bg-orange-400 dark:text-stone-900`}
      >
        <span aria-hidden="true">🎈</span>
        {!canPlay && (
          <span aria-hidden="true" className="absolute right-2 top-1 text-base">
            💤
          </span>
        )}
      </button>
      {confirming ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Yes, remove ${name}`}
            data-testid="remove-yes"
            className={`${BIG_BUTTON} bg-red-600 px-4 text-2xl text-white`}
          >
            <span aria-hidden="true">🗑️</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            aria-label="Keep this friend"
            className={`${BIG_BUTTON} bg-stone-200 px-4 text-2xl dark:bg-slate-600`}
          >
            <span aria-hidden="true">↩️</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Remove ${name} from my friends`}
          className={`absolute right-1 top-1 grid size-12 place-items-center rounded-full text-xl opacity-70 ${FOCUS_RING}`}
        >
          <span aria-hidden="true">🗑️</span>
        </button>
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
      <header className="flex items-center justify-between gap-3 py-2">
        <button
          type="button"
          onClick={back}
          aria-label="Back"
          className={`${BIG_BUTTON} bg-white/90 px-5 text-3xl dark:bg-slate-800/90`}
        >
          <span aria-hidden="true">⬅️</span>
        </button>
        <h1 className="text-3xl font-black tracking-tight">
          <span aria-hidden="true">👫 </span>Friends
        </h1>
        <SoundToggle />
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 py-3">
        {online === "offline" && <CloudOff onRetry={retry} />}

        {!adding && (
          <section
            aria-label="My code"
            className={`${CARD} flex flex-col items-center gap-3 p-4`}
          >
            <CardBlob card={card} className="size-52 sm:size-64" />
            <div className="flex items-center gap-3">
              <span data-testid="my-name" className="text-3xl font-black">
                {onlineName(card.nameId)}
              </span>
              <button
                type="button"
                onClick={() => setNaming(true)}
                aria-label="Change the name friends see"
                data-testid="change-name"
                className={`${BIG_BUTTON} bg-indigo-100 px-4 text-2xl dark:bg-indigo-900`}
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
                  className={`${BIG_BUTTON} bg-sky-500 px-6 text-3xl text-white dark:bg-sky-300 dark:text-slate-900`}
                >
                  <span aria-hidden="true">{copied ? "✅" : "📋"}</span>
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
            className={`${PRIMARY_BUTTON} self-center`}
          >
            <span aria-hidden="true">➕ 👫</span>
          </button>
        )}

        {!adding && friends.length > 0 && (
          <ul
            aria-label="My friends"
            className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))]"
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
            className="py-4 text-center text-6xl"
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
