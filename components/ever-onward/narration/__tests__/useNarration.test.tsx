import { act, renderHook } from "@testing-library/react";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { lightUniverse } from "@/lib/ever-onward/universes/light";
import { resetNarrationPlayer } from "../player";
import { reloadNarrationSettings, setNarrationSettings } from "../settings";
import { TOAST_MS, useNarration } from "../useNarration";

const def = lightUniverse;
const runWith = (story: string[]): RunState =>
  ({ story }) as unknown as RunState;

let play: jest.SpyInstance;
let sources: string[];

beforeEach(() => {
  window.localStorage.clear();
  act(() => reloadNarrationSettings());
  resetNarrationPlayer();
  sources = [];
  play = jest
    .spyOn(window.HTMLMediaElement.prototype, "play")
    .mockImplementation(function (this: HTMLMediaElement) {
      sources.push(this.getAttribute("src") ?? "");
      return Promise.resolve();
    });
  jest
    .spyOn(window.HTMLMediaElement.prototype, "pause")
    .mockImplementation(() => undefined);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function setup(initial: string[]) {
  return renderHook(({ story }) => useNarration({ def, run: runWith(story) }), {
    initialProps: { story: initial },
  });
}

describe("useNarration", () => {
  it("shows a toast for a new message and plays it on request", () => {
    const { result, rerender } = setup(["coast-hello"]);
    expect(result.current.toast).toBeNull();

    rerender({ story: ["coast-hello", "coast-first-ship"] });
    expect(result.current.toast?.clipId).toBe("light/coast-first-ship");
    expect(result.current.toast?.preview).toBe("A little boat sees the…");

    act(() => result.current.playToast());
    expect(sources.at(-1)).toContain("coast-first-ship.mp3");
    expect(result.current.toast).toBeNull();
  });

  it("does not announce what was already there on load or restore", () => {
    const { result, rerender } = setup(["coast-hello", "coast-first-ship"]);
    expect(result.current.toast).toBeNull();
    // A restart empties the story; the first line again is not "new" to a
    // shrink, but it is a real new line after it.
    rerender({ story: [] });
    expect(result.current.toast).toBeNull();
    rerender({ story: ["coast-hello"] });
    expect(result.current.toast?.clipId).toBe("light/coast-hello");
  });

  it("hides the toast after a few seconds", () => {
    const { result, rerender } = setup([]);
    rerender({ story: ["coast-hello"] });
    expect(result.current.toast).not.toBeNull();
    act(() => {
      jest.advanceTimersByTime(TOAST_MS);
    });
    expect(result.current.toast).toBeNull();
  });

  it("plays without a toast when auto-play is on", () => {
    act(() => setNarrationSettings({ isAutoPlay: true }));
    const { result, rerender } = setup([]);
    rerender({ story: ["coast-hello"] });
    expect(result.current.toast).toBeNull();
    expect(play).toHaveBeenCalledTimes(1);
    expect(sources[0]).toContain("coast-hello.mp3");
  });

  it("does nothing when narration is off", () => {
    act(() => setNarrationSettings({ isEnabled: false }));
    const { result, rerender } = setup([]);
    rerender({ story: ["coast-hello"] });
    expect(result.current.toast).toBeNull();
    expect(play).not.toHaveBeenCalled();
  });

  it("stays silent while a full-screen moment is up", () => {
    const { result, rerender } = renderHook(
      ({ story, isSuppressed }) =>
        useNarration({ def, run: runWith(story), isSuppressed }),
      { initialProps: { story: [] as string[], isSuppressed: true } }
    );
    rerender({ story: ["coast-hello"], isSuppressed: true });
    rerender({ story: ["coast-hello"], isSuppressed: false });
    expect(result.current.toast).toBeNull();
  });

  it("queues lines instead of overlapping, keeping the newest two", () => {
    act(() => setNarrationSettings({ isAutoPlay: true }));
    const { rerender } = setup([]);
    rerender({
      story: ["coast-hello", "coast-first-ship", "coast-ten", "coast-keeper"],
    });
    // The first plays now; of the other three only the newest two wait.
    expect(play).toHaveBeenCalledTimes(1);
    const played = (): string[] =>
      sources.map((src) => src.split("/").pop() ?? "");
    expect(played()).toEqual(["coast-hello.mp3"]);
    act(() => {
      (play.mock.contexts.at(-1) as HTMLMediaElement).dispatchEvent(
        new Event("ended")
      );
    });
    act(() => {
      (play.mock.contexts.at(-1) as HTMLMediaElement).dispatchEvent(
        new Event("ended")
      );
    });
    expect(played()).toEqual([
      "coast-hello.mp3",
      "coast-ten.mp3",
      "coast-keeper.mp3",
    ]);
  });
});
