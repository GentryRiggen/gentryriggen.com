import {
  applyAudioSession,
  playOnSilent,
  setPlayOnSilent,
} from "../audioSession";

type Nav = Navigator & { audioSession?: { type: string } };

describe("applyAudioSession", () => {
  beforeEach(() => {
    window.localStorage.clear();
    playOnSilent.resetMemory();
  });
  afterEach(() => {
    delete (navigator as Nav).audioSession;
  });

  it("is ambient with the setting off (the default)", () => {
    (navigator as Nav).audioSession = { type: "auto" };
    applyAudioSession();
    expect((navigator as Nav).audioSession?.type).toBe("ambient");
  });

  it("is playback with the setting on", () => {
    (navigator as Nav).audioSession = { type: "auto" };
    playOnSilent.set(true);
    applyAudioSession();
    expect((navigator as Nav).audioSession?.type).toBe("playback");
  });

  it("re-applies the session type when toggled", () => {
    (navigator as Nav).audioSession = { type: "ambient" };
    setPlayOnSilent(true);
    expect((navigator as Nav).audioSession?.type).toBe("playback");
    setPlayOnSilent(false);
    expect((navigator as Nav).audioSession?.type).toBe("ambient");
  });

  it("persists across reloads", () => {
    setPlayOnSilent(true);
    expect(window.localStorage.getItem("game-audio:ui:playOnSilent")).toBe(
      "on"
    );
    playOnSilent.resetMemory();
    expect(playOnSilent.get()).toBe(true);
    setPlayOnSilent(false);
    expect(
      window.localStorage.getItem("game-audio:ui:playOnSilent")
    ).toBeNull();
  });

  it("does nothing where the browser has no audio session API", () => {
    expect(() => applyAudioSession()).not.toThrow();
    expect(() => setPlayOnSilent(true)).not.toThrow();
  });
});
