import { canCare, clamp, earn } from "../actions";
import { happeningWindowAt } from "../happenings";
import {
  MAX_FRIENDS,
  type Friend,
  type Outcome,
  type Pet,
  type PetCard,
  type PetEvent,
} from "../types";
import { isCode } from "./card";
import { isNameId } from "./names";

/** A playdate you start: joy and sparks, once per friend per check-in window. */
export const PLAYDATE_REWARD = { joy: 15, sparks: 10 } as const;
/** A friend's visit that you receive. */
export const VISITED_REWARD = { joy: 10, sparks: 5 } as const;

const none = (pet: Pet): Outcome => ({ pet, events: [] });

const withOnline = (pet: Pet, patch: Partial<Pet["online"]>): Pet => ({
  ...pet,
  online: { ...pet.online, ...patch },
});

export function isFriend(pet: Pet, code: string): boolean {
  return pet.online.friends.some((f) => f.code === code);
}

/** The pet's card now exists online under `code`. */
export function setCode(pet: Pet, code: string): Pet {
  return isCode(code) && pet.online.code === null
    ? withOnline(pet, { code })
    : pet;
}

/** Picks the pet's online name from the list. */
export function setOnlineName(pet: Pet, nameId: number): Pet {
  return isNameId(nameId) ? withOnline(pet, { nameId }) : pet;
}

/** Adds a friend. Ignored for a bad code, your own code, a repeat or a full list. */
export function addFriend(pet: Pet, friend: Friend): Outcome {
  if (
    !isCode(friend.code) ||
    friend.code === pet.online.code ||
    isFriend(pet, friend.code) ||
    pet.online.friends.length >= MAX_FRIENDS
  ) {
    return none(pet);
  }
  return {
    pet: withOnline(pet, { friends: [...pet.online.friends, friend] }),
    events: [{ type: "friend", action: "add" }],
  };
}

/** Removes a friend from this device only. */
export function removeFriend(pet: Pet, code: string): Pet {
  const { [code]: _played, ...played } = pet.online.played;
  void _played;
  return withOnline(pet, {
    friends: pet.online.friends.filter((f) => f.code !== code),
    played,
  });
}

/** Keeps a friend's cached look up to date. */
export function updateFriend(pet: Pet, code: string, card: PetCard): Pet {
  return withOnline(pet, {
    friends: pet.online.friends.map((f) =>
      f.code === code ? { ...f, card } : f
    ),
  });
}

/** Whether a playdate with this friend pays right now. */
export function canPlaydate(pet: Pet, code: string, now: number): boolean {
  return (
    isFriend(pet, code) &&
    canCare(pet, now) &&
    pet.online.played[code] !== happeningWindowAt(now)
  );
}

/** Finishes a playdate: joy and sparks, once per friend per window. */
export function playdate(pet: Pet, code: string, now: number): Outcome {
  if (!canPlaydate(pet, code, now)) return none(pet);
  const events: PetEvent[] = [{ type: "friend", action: "playdate" }];
  const cheered = {
    ...withOnline(pet, {
      played: { ...pet.online.played, [code]: happeningWindowAt(now) },
    }),
    joy: clamp(pet.joy + PLAYDATE_REWARD.joy),
  };
  return {
    pet: earn(cheered, PLAYDATE_REWARD.sparks, "friend", events),
    events,
  };
}

/** A friend's visit was received (only from a friend in the list). */
export function receiveVisit(pet: Pet, code: string): Outcome {
  if (!isFriend(pet, code)) return none(pet);
  const events: PetEvent[] = [{ type: "friend", action: "visited" }];
  const cheered = { ...pet, joy: clamp(pet.joy + VISITED_REWARD.joy) };
  return {
    pet: earn(cheered, VISITED_REWARD.sparks, "friend", events),
    events,
  };
}
