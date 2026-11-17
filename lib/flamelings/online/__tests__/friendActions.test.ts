import { createPet } from "../../actions";
import { happeningWindowAt } from "../../happenings";
import { MAX_FRIENDS, type Friend, type Pet } from "../../types";
import {
  PLAYDATE_REWARD,
  VISITED_REWARD,
  addFriend,
  canPlaydate,
  playdate,
  receiveVisit,
  removeFriend,
  setCode,
  setOnlineName,
  updateFriend,
} from "../friendActions";
import { FRIEND_CARD } from "../testing/fakeBackend";

const NOON = new Date(2026, 10, 17, 12).getTime();
const look = { colour: "ember", shape: "flame", eyes: "round" } as const;
const base = (patch: Partial<Pet> = {}): Pet => ({
  ...createPet({ id: "p", name: "Pip", look, now: NOON }),
  joy: 50,
  ...patch,
});
const friend = (code = "GHJKMN"): Friend => ({ code, card: FRIEND_CARD });
const withFriend = (pet = base()) => addFriend(pet, friend()).pet;

describe("friends list", () => {
  it("adds a friend and reports it", () => {
    const out = addFriend(base(), friend());
    expect(out.pet.online.friends).toEqual([friend()]);
    expect(out.events).toEqual([{ type: "friend", action: "add" }]);
  });

  it("ignores a repeat, your own code, a bad code and a full list", () => {
    const pet = withFriend();
    expect(addFriend(pet, friend()).events).toEqual([]);
    expect(addFriend(pet, friend("abc")).pet).toBe(pet);
    const mine = setCode(base(), "ABCDEF");
    expect(addFriend(mine, friend("ABCDEF")).pet).toBe(mine);
    const codes = [..."BCDEFGHJKMNPQRSTUVWX"].map((c) => `AAAAA${c}`);
    const full = codes.reduce((p, c) => addFriend(p, friend(c)).pet, base());
    expect(full.online.friends).toHaveLength(MAX_FRIENDS);
    expect(addFriend(full, friend("ZZZZZZ")).pet).toBe(full);
  });

  it("removes a friend and its playdate mark, only locally", () => {
    const played = playdate(withFriend(), "GHJKMN", NOON).pet;
    expect(played.online.played.GHJKMN).toBeDefined();
    const gone = removeFriend(played, "GHJKMN");
    expect(gone.online.friends).toEqual([]);
    expect(gone.online.played).toEqual({});
  });

  it("updates a friend's cached card", () => {
    const next = updateFriend(withFriend(), "GHJKMN", {
      ...FRIEND_CARD,
      level: 9,
    });
    expect(next.online.friends[0].card.level).toBe(9);
  });

  it("sets a code once and a valid online name", () => {
    const pet = setCode(base(), "ABCDEF");
    expect(pet.online.code).toBe("ABCDEF");
    expect(setCode(pet, "GHJKMN").online.code).toBe("ABCDEF");
    expect(setCode(base(), "nope").online.code).toBeNull();
    expect(setOnlineName(base(), 5).online.nameId).toBe(5);
    expect(setOnlineName(base(), 99999).online.nameId).toBeNull();
  });
});

describe("a playdate", () => {
  it("pays joy and sparks once per friend per window", () => {
    const pet = withFriend();
    const out = playdate(pet, "GHJKMN", NOON);
    expect(out.pet.joy).toBe(50 + PLAYDATE_REWARD.joy);
    expect(out.pet.sparks).toBe(pet.sparks + PLAYDATE_REWARD.sparks);
    expect(out.events).toContainEqual({ type: "friend", action: "playdate" });
    expect(out.pet.online.played.GHJKMN).toBe(happeningWindowAt(NOON));

    const again = playdate(out.pet, "GHJKMN", NOON + 60_000);
    expect(again.events).toEqual([]);
    expect(again.pet).toBe(out.pet);
    expect(canPlaydate(out.pet, "GHJKMN", NOON)).toBe(false);
  });

  it("pays again in the next window and for another friend", () => {
    const two = addFriend(withFriend(), friend("PQRSTU")).pet;
    const first = playdate(two, "GHJKMN", NOON).pet;
    expect(canPlaydate(first, "PQRSTU", NOON)).toBe(true);
    const evening = new Date(2026, 10, 17, 17).getTime();
    expect(canPlaydate(first, "GHJKMN", evening)).toBe(true);
  });

  it("caps joy at 100", () => {
    const out = playdate(withFriend(base({ joy: 95 })), "GHJKMN", NOON);
    expect(out.pet.joy).toBe(100);
  });

  it("does not pay for a stranger, an ember or a sleeping pet", () => {
    expect(playdate(base(), "GHJKMN", NOON).events).toEqual([]);
    const ember = withFriend(base({ state: "ember", emberAt: NOON }));
    expect(playdate(ember, "GHJKMN", NOON).events).toEqual([]);
    const night = new Date(2026, 10, 17, 23).getTime();
    expect(canPlaydate(withFriend(), "GHJKMN", night)).toBe(false);
  });
});

describe("a received visit", () => {
  it("pays a smaller reward, only for a friend", () => {
    const pet = withFriend();
    const out = receiveVisit(pet, "GHJKMN");
    expect(out.pet.joy).toBe(50 + VISITED_REWARD.joy);
    expect(out.pet.sparks).toBe(pet.sparks + VISITED_REWARD.sparks);
    expect(out.events).toContainEqual({ type: "friend", action: "visited" });
    expect(receiveVisit(pet, "PQRSTU").events).toEqual([]);
  });
});
