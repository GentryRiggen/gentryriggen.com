import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createPet, emptySave } from "@/lib/flamelings/actions";
import { resetClock, setNow } from "@/lib/flamelings/clock";
import { setOnlineDeps } from "@/lib/flamelings/online/controller";
import {
  fakeBackend,
  FRIEND_CARD,
} from "@/lib/flamelings/online/testing/fakeBackend";
import { ONLINE_NAMES } from "@/lib/flamelings/online/names";
import { writeSave } from "@/lib/flamelings/save";
import { useFlamelings } from "@/lib/flamelings/store";
import type { Pet } from "@/lib/flamelings/types";
import { trackGame } from "@/lib/analytics/trackGame";
import Flamelings from "../Flamelings";

jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));
jest.mock("@/components/update/useUpdateCheck", () => ({
  useUpdateCheck: () => ({ isUpdateReady: false }),
}));

const NOON = new Date(2026, 10, 17, 12).getTime();
const look = { colour: "ember", shape: "flame", eyes: "round" } as const;
const FRIEND = "GHJKMN";

let backend: ReturnType<typeof fakeBackend>;

/** A quiet pet (its happening done) so no intro card gets in the way. */
function quietPet(patch: Partial<Pet> = {}): Pet {
  return {
    ...createPet({ id: "p", name: "Pip", look, now: NOON }),
    happening: {
      window: "2026-11-17:am",
      kind: "visitor",
      variant: "owl",
      done: true,
      seen: true,
    },
    ...patch,
  };
}

function open(pets: Pet[] = [quietPet()]) {
  writeSave({ ...emptySave(NOON), pets });
  render(<Flamelings />);
}

async function openFriends() {
  fireEvent.click(await screen.findByTestId("pet-friends"));
  await screen.findByTestId("friends-screen");
}

function type(code: string) {
  for (const ch of code) fireEvent.click(screen.getByTestId(`key-${ch}`));
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOON, advanceTimers: true });
  window.localStorage.clear();
  resetClock();
  setNow(NOON);
  useFlamelings.setState(useFlamelings.getInitialState(), true);
  (trackGame as jest.Mock).mockClear();
  backend = fakeBackend("me");
  setOnlineDeps(backend.deps);
});
afterEach(() => {
  setOnlineDeps({});
  jest.useRealTimers();
  resetClock();
});

describe("the Friends screen", () => {
  it("opens from the shelf, claims a code and shows it big with a copy button", async () => {
    open();
    await openFriends();
    const code = await screen.findByTestId("my-code");
    const letters = code.textContent ?? "";
    expect(letters).toMatch(/^[A-Z0-9]{6}$/);
    expect(backend.cardCodes()).toEqual([letters]);
    expect(screen.getByTestId("copy-code")).toBeInTheDocument();
  });

  it("copies the code", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    open();
    await openFriends();
    const code = (await screen.findByTestId("my-code")).textContent;
    fireEvent.click(screen.getByTestId("copy-code"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(code));
  });

  it("shows a calm cloud-off icon when offline, and the game still works", async () => {
    backend.setOffline(true);
    open();
    await openFriends();
    expect(await screen.findByTestId("friends-offline")).toBeInTheDocument();
    expect(screen.queryByTestId("my-code")).not.toBeInTheDocument();
    backend.setOffline(false);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("my-code")).toBeInTheDocument();
    expect(screen.queryByTestId("friends-offline")).not.toBeInTheDocument();
  });

  it("picks the online name from big chips", async () => {
    open();
    await openFriends();
    fireEvent.click(await screen.findByTestId("change-name"));
    fireEvent.click(screen.getByRole("button", { name: ONLINE_NAMES[7] }));
    expect(screen.getByTestId("my-name")).toHaveTextContent(ONLINE_NAMES[7]);
    expect(useFlamelings.getState().save.pets[0].online.nameId).toBe(7);
  });
});

describe("adding a friend", () => {
  beforeEach(() => backend.putCard(FRIEND, FRIEND_CARD));

  it("only offers the code alphabet on the keypad", async () => {
    open();
    await openFriends();
    fireEvent.click(screen.getByTestId("add-friend-button"));
    const keys = screen
      .getAllByTestId(/^key-/)
      .map((k) => k.getAttribute("data-testid")?.slice(4));
    expect(keys).toHaveLength(32);
    for (const bad of ["0", "O", "1", "I", "L"]) {
      expect(keys).not.toContain(bad);
    }
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the friend's pet to look at, then adds them on confirm", async () => {
    open();
    await openFriends();
    fireEvent.click(screen.getByTestId("add-friend-button"));
    type(FRIEND);
    const preview = await screen.findByTestId("friend-preview");
    expect(preview).toHaveTextContent(ONLINE_NAMES[FRIEND_CARD.nameId]);
    expect(useFlamelings.getState().save.pets[0].online.friends).toEqual([]);
    fireEvent.click(screen.getByTestId("confirm-friend"));
    await waitFor(() =>
      expect(screen.getAllByTestId("friend-card")).toHaveLength(1)
    );
    expect(useFlamelings.getState().save.pets[0].online.friends[0].code).toBe(
      FRIEND
    );
    expect(trackGame).toHaveBeenCalledWith("fl_friend", { action: "add" });
  });

  it("says nobody has a code that does not exist", async () => {
    open();
    await openFriends();
    fireEvent.click(screen.getByTestId("add-friend-button"));
    type("PQRSTU");
    await waitFor(() =>
      expect(screen.getByTestId("lookup")).toHaveAttribute(
        "data-state",
        "missing"
      )
    );
    expect(screen.queryByTestId("confirm-friend")).not.toBeInTheDocument();
  });

  it("will not add yourself or a friend twice", async () => {
    open();
    await openFriends();
    const mine = (await screen.findByTestId("my-code")).textContent as string;
    fireEvent.click(screen.getByTestId("add-friend-button"));
    type(mine);
    await waitFor(() =>
      expect(screen.getByTestId("lookup")).toHaveAttribute("data-state", "self")
    );
    fireEvent.click(screen.getByTestId("key-delete"));
    expect(screen.getByTestId("lookup")).toHaveAttribute("data-state", "idle");
  });

  it("deletes the last letter and stops at six", async () => {
    open();
    await openFriends();
    fireEvent.click(screen.getByTestId("add-friend-button"));
    type("ABCDEFG");
    expect(screen.getByTestId("keypad-slots")).toHaveAttribute(
      "aria-label",
      "Code typed so far: ABCDEF"
    );
    expect(screen.getByTestId("key-A")).toBeDisabled();
    fireEvent.click(screen.getByTestId("key-delete"));
    expect(screen.getByTestId("keypad-slots")).toHaveAttribute(
      "aria-label",
      "Code typed so far: ABCDE"
    );
  });
});

describe("a friend on the list", () => {
  const friendPet = () =>
    quietPet({
      online: {
        code: null,
        nameId: null,
        friends: [{ code: FRIEND, card: { ...FRIEND_CARD, level: 7 } }],
        played: {},
      },
    });

  it("shows the friend's live look", async () => {
    backend.putCard(FRIEND, { ...FRIEND_CARD, level: 9 });
    open([friendPet()]);
    await openFriends();
    await waitFor(() =>
      expect(
        useFlamelings.getState().save.pets[0].online.friends[0].card.level
      ).toBe(9)
    );
    expect(screen.getByTestId("friend-card")).toHaveTextContent("Lv 9");
  });

  it("removes a friend after a second tap", async () => {
    open([friendPet()]);
    await openFriends();
    fireEvent.click(
      screen.getByRole("button", {
        name: `Remove ${ONLINE_NAMES[FRIEND_CARD.nameId]} from my friends`,
      })
    );
    fireEvent.click(await screen.findByTestId("remove-yes"));
    expect(screen.queryByTestId("friend-card")).not.toBeInTheDocument();
    expect(useFlamelings.getState().save.pets[0].online.friends).toEqual([]);
  });

  it("runs a whole playdate and pays once", async () => {
    backend.putCard(FRIEND, FRIEND_CARD);
    open([friendPet()]);
    await openFriends();
    await screen.findByTestId("my-code");
    const before = useFlamelings.getState().save.pets[0];
    fireEvent.click(screen.getByTestId("playdate-button"));
    const scene = await screen.findByTestId("playdate");
    expect(scene).toHaveAttribute("data-step", "arrive");
    act(() => jest.advanceTimersByTime(2500));
    expect(scene).toHaveAttribute("data-step", "highfive");
    fireEvent.click(screen.getByTestId("highfive-mine"));
    expect(scene).toHaveAttribute("data-step", "highfive");
    fireEvent.click(screen.getByTestId("highfive-friend"));
    act(() => jest.advanceTimersByTime(1000));
    expect(scene).toHaveAttribute("data-step", "share");
    fireEvent.click(screen.getByTestId("share-marshmallow"));
    expect(scene).toHaveAttribute("data-step", "eat");
    act(() => jest.advanceTimersByTime(2000));
    expect(await screen.findByTestId("playdate-done")).toBeInTheDocument();
    await waitFor(() => {
      const after = useFlamelings.getState().save.pets[0];
      expect(after.sparks).toBe(before.sparks + 10);
      expect(after.joy).toBeGreaterThanOrEqual(Math.min(100, before.joy));
    });
    expect(trackGame).toHaveBeenCalledWith("fl_friend", {
      action: "playdate",
    });
    // The friend was left a visit.
    const mine = useFlamelings.getState().save.pets[0].online.code as string;
    expect(
      backend.hasVisit(FRIEND, mine, new Date().toISOString().slice(0, 10))
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Yay!" }));
    expect(screen.queryByTestId("playdate")).not.toBeInTheDocument();
    // Once per window: the button rests.
    expect(screen.getByTestId("playdate-button")).toBeDisabled();
  });

  it("does not start a second playdate in the same window", async () => {
    open([
      quietPet({
        online: {
          code: null,
          nameId: null,
          friends: [{ code: FRIEND, card: FRIEND_CARD }],
          played: { [FRIEND]: "2026-11-17:am" },
        },
      }),
    ]);
    await openFriends();
    expect(screen.getByTestId("playdate-button")).toBeDisabled();
  });
});

describe("a visit from a friend", () => {
  it("shows the visited card on opening the game, pays and deletes it", async () => {
    const mine = "ABCDEF";
    backend.putCard(mine, FRIEND_CARD, "me");
    backend.putVisit(mine, FRIEND);
    const sparks = 0;
    open([
      quietPet({
        online: {
          code: mine,
          nameId: null,
          friends: [{ code: FRIEND, card: FRIEND_CARD }],
          played: {},
        },
      }),
    ]);
    const card = await screen.findByTestId("visited");
    expect(card).toHaveTextContent(
      `${ONLINE_NAMES[FRIEND_CARD.nameId]} visited!`
    );
    expect(card).toHaveTextContent("+5");
    expect(card).toHaveTextContent("+10");
    expect(useFlamelings.getState().save.pets[0].sparks).toBe(sparks + 5);
    expect(backend.hasVisit(mine, FRIEND)).toBe(false);
    expect(trackGame).toHaveBeenCalledWith("fl_friend", { action: "visited" });
    fireEvent.click(screen.getByRole("button", { name: "Yay!" }));
    expect(screen.queryByTestId("visited")).not.toBeInTheDocument();
  });

  it("deletes a stranger's visit and shows nothing", async () => {
    const mine = "ABCDEF";
    backend.putCard(mine, FRIEND_CARD, "me");
    backend.putVisit(mine, "PQRSTU");
    open([
      quietPet({
        online: { code: mine, nameId: null, friends: [], played: {} },
      }),
    ]);
    await waitFor(() => expect(backend.hasVisit(mine, "PQRSTU")).toBe(false));
    expect(screen.queryByTestId("visited")).not.toBeInTheDocument();
    expect(useFlamelings.getState().save.pets[0].sparks).toBe(0);
  });
});

describe("a player who never opens Friends", () => {
  it("never touches the network", async () => {
    open();
    await screen.findByTestId("pet-card");
    act(() => jest.advanceTimersByTime(120_000));
    expect(backend.calls).toEqual([]);
  });
});
