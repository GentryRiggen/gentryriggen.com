import { act, fireEvent, render, screen } from "@testing-library/react";
import { setNow, resetClock } from "@/lib/flamelings/clock";
import { SAVE_KEY } from "@/lib/flamelings/save";
import { LOCK_KEY, readLock } from "@/lib/flamelings/tabLock";
import { createPet } from "@/lib/flamelings/actions";
import { SAVE_SCHEMA } from "@/lib/flamelings/types";
import {
  forcedHappening,
  happeningWindowAt,
} from "@/lib/flamelings/happenings";
import { now } from "@/lib/flamelings/clock";
import { useFlamelings } from "@/lib/flamelings/store";
import Flamelings from "../Flamelings";
import FireflyCatch from "../FireflyCatch";

jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));

const NOON = new Date(2026, 10, 17, 12).getTime();

function reset() {
  window.localStorage.clear();
  resetClock();
  setNow(NOON);
  useFlamelings.setState(useFlamelings.getInitialState(), true);
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOON, advanceTimers: true });
  reset();
});
afterEach(() => {
  jest.useRealTimers();
  resetClock();
});

function hatchThroughUi(name: string) {
  fireEvent.click(screen.getByTestId("hatch-new"));
  for (let i = 0; i < 5; i++) fireEvent.click(screen.getByTestId("egg"));
  fireEvent.click(screen.getByRole("button", { name: "Hello, little flame!" }));
  fireEvent.change(screen.getByLabelText("Name your flameling"), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole("button", { name: "Welcome home!" }));
  quietHappenings();
}

/** A new pet may have a happening (and its intro card) by chance: finish it. */
function quietHappenings() {
  act(() => {
    const { save } = useFlamelings.getState();
    const window = happeningWindowAt(now());
    useFlamelings.setState({
      save: {
        ...save,
        pets: save.pets.map((p) => ({
          ...p,
          happening: {
            window,
            kind: "visitor",
            variant: "owl",
            done: true,
            seen: true,
          },
        })),
      },
    });
  });
}

describe("Flamelings", () => {
  it("starts on an empty shelf with a way to hatch", () => {
    render(<Flamelings />);
    expect(screen.getByTestId("hatch-new")).toBeInTheDocument();
    expect(screen.queryByTestId("pet-card")).toBeNull();
    expect(screen.getByRole("link", { name: /What's new/ })).toHaveAttribute(
      "href",
      "/flamelings/versions"
    );
  });

  it("hatches, names and saves a pet, limiting names to 12 characters", () => {
    render(<Flamelings />);
    fireEvent.click(screen.getByTestId("hatch-new"));
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByTestId("egg"));
    fireEvent.click(
      screen.getByRole("button", { name: "Hello, little flame!" })
    );
    const input = screen.getByLabelText("Name your flameling");
    expect(input).toHaveAttribute("maxLength", "12");
    expect(
      screen.getByRole("button", { name: "Welcome home!" })
    ).toBeDisabled();
    fireEvent.change(input, { target: { value: "Sparky" } });
    fireEvent.click(screen.getByRole("button", { name: "Welcome home!" }));
    expect(
      screen.getByRole("button", { name: /Sparky, tap to say hi/ })
    ).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "{}");
    expect(saved.pets).toHaveLength(1);
    expect(saved.pets[0].name).toBe("Sparky");
  });

  it("fills the name from the dice", () => {
    render(<Flamelings />);
    fireEvent.click(screen.getByTestId("hatch-new"));
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByTestId("egg"));
    fireEvent.click(
      screen.getByRole("button", { name: "Hello, little flame!" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Pick a random name" }));
    const input = screen.getByLabelText(
      "Name your flameling"
    ) as HTMLInputElement;
    expect(input.value.length).toBeGreaterThan(0);
    expect(input.value.length).toBeLessThanOrEqual(12);
  });

  it("feeds a hungry pet after the food flies in", () => {
    render(<Flamelings />);
    hatchThroughUi("Pip");
    act(() => {
      const { save } = useFlamelings.getState();
      useFlamelings.setState({
        save: { ...save, pets: [{ ...save.pets[0], fuel: 20 }] },
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    act(() => {
      jest.advanceTimersByTime(700);
    });
    expect(useFlamelings.getState().save.pets[0].fuel).toBeGreaterThan(55);
    expect(screen.getByTestId("pet")).toHaveAttribute("data-mood", "eating");
  });

  it("disables feeding and playing at night", () => {
    render(<Flamelings />);
    hatchThroughUi("Pip");
    act(() => {
      setNow(new Date(2026, 10, 17, 22).getTime());
      useFlamelings.getState().tick();
    });
    expect(screen.getByRole("button", { name: "Feed" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Wardrobe" })).toBeEnabled();
    expect(screen.getByTestId("asleep-hint")).toBeInTheDocument();
  });

  it("shows locked wardrobe items with a lock and equips owned ones", () => {
    render(<Flamelings />);
    hatchThroughUi("Pip");
    fireEvent.click(screen.getByRole("button", { name: "Wardrobe" }));
    expect(
      screen.getByRole("button", { name: /Rose, locked, Level/ })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Sky" }));
    expect(useFlamelings.getState().save.pets[0].look.colour).toBe("sky");
    fireEvent.click(screen.getByRole("tab", { name: /Hat/ }));
    expect(
      screen.getByRole("button", { name: /Crown, locked/ })
    ).toBeDisabled();
  });

  it("opens the present into a NEW! card", () => {
    render(<Flamelings />);
    hatchThroughUi("Pip");
    fireEvent.click(screen.getByTestId("gift"));
    expect(
      screen.getByRole("dialog", { name: "A surprise!" })
    ).toBeInTheDocument();
    expect(screen.getByText("NEW!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yay!" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByTestId("gift")).toBeNull();
  });

  it("shows a happening as a ! on the shelf, an intro, then the visitor", () => {
    render(<Flamelings />);
    hatchThroughUi("Pip");
    act(() => {
      const { save } = useFlamelings.getState();
      useFlamelings.setState({
        save: {
          ...save,
          pets: save.pets.map((p) => ({
            ...p,
            happening: forcedHappening("visitor", now(), "frog"),
          })),
        },
      });
    });
    expect(screen.getByTestId("happening-intro")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("happening-go"));
    expect(screen.queryByTestId("happening-intro")).toBeNull();
    const before = useFlamelings.getState().save.pets[0].unlocked.length;
    fireEvent.click(screen.getByRole("button", { name: /came to visit/ }));
    expect(useFlamelings.getState().save.pets[0].happening?.done).toBe(true);
    // The present is random: sparks, or a still-locked item.
    const pet = useFlamelings.getState().save.pets[0];
    expect(pet.sparks > 0 || pet.unlocked.length > before).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Back to the shelf" }));
    expect(screen.queryByTestId("happening-bubble")).toBeNull();
  });

  it("recovers from a corrupt save", () => {
    window.localStorage.setItem(SAVE_KEY, "{oops");
    render(<Flamelings />);
    expect(screen.getByTestId("hatch-new")).toBeInTheDocument();
    const backups = Object.keys(window.localStorage).filter(
      (k) => k.startsWith("flamelings:v1:corrupt:") && !k.endsWith(":index")
    );
    expect(backups).toHaveLength(1);
    expect(window.localStorage.getItem(backups[0])).toBe("{oops");
  });
});

const look = { colour: "ember", shape: "flame", eyes: "round" } as const;

function otherTabHoldsLock() {
  window.localStorage.setItem(
    LOCK_KEY,
    JSON.stringify({ id: "other-tab", at: Date.now() })
  );
}

describe("two tabs", () => {
  it("shows a friendly screen instead of saving over the other tab", () => {
    const stored = JSON.stringify({
      v: 1,
      pets: [createPet({ id: "x", name: "Other", look, now: NOON })],
      memorial: [],
      collection: [],
      updatedAt: 1,
    });
    window.localStorage.setItem(SAVE_KEY, stored);
    otherTabHoldsLock();
    render(<Flamelings />);
    expect(screen.getByTestId("tab-locked")).toHaveTextContent(
      "Flamelings is open in another tab"
    );
    expect(screen.queryByTestId("hatch-new")).toBeNull();
    act(() => {
      useFlamelings.getState().tick();
    });
    expect(window.localStorage.getItem(SAVE_KEY)).toBe(stored);
  });

  it("takes over with Play here and then owns the lock", () => {
    otherTabHoldsLock();
    render(<Flamelings />);
    fireEvent.click(screen.getByRole("button", { name: "Play here" }));
    expect(screen.getByTestId("hatch-new")).toBeInTheDocument();
    expect(readLock(window.localStorage)?.id).not.toBe("other-tab");
  });

  it("locks itself when another tab takes over mid-game", () => {
    render(<Flamelings />);
    expect(screen.getByTestId("hatch-new")).toBeInTheDocument();
    otherTabHoldsLock();
    act(() => {
      useFlamelings.getState().heartbeat();
    });
    expect(screen.getByTestId("tab-locked")).toBeInTheDocument();
  });

  it("adopts the other tab's save instead of overwriting it", () => {
    render(<Flamelings />);
    hatchThroughUi("Mine");
    const theirs = {
      v: 1,
      pets: [
        ...useFlamelings.getState().save.pets,
        createPet({ id: "x", name: "Theirs", look, now: NOON }),
      ],
      memorial: [],
      collection: [],
      updatedAt: NOON + 1,
    };
    const raw = JSON.stringify(theirs);
    window.localStorage.setItem(SAVE_KEY, raw);
    act(() => {
      useFlamelings.getState().tick();
    });
    expect(useFlamelings.getState().save.pets.map((p) => p.name)).toEqual([
      "Mine",
      "Theirs",
    ]);
    expect(
      JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "{}").pets
    ).toHaveLength(2);
  });

  it("shows the grow-up card for a form set by an adopted save", () => {
    render(<Flamelings />);
    const pet = createPet({ id: "x", name: "Big", look, now: NOON });
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        v: 1,
        schema: SAVE_SCHEMA,
        pets: [{ ...pet, level: 10, form: null }],
        memorial: [],
        collection: [],
        updatedAt: NOON + 1,
      })
    );
    act(() => {
      useFlamelings.getState().takeOver();
    });
    expect(useFlamelings.getState().celebrations[0]).toMatchObject({
      kind: "evolve",
      petId: "x",
    });
  });

  it("adopts a save announced by a storage event", () => {
    render(<Flamelings />);
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        v: 1,
        pets: [createPet({ id: "x", name: "Remote", look, now: NOON })],
        memorial: [],
        collection: [],
        updatedAt: 5,
      })
    );
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: SAVE_KEY }));
    });
    expect(
      screen.getByRole("button", { name: /Remote, level 1/ })
    ).toBeInTheDocument();
  });
});

describe("FireflyCatch", () => {
  it("counts catches for 20 seconds, then hands the score over", () => {
    const onDone = jest.fn();
    render(<FireflyCatch onDone={onDone} />);
    const flies = screen.getAllByRole("button", { name: "Catch a firefly" });
    fireEvent.click(flies[0]);
    fireEvent.click(flies[1]);
    expect(screen.getByTestId("catch-score")).toHaveTextContent("2");
    act(() => {
      jest.advanceTimersByTime(20_500);
    });
    expect(screen.getByText("You caught 2 fireflies!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith(2);
  });
});
