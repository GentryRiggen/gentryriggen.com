import { createPet, emptySave } from "../../actions";
import { resetClock, setNow } from "../../clock";
import { writeSave } from "../../save";
import { useFlamelings } from "../../store";
import {
  addFriend,
  collectVisits,
  ensureCode,
  finishPlaydate,
  lookupFriend,
  refreshFriends,
  setOnlineDeps,
} from "../controller";
import { fakeBackend, FRIEND_CARD } from "../testing/fakeBackend";

jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));
jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));

const NOON = new Date(2026, 10, 17, 12).getTime();
const look = { colour: "ember", shape: "flame", eyes: "round" } as const;
const FRIEND = "GHJKMN";
const STRANGER = "PQRSTU";

let backend: ReturnType<typeof fakeBackend>;

function seedStore() {
  const pet = createPet({ id: "p", name: "Pip", look, now: NOON });
  writeSave({ ...emptySave(NOON), pets: [pet] });
  useFlamelings.getState().init();
}
const pet = () => useFlamelings.getState().save.pets[0];

beforeEach(() => {
  window.localStorage.clear();
  resetClock();
  setNow(NOON);
  useFlamelings.setState(useFlamelings.getInitialState(), true);
  backend = fakeBackend("me");
  setOnlineDeps(backend.deps);
  seedStore();
});
afterEach(() => {
  setOnlineDeps({});
  resetClock();
});

describe("ensureCode", () => {
  it("claims a code once and saves it on the pet", async () => {
    expect(await ensureCode("p")).toBe(true);
    const code = pet().online.code;
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(backend.cardCodes()).toEqual([code]);
    expect(await ensureCode("p")).toBe(true);
    expect(backend.cardCodes()).toHaveLength(1);
  });

  it("does not claim two codes for two quick calls", async () => {
    await Promise.all([ensureCode("p"), ensureCode("p")]);
    expect(backend.cardCodes()).toHaveLength(1);
  });

  it("never puts the typed name on the card", async () => {
    useFlamelings.getState().tick();
    await ensureCode("p");
    expect(JSON.stringify([...backend.docs.values()])).not.toContain("Pip");
  });

  it("is false and leaves the pet alone when offline", async () => {
    backend.setOffline(true);
    expect(await ensureCode("p")).toBe(false);
    expect(pet().online.code).toBeNull();
  });
});

describe("friends", () => {
  it("looks a friend up and adds them", async () => {
    backend.putCard(FRIEND, FRIEND_CARD);
    const found = await lookupFriend(FRIEND);
    expect(found).toEqual({ kind: "found", card: FRIEND_CARD });
    expect(addFriend("p", { code: FRIEND, card: FRIEND_CARD })).toBe(true);
    expect(pet().online.friends).toHaveLength(1);
    expect((await lookupFriend(STRANGER)).kind).toBe("missing");
  });

  it("keeps a friend's cached look current", async () => {
    backend.putCard(FRIEND, FRIEND_CARD);
    addFriend("p", { code: FRIEND, card: FRIEND_CARD });
    backend.putCard(FRIEND, { ...FRIEND_CARD, level: 11, stage: "blaze" });
    await refreshFriends("p");
    expect(pet().online.friends[0].card.level).toBe(11);
  });

  it("keeps the cached look when offline", async () => {
    backend.putCard(FRIEND, FRIEND_CARD);
    addFriend("p", { code: FRIEND, card: FRIEND_CARD });
    backend.setOffline(true);
    await refreshFriends("p");
    expect(pet().online.friends[0].card).toEqual(FRIEND_CARD);
  });
});

describe("a playdate and visits", () => {
  beforeEach(async () => {
    backend.putCard(FRIEND, FRIEND_CARD);
    await ensureCode("p");
    addFriend("p", { code: FRIEND, card: FRIEND_CARD });
  });

  it("pays, then leaves a visit in the friend's inbox", async () => {
    const sparks = pet().sparks;
    expect(await finishPlaydate("p", FRIEND)).toBe(true);
    expect(pet().sparks).toBe(sparks + 10);
    const mine = pet().online.code as string;
    expect(
      backend.hasVisit(FRIEND, mine, new Date().toISOString().slice(0, 10))
    ).toBe(true);
    expect(await finishPlaydate("p", FRIEND)).toBe(false);
  });

  it("still pays when the visit cannot be delivered", async () => {
    backend.setOffline(true);
    expect(await finishPlaydate("p", FRIEND)).toBe(true);
  });

  it("pays and shows a card for a friend's visit, then deletes it", async () => {
    const mine = pet().online.code as string;
    backend.putVisit(mine, FRIEND);
    const sparks = pet().sparks;
    await collectVisits(true);
    expect(pet().sparks).toBe(sparks + 5);
    expect(backend.hasVisit(mine, FRIEND)).toBe(false);
    expect(useFlamelings.getState().celebrations).toMatchObject([
      { kind: "visited", petId: "p", friend: { code: FRIEND } },
    ]);
  });

  it("deletes a stranger's visit silently, with no reward or card", async () => {
    const mine = pet().online.code as string;
    backend.putVisit(mine, STRANGER);
    const sparks = pet().sparks;
    await collectVisits(true);
    expect(pet().sparks).toBe(sparks);
    expect(backend.hasVisit(mine, STRANGER)).toBe(false);
    expect(useFlamelings.getState().celebrations).toEqual([]);
  });

  it("finds a friend's visit buried last in a 300-visit flood, and drains the flood over opens", async () => {
    const mine = pet().online.code as string;
    const letters = "BCDEFGHJKMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < 300; i++) {
      const from = `S${letters[i % 30]}${letters[Math.floor(i / 30) % 30]}AAA`;
      backend.putVisit(mine, from, "2026-11-17", i);
    }
    backend.putVisit(mine, FRIEND, "2026-11-17", 5000);
    const sparks = pet().sparks;
    await collectVisits(true);
    expect(pet().sparks).toBe(sparks + 5);
    expect(backend.hasVisit(mine, FRIEND)).toBe(false);
    const left = () =>
      [...backend.docs.keys()].filter((k) => k.includes("/visits/")).length;
    expect(left()).toBe(100);
    await collectVisits(true);
    expect(left()).toBe(0);
  });

  it("pays nothing when the visit cannot be deleted", async () => {
    const mine = pet().online.code as string;
    backend.putVisit(mine, FRIEND);
    const sparks = pet().sparks;
    const real = backend.deps.fetchImpl as typeof fetch;
    setOnlineDeps({
      ...backend.deps,
      fetchImpl: (async (url: string, init?: RequestInit) =>
        init?.method === "DELETE"
          ? ({ ok: false, status: 500, json: async () => ({}) } as Response)
          : real(url, init)) as unknown as typeof fetch,
    });
    await collectVisits(true);
    expect(pet().sparks).toBe(sparks);
    expect(useFlamelings.getState().celebrations).toEqual([]);
  });

  it("leaves the inbox alone in a tab that cannot save", async () => {
    const mine = pet().online.code as string;
    backend.putVisit(mine, FRIEND);
    useFlamelings.setState({ locked: true });
    await collectVisits(true);
    expect(backend.hasVisit(mine, FRIEND)).toBe(true);
    useFlamelings.setState({ locked: false, outdated: true });
    await collectVisits(true);
    expect(backend.hasVisit(mine, FRIEND)).toBe(true);
  });

  it("does nothing, quietly, when offline", async () => {
    backend.setOffline(true);
    await expect(collectVisits(true)).resolves.toBeUndefined();
  });

  it("does not ask for the inbox of a pet that has no code", async () => {
    useFlamelings.setState({
      save: {
        ...useFlamelings.getState().save,
        pets: [createPet({ id: "q", name: "Q", look, now: NOON })],
      },
    });
    backend.calls.length = 0;
    await collectVisits(true);
    expect(backend.calls).toEqual([]);
  });
});
