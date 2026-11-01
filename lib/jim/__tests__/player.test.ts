import {
  JimPlayer,
  PLAYER_ERRORS,
  SILENT_CLIP,
  titleFor,
  type PlayerDeps,
  type SpeechFallback,
} from "../player";

/** Enough of an audio element for the player: src, play/pause, events. */
class FakeAudio extends EventTarget {
  src = "";
  paused = true;
  ended = false;
  preload = "";
  playbackRate = 1;
  defaultPlaybackRate = 1;
  currentTime = 0;
  duration = Number.NaN;
  /** What play() does: resolve (default) or reject (autoplay refused). */
  playResult: () => Promise<void> = () => Promise.resolve();
  play = jest.fn(() => {
    this.paused = false;
    this.ended = false;
    return this.playResult();
  });
  pause = jest.fn(() => {
    this.paused = true;
  });
  /** The part played to its end. */
  finish() {
    this.ended = true;
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
    this.dispatchEvent(new Event("ended"));
  }
}

interface Pending {
  text: string;
  voice: string | undefined;
  signal: AbortSignal;
  resolve: (blob: Blob) => void;
  reject: (err: unknown) => void;
}

function setup(options: { speech?: boolean; speed?: number } = {}) {
  const audio = new FakeAudio();
  const fetches: Pending[] = [];
  const urls: string[] = [];
  const revoked: string[] = [];
  let saved: number | null = null;
  const speech: jest.Mocked<SpeechFallback> = {
    speak: jest.fn<boolean, [string, () => void, number]>(() => true),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    unlock: jest.fn(),
  };
  const deps: PlayerDeps = {
    fetchAudio: jest.fn(
      (text: string, voice: string | undefined, signal: AbortSignal) =>
        new Promise<Blob>((resolve, reject) => {
          fetches.push({ text, voice, signal, resolve, reject });
        })
    ),
    createAudio: () => audio as unknown as HTMLAudioElement,
    createUrl: (blob) => {
      const url = `blob:test/${urls.length}:${(blob as unknown as { tag: string }).tag}`;
      urls.push(url);
      return url;
    },
    revokeUrl: (url) => revoked.push(url),
    speech: options.speech === false ? null : speech,
    loadSpeed: () => options.speed ?? 1,
    saveSpeed: (speed) => {
      saved = speed;
    },
  };
  const player = new JimPlayer(deps);
  return {
    player,
    audio,
    fetches,
    urls,
    revoked,
    speech,
    deps,
    saved: () => saved,
  };
}

/** A blob that says which part it is. */
function blob(tag: string): Blob {
  return { tag, size: 10 } as unknown as Blob;
}

/** Lets the player's awaits run. */
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

/** Three parts: a short first one, then two long ones. */
const LONG =
  "First sentence here. " +
  Array.from({ length: 60 }, (_, i) => `Sentence number ${i} is here.`).join(
    " "
  );

describe("JimPlayer", () => {
  it("fetches part 1, plays it, and fetches part 2 while it plays", async () => {
    const { player, audio, fetches, urls } = setup();
    expect(player.play("msg:1", LONG)).toBe(true);
    expect(player.getState()).toMatchObject({
      key: "msg:1",
      status: "loading",
      part: 0,
      engine: "audio",
    });
    const parts = player.getState().parts;
    expect(parts).toBeGreaterThanOrEqual(3);
    expect(fetches).toHaveLength(1);
    expect(fetches[0].text.length).toBeLessThanOrEqual(250);
    expect(fetches[0].voice).toBeUndefined();

    fetches[0].resolve(blob("p0"));
    await flush();
    expect(audio.src).toBe(urls[0]);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(player.getState()).toMatchObject({ status: "playing", part: 0 });
    // The next part is already on its way.
    expect(fetches).toHaveLength(2);
    expect(fetches[1].text.length).toBeLessThanOrEqual(600);
  });

  it("plays the parts in order and goes idle after the last, revoking each URL", async () => {
    const { player, audio, fetches, urls, revoked } = setup();
    player.play("msg:1", LONG);
    const parts = player.getState().parts;
    for (let i = 0; i < parts; i++) {
      fetches[i].resolve(blob(`p${i}`));
      await flush();
      expect(audio.src).toBe(urls[i]);
      expect(player.getState()).toMatchObject({ status: "playing", part: i });
      audio.finish();
      await flush();
    }
    expect(fetches).toHaveLength(parts);
    expect(player.getState()).toMatchObject({ status: "idle", key: null });
    expect(revoked).toEqual(urls);
  });

  it("shows loading between parts only when the next one isn't here yet", async () => {
    const { player, audio, fetches } = setup();
    player.play("msg:1", LONG);
    fetches[0].resolve(blob("p0"));
    await flush();
    audio.finish();
    await flush();
    expect(player.getState().status).toBe("loading");
    fetches[1].resolve(blob("p1"));
    await flush();
    expect(player.getState()).toMatchObject({ status: "playing", part: 1 });

    // Part 3 arrived while part 2 played: straight on.
    fetches[2].resolve(blob("p2"));
    await flush();
    const states: string[] = [];
    player.subscribe(() => states.push(player.getState().status));
    audio.finish();
    await flush();
    expect(states).not.toContain("loading");
    expect(player.getState().part).toBe(2);
  });

  it("falls back to the browser's speech when the first part fails", async () => {
    const { player, audio, fetches, speech } = setup({ speed: 1.5 });
    player.play("msg:1", "Here is **bold** news.");
    fetches[0].reject(new Error("502"));
    await flush();
    expect(audio.play).not.toHaveBeenCalled();
    expect(speech.speak).toHaveBeenCalledWith(
      "Here is **bold** news.",
      expect.any(Function),
      1.5
    );
    expect(player.getState()).toMatchObject({
      status: "playing",
      engine: "speech",
      key: "msg:1",
    });
    speech.speak.mock.calls[0][1]();
    expect(player.getState().status).toBe("idle");
  });

  it("says it couldn't play when the first part fails and there is no speech", async () => {
    const { player, fetches } = setup({ speech: false });
    player.play("msg:1", "Hello.");
    fetches[0].reject(new Error("offline"));
    await flush();
    expect(player.getState()).toMatchObject({
      status: "error",
      key: null,
      error: PLAYER_ERRORS.unavailable,
    });
    player.dismiss();
    expect(player.getState().status).toBe("idle");
  });

  it("stops with an error when a later part fails", async () => {
    const { player, audio, fetches, speech } = setup();
    player.play("msg:1", LONG);
    fetches[0].resolve(blob("p0"));
    await flush();
    fetches[1].reject(new Error("502"));
    await flush();
    // Still playing part 1 until it ends.
    expect(player.getState().status).toBe("playing");
    audio.finish();
    await flush();
    expect(player.getState()).toMatchObject({
      status: "error",
      error: PLAYER_ERRORS.rest,
    });
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it("never plays an older reply that lands after a newer one was tapped", async () => {
    const { player, audio, fetches } = setup();
    player.play("msg:1", "Old reply.");
    player.play("msg:2", "New reply.");
    expect(fetches[0].signal.aborted).toBe(true);
    fetches[1].resolve(blob("new"));
    await flush();
    fetches[0].resolve(blob("old"));
    await flush();
    expect(audio.src).toContain("new");
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(player.getState()).toMatchObject({
      key: "msg:2",
      status: "playing",
    });
  });

  it("drops a reply stopped while it loads, and a late failure doesn't fall back", async () => {
    const { player, audio, fetches, speech } = setup();
    player.play("msg:1", "First.");
    player.stop();
    fetches[0].resolve(blob("p0"));
    await flush();
    expect(audio.play).not.toHaveBeenCalled();

    player.play("msg:2", "Second.");
    player.stop();
    fetches[1].reject(new Error("aborted"));
    await flush();
    expect(speech.speak).not.toHaveBeenCalled();
    expect(player.getState().status).toBe("idle");
  });

  it("waits for a tap when autoplay is refused, then resumes", async () => {
    const { player, audio, fetches } = setup();
    audio.playResult = () =>
      Promise.reject(
        Object.assign(new Error("no"), { name: "NotAllowedError" })
      );
    player.play("msg:1", "Hello there.");
    fetches[0].resolve(blob("p0"));
    await flush();
    expect(player.getState().status).toBe("paused");
    audio.playResult = () => Promise.resolve();
    player.togglePause();
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(player.getState().status).toBe("playing");
  });

  it("pauses and resumes Jim's voice and the speech fallback", async () => {
    const { player, audio, fetches, speech } = setup();
    player.play("msg:1", "Hello there.");
    fetches[0].resolve(blob("p0"));
    await flush();
    player.togglePause();
    expect(audio.pause).toHaveBeenCalled();
    expect(player.getState().status).toBe("paused");
    // The pause event that follows doesn't confuse it.
    audio.dispatchEvent(new Event("pause"));
    player.togglePause();
    expect(player.getState().status).toBe("playing");

    player.play("msg:2", "Fallback.");
    fetches[1].reject(new Error("x"));
    await flush();
    player.togglePause();
    expect(speech.pause).toHaveBeenCalled();
    player.togglePause();
    expect(speech.resume).toHaveBeenCalled();
  });

  it("follows a pause from the system (a call, headphones out)", async () => {
    const { player, audio, fetches } = setup();
    player.play("msg:1", "Hello there.");
    fetches[0].resolve(blob("p0"));
    await flush();
    audio.paused = true;
    audio.dispatchEvent(new Event("pause"));
    expect(player.getState().status).toBe("paused");
  });

  it("sets the speed on the element (both rates), clamped, and remembers it", async () => {
    const { player, audio, fetches, saved } = setup({ speed: 1.25 });
    expect(player.getState().speed).toBe(1.25);
    player.play("msg:1", "Hello there.");
    fetches[0].resolve(blob("p0"));
    await flush();
    expect(audio.playbackRate).toBe(1.25);
    expect(audio.defaultPlaybackRate).toBe(1.25);
    player.setSpeed(9);
    expect(player.getState().speed).toBe(3);
    expect(audio.playbackRate).toBe(3);
    expect(saved()).toBe(3);
    player.setSpeed(0.6);
    expect(player.getState().speed).toBe(0.5);
  });

  it("asks for the given voice (a persona sample)", () => {
    const { player, fetches } = setup();
    player.play("persona:rook", "Hello.", { voice: "Charon" });
    expect(fetches[0].voice).toBe("Charon");
  });

  it("unlocks the element with a silent clip, but never over something playing", async () => {
    const { player, audio, fetches, speech } = setup();
    player.unlock();
    expect(speech.unlock).toHaveBeenCalled();
    expect(audio.src).toBe(SILENT_CLIP);
    expect(audio.play).toHaveBeenCalledTimes(1);
    await flush();
    expect(audio.pause).toHaveBeenCalled();
    // The clip's own end and pause are not the reply's.
    audio.finish();
    expect(player.getState().status).toBe("idle");

    player.play("msg:1", "Hello there.");
    fetches[0].resolve(blob("p0"));
    await flush();
    audio.play.mockClear();
    player.unlock();
    expect(audio.src).not.toBe(SILENT_CLIP);
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("returns false for nothing speakable", () => {
    const { player, fetches } = setup();
    expect(player.play("msg:1", "```\ncode\n```")).toBe(false);
    expect(fetches).toHaveLength(0);
    expect(player.getState().status).toBe("idle");
  });

  it("uses speech straight away where there is no audio element", () => {
    const { deps, speech } = setup();
    const player = new JimPlayer({ ...deps, createAudio: () => null });
    expect(player.supported).toBe(true);
    player.play("msg:1", "Hi.");
    expect(speech.speak).toHaveBeenCalled();
    expect(player.getState().engine).toBe("speech");
  });

  it("is unsupported with neither audio nor speech", () => {
    const { deps } = setup({ speech: false });
    const player = new JimPlayer({ ...deps, createAudio: () => null });
    expect(player.supported).toBe(false);
    expect(player.play("msg:1", "Hi.")).toBe(false);
  });
});

describe("titleFor", () => {
  it("keeps a short line and cuts a long one at 40 characters", () => {
    expect(titleFor("Short\nreply.")).toBe("Short reply.");
    const long = "a".repeat(50);
    expect(titleFor(long)).toBe(`${"a".repeat(40)}…`);
  });
});

describe("SILENT_CLIP", () => {
  it("is a WAV data URI", () => {
    expect(SILENT_CLIP.startsWith("data:audio/wav;base64,UklGR")).toBe(true);
  });
});
