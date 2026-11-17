import { createFakeAudio, type FakeContext } from "../testing/fakeAudio";
import {
  HEALTH_CHECK_MS,
  createResilientAudioContext,
} from "../resilientAudio";

const fake = createFakeAudio();

beforeEach(() => {
  jest.useFakeTimers();
  fake.reset();
  fake.install();
  delete (navigator as unknown as { audioSession?: unknown }).audioSession;
});
afterEach(() => {
  fake.uninstall();
  jest.useRealTimers();
});

const ctxOf = (i = 0) => fake.contexts[i] as FakeContext;

describe("createResilientAudioContext", () => {
  it("makes no context until the first gesture, then one", () => {
    const audio = createResilientAudioContext();
    expect(fake.contexts).toHaveLength(0);
    expect(audio.engine()).toBeNull();
    expect(audio.wake()).toBe(true);
    expect(fake.contexts).toHaveLength(1);
    expect(audio.engine()?.ctx).toBe(ctxOf());
    expect(ctxOf().resume).toHaveBeenCalled();
  });

  it("plays on the first tap even if the page was hidden before it", () => {
    const audio = createResilientAudioContext();
    audio.pause();
    audio.resume();
    audio.pause();
    expect(audio.wake()).toBe(true);
    expect(audio.engine()?.ctx).toBe(ctxOf());
  });

  it("sets the audio session before creating the context, ambient by default", () => {
    const order: string[] = [];
    const session = {
      get type() {
        return "auto";
      },
      set type(value: string) {
        order.push(`session:${value}:${fake.contexts.length}`);
      },
    };
    Object.defineProperty(navigator, "audioSession", {
      value: session,
      configurable: true,
    });
    createResilientAudioContext().wake();
    expect(order).toEqual(["session:ambient:0"]);
    fake.reset();
    order.length = 0;
    createResilientAudioContext({ session: "playback" }).wake();
    expect(order).toEqual(["session:playback:0"]);
  });

  it("suspends when hidden and resumes when visible", () => {
    const audio = createResilientAudioContext();
    audio.wake();
    audio.pause();
    expect(ctxOf().suspend).toHaveBeenCalled();
    expect(audio.engine()).toBeNull();
    audio.resume();
    expect(ctxOf().resume).toHaveBeenCalledTimes(2);
    expect(audio.engine()).not.toBeNull();
  });

  it("rebuilds an interrupted context on the next gesture, not before", () => {
    const audio = createResilientAudioContext();
    const seen: unknown[] = [];
    audio.onEngine((engine) => seen.push(engine.ctx));
    audio.wake();
    ctxOf().setState("interrupted");
    expect(audio.isBroken()).toBe(true);
    expect(audio.engine()).toBeNull();
    expect(fake.contexts).toHaveLength(1);
    audio.wake();
    expect(fake.contexts).toHaveLength(2);
    expect(ctxOf(0).close).toHaveBeenCalled();
    expect(audio.isBroken()).toBe(false);
    expect(audio.engine()?.ctx).toBe(ctxOf(1));
    expect(seen).toEqual([ctxOf(0), ctxOf(1)]);
  });

  it("rebuilds a context that says running but whose clock is frozen", () => {
    const audio = createResilientAudioContext();
    audio.wake();
    jest.advanceTimersByTime(HEALTH_CHECK_MS + 10);
    expect(audio.isBroken()).toBe(true);
    audio.wake();
    expect(fake.contexts).toHaveLength(2);
  });

  it("keeps a context whose clock is moving", () => {
    const audio = createResilientAudioContext();
    audio.wake();
    ctxOf().currentTime = 1;
    jest.advanceTimersByTime(HEALTH_CHECK_MS + 10);
    expect(audio.isBroken()).toBe(false);
    audio.wake();
    expect(fake.contexts).toHaveLength(1);
  });

  it("does not count a pause as an interruption", () => {
    const audio = createResilientAudioContext();
    audio.wake();
    audio.pause();
    ctxOf().setState("interrupted");
    expect(audio.isBroken()).toBe(false);
  });

  it("reports no support without AudioContext and never throws", () => {
    fake.uninstall();
    const audio = createResilientAudioContext();
    expect(audio.isSupported()).toBe(false);
    expect(audio.wake()).toBe(false);
    expect(audio.engine()).toBeNull();
  });

  it("closes the context on dispose", () => {
    const audio = createResilientAudioContext();
    audio.wake();
    audio.dispose();
    expect(ctxOf().close).toHaveBeenCalled();
    expect(audio.engine()).toBeNull();
  });
});
