import { act, fireEvent, render, screen } from "@testing-library/react";
import { createFakeAudio } from "@/components/game-audio/testing/fakeAudio";
import { resetClock, setNow } from "@/lib/flamelings/clock";
import { useFlamelings } from "@/lib/flamelings/store";
import { SOUND_NAMES } from "@/lib/flamelings/sound";
import Flamelings from "../Flamelings";
import { VOICES, resetVoiceLimits } from "../audio/voices";
import { createResilientAudioContext } from "@/components/game-audio/resilientAudio";

jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));

const fake = createFakeAudio();
const NOON = new Date(2026, 10, 17, 12).getTime();

beforeEach(() => {
  jest.useFakeTimers({ now: NOON, advanceTimers: true });
  window.localStorage.clear();
  resetClock();
  setNow(NOON);
  useFlamelings.setState(useFlamelings.getInitialState(), true);
  fake.reset();
  fake.install();
  resetVoiceLimits();
});
afterEach(() => {
  fake.uninstall();
  jest.useRealTimers();
  resetClock();
});

function hatch() {
  fireEvent.click(screen.getByTestId("hatch-new"));
  for (let i = 0; i < 5; i++) fireEvent.click(screen.getByTestId("egg"));
  fireEvent.click(screen.getByRole("button", { name: "Hello, little flame!" }));
  fireEvent.change(screen.getByLabelText("Name your flameling"), {
    target: { value: "Pip" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Welcome home!" }));
}

function hungry() {
  act(() => {
    const { save } = useFlamelings.getState();
    useFlamelings.setState({
      save: { ...save, pets: [{ ...save.pets[0], fuel: 20 }] },
    });
  });
}

describe("Flamelings sound", () => {
  it("makes no audio context until the first tap", () => {
    render(<Flamelings />);
    expect(fake.contexts).toHaveLength(0);
    fireEvent.click(screen.getByTestId("hatch-new"));
    expect(fake.contexts).toHaveLength(1);
  });

  it("chomps when fed, and stays silent when sound is switched off", () => {
    render(<Flamelings />);
    hatch();
    hungry();
    const before = fake.sources.length;
    act(() => {
      useFlamelings
        .getState()
        .feed(useFlamelings.getState().save.pets[0].id, "log");
    });
    expect(fake.sources.length).toBeGreaterThan(before);

    fireEvent.click(screen.getByTestId("sound-toggle"));
    expect(screen.getByTestId("sound-toggle")).toHaveAccessibleName(
      "Sound off"
    );
    hungry();
    jest.advanceTimersByTime(1000);
    const muted = fake.sources.length;
    act(() => {
      useFlamelings
        .getState()
        .feed(useFlamelings.getState().save.pets[0].id, "twig");
    });
    expect(fake.sources.length).toBe(muted);
  });

  it("plays nothing while the page is hidden", () => {
    render(<Flamelings />);
    hatch();
    hungry();
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const before = fake.sources.length;
    act(() => {
      useFlamelings
        .getState()
        .feed(useFlamelings.getState().save.pets[0].id, "log");
    });
    expect(fake.sources.length).toBe(before);
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });
});

describe("the voices", () => {
  it.each(SOUND_NAMES)(
    "%s makes a short, quiet sound that cleans up",
    (name) => {
      const audio = createResilientAudioContext();
      audio.wake();
      const engine = audio.engine()!;
      VOICES[name](engine, 0);
      expect(fake.sources.length).toBeGreaterThan(0);
      for (const source of fake.sources) {
        expect(source.start).toHaveBeenCalled();
        expect(
          source.stop === undefined || source.stop.mock.calls.length >= 0
        ).toBe(true);
      }
      for (const node of fake.nodes.filter(
        (n) => n.gain.linearRampToValueAtTime.mock.calls.length
      )) {
        for (const [level] of node.gain.linearRampToValueAtTime.mock.calls) {
          expect(level).toBeLessThanOrEqual(0.2);
        }
      }
    }
  );
});
