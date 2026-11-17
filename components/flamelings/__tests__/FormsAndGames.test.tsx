import { act, fireEvent, render, screen } from "@testing-library/react";
import { createPet } from "@/lib/flamelings/actions";
import { resetClock, setNow } from "@/lib/flamelings/clock";
import { resetPlayTuning, tunePlay } from "@/lib/flamelings/playTuning";
import { useFlamelings } from "@/lib/flamelings/store";
import type { FormId, Pet } from "@/lib/flamelings/types";
import Blob from "../Blob";
import CelebrationCard from "../CelebrationCard";
import LogStack from "../LogStack";
import MarshmallowToast from "../MarshmallowToast";
import MemoryGrove from "../MemoryGrove";
import PlayPicker from "../PlayPicker";
import Shelf from "../Shelf";

jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));

const NOON = new Date(2026, 10, 17, 12).getTime();
const look = { colour: "ember", shape: "flame", eyes: "round" } as const;
const pet = (patch: Partial<Pet> = {}): Pet => ({
  ...createPet({ id: "p1", name: "Pip", look, now: NOON }),
  ...patch,
});

beforeEach(() => {
  jest.useFakeTimers({ now: NOON, advanceTimers: true });
  window.localStorage.clear();
  resetClock();
  setNow(NOON);
  useFlamelings.setState(useFlamelings.getInitialState(), true);
});
afterEach(() => {
  jest.useRealTimers();
  resetClock();
  resetPlayTuning();
});

describe("form drawing", () => {
  it.each<[FormId, string]>([
    ["cozy", ".fl-heart"],
    ["wild", ".fl-spike"],
    ["sparkly", ".fl-star"],
  ])("draws the %s form", (form, selector) => {
    const { container } = render(<Blob look={look} mood="happy" form={form} />);
    expect(container.querySelector(".fl-pet")).toHaveAttribute(
      "data-form",
      form
    );
    expect(container.querySelector(selector)).not.toBeNull();
  });

  it("draws nothing extra before the pet grows up", () => {
    const { container } = render(<Blob look={look} mood="happy" />);
    expect(container.querySelector(".fl-form")).toBeNull();
  });
});

describe("labels", () => {
  it("shows the form on the shelf card and in the Memory Grove", () => {
    useFlamelings.setState({
      ready: true,
      clock: NOON,
      save: {
        v: 1,
        schema: 4,
        pets: [pet({ level: 12, form: "cozy" })],
        memorial: [
          {
            id: "m",
            name: "Old",
            look,
            worn: { hat: null, face: null, neck: null },
            level: 16,
            form: "wild",
            daysLived: 9,
            bornAt: NOON,
            outAt: NOON,
          },
        ],
        collection: [],
        updatedAt: NOON,
      },
    });
    const { unmount } = render(<Shelf />);
    expect(screen.getByTestId("pet-card")).toHaveTextContent(
      "Lv 12 · Cozy Blaze"
    );
    unmount();
    render(<MemoryGrove />);
    expect(screen.getByTestId("grave-form")).toHaveTextContent("Wild Bonfire");
  });
});

describe("the evolution card", () => {
  it("glows, spins, then reveals the form name and lets the player go on", () => {
    useFlamelings.setState({
      ready: true,
      save: {
        v: 1,
        schema: 4,
        pets: [pet({ level: 10, form: "sparkly" })],
        memorial: [],
        collection: [],
        updatedAt: NOON,
      },
    });
    render(
      <CelebrationCard
        celebration={{ kind: "evolve", petId: "p1", form: "sparkly" }}
      />
    );
    const card = screen.getByTestId("evolution");
    expect(card).toHaveAttribute("data-phase", "glow");
    expect(screen.queryByTestId("evolution-name")).toBeNull();
    act(() => jest.advanceTimersByTime(1400));
    expect(card).toHaveAttribute("data-phase", "spin");
    act(() => jest.advanceTimersByTime(1300));
    expect(card).toHaveAttribute("data-phase", "reveal");
    expect(screen.getByTestId("evolution-name")).toHaveTextContent(
      "Sparkly Blaze"
    );
    useFlamelings.setState({
      celebrations: [{ kind: "evolve", petId: "p1", form: "sparkly" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Yay!" }));
    expect(useFlamelings.getState().celebrations).toEqual([]);
  });
});

describe("the play picker", () => {
  it("offers all three games and reports the pick", () => {
    const onPick = jest.fn();
    render(<PlayPicker roundsLeft={2} onPick={onPick} onClose={jest.fn()} />);
    fireEvent.click(screen.getByTestId("play-marshmallow"));
    fireEvent.click(screen.getByTestId("play-logs"));
    fireEvent.click(screen.getByTestId("play-fireflies"));
    expect(onPick.mock.calls.map((c) => c[0])).toEqual([
      "marshmallow",
      "logs",
      "fireflies",
    ]);
  });
});

describe("Marshmallow Toast", () => {
  it("plays five marshmallows and reports a score of 5 to 15", () => {
    tunePlay({ toast: 6 });
    const onDone = jest.fn();
    render(<MarshmallowToast pet={pet()} onDone={onDone} />);
    for (let i = 0; i < 5; i++) {
      fireEvent.pointerDown(screen.getByTestId("toast-hold"));
      act(() => jest.advanceTimersByTime(400));
      fireEvent.pointerUp(screen.getByTestId("toast-hold"));
      expect(screen.getByTestId("toast-result")).toBeInTheDocument();
      act(() => jest.advanceTimersByTime(1500));
    }
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    const score = onDone.mock.calls[0][0] as number;
    expect(score).toBeGreaterThanOrEqual(5);
    expect(score).toBeLessThanOrEqual(15);
  });

  it("burns a marshmallow that is held too long, and still scores it", () => {
    tunePlay({ toast: 6 });
    render(<MarshmallowToast pet={pet()} onDone={jest.fn()} />);
    fireEvent.pointerDown(screen.getByTestId("toast-hold"));
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByTestId("toast-result")).toHaveTextContent("+1");
    expect(screen.getByTestId("toast-score")).toHaveTextContent("1");
  });
});

describe("Log Stack", () => {
  it("stacks logs on taps and ends at a full tower with the logs as the score", () => {
    tunePlay({ logs: 0.001 });
    const onDone = jest.fn();
    render(<LogStack pet={pet()} onDone={onDone} />);
    for (let i = 0; i < 11; i++) {
      fireEvent.pointerDown(screen.getByTestId("logs-drop"));
      act(() => jest.advanceTimersByTime(300));
    }
    act(() => jest.advanceTimersByTime(900));
    expect(screen.getByText(/full tower/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith(12);
  });

  it("ignores a second tap while a log is still falling", () => {
    tunePlay({ logs: 0.001 });
    render(<LogStack pet={pet()} onDone={jest.fn()} />);
    fireEvent.pointerDown(screen.getByTestId("logs-drop"));
    fireEvent.pointerDown(screen.getByTestId("logs-drop"));
    expect(screen.getByTestId("logs-score")).toHaveTextContent("2");
  });
});
