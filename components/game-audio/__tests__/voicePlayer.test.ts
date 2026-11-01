import { createVoicePlayer } from "../voicePlayer";

type Win = Window & { AudioContext?: unknown };

/** A context that only starts running when `allowResume` is set (iOS). */
class FakeContext {
  static instances: FakeContext[] = [];
  static allowResume = false;
  state: "suspended" | "running" = "suspended";
  destination = {};
  resume = jest.fn(() => {
    if (FakeContext.allowResume) this.state = "running";
    return Promise.resolve();
  });
  constructor() {
    FakeContext.instances.push(this);
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function makePlayer() {
  return createVoicePlayer({
    getClip: () => ({ file: "/clip.mp3" }),
    eventName: "test:voice",
  });
}

beforeEach(() => {
  FakeContext.instances = [];
  FakeContext.allowResume = false;
  (window as Win).AudioContext = FakeContext;
});

afterEach(() => {
  delete (window as Win).AudioContext;
});

describe("voicePlayer unlockOnGesture", () => {
  it.each(["pointerdown", "touchend", "click", "keydown"])(
    "tries to resume the context on %s",
    async (type) => {
      const player = makePlayer();
      player.unlockOnGesture();
      document.dispatchEvent(new Event(type));
      await flush();
      expect(FakeContext.instances).toHaveLength(1);
      expect(FakeContext.instances[0]!.resume).toHaveBeenCalledTimes(1);
      player.reset();
    }
  );

  it("keeps listening until the context is running, then stops", async () => {
    const player = makePlayer();
    player.unlockOnGesture();
    // iOS ignores the pointerdown…
    document.dispatchEvent(new Event("pointerdown"));
    await flush();
    const ctx = FakeContext.instances[0]!;
    expect(ctx.state).toBe("suspended");
    // …but the touchend that follows starts it.
    FakeContext.allowResume = true;
    document.dispatchEvent(new Event("touchend"));
    await flush();
    expect(ctx.state).toBe("running");
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    document.dispatchEvent(new Event("click"));
    document.dispatchEvent(new Event("keydown"));
    await flush();
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    player.reset();
  });

  it("reset takes the listeners away", async () => {
    const player = makePlayer();
    player.unlockOnGesture();
    player.reset();
    document.dispatchEvent(new Event("click"));
    await flush();
    expect(FakeContext.instances).toHaveLength(0);
  });
});
