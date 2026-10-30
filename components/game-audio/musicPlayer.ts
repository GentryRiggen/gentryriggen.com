import {
  barSeconds,
  midiToHz,
  planBar,
  type MusicSpec,
  type NoteEvent,
} from "./music";

/**
 * Plays a `MusicSpec` as a quiet generative bed. A timer schedules whole bars
 * a little ahead of the audio clock, so a busy main thread never makes a gap.
 * Every note is one oscillator and one gain that disconnect when it ends.
 */

export interface MusicPlayer {
  /** Starts (or switches to) a bed. Switching spec ids restarts at bar 0. */
  start: (spec: MusicSpec) => void;
  /** Fades the bed out and stops scheduling. */
  stop: () => void;
  /** Stops scheduling at once (the context is about to be suspended). */
  pause: () => void;
  /** Starts scheduling again after `pause`. */
  resume: () => void;
  /** 0 to 1 user-facing loudness of the bed (a scene can lower it). */
  setLevel: (level: number) => void;
  /**
   * Dips the bed for `seconds` so a sound effect can be heard. Overlapping
   * ducks merge: the deepest dip and the latest release win.
   */
  duck: (amount: number, seconds: number) => void;
  isPlaying: () => boolean;
  dispose: () => void;
}

/** How far ahead of the audio clock bars are scheduled, seconds. */
export const LOOKAHEAD_S = 1.6;
export const TICK_MS = 400;
const FADE_OUT_S = 1.2;
const MAX_BED_LEVEL = 0.32;
/** Highest frequency the bed keeps, which keeps it soft on small speakers. */
const TONE_CUTOFF_HZ = 2600;

interface VoiceShape {
  type: (spec: MusicSpec) => OscillatorType;
  attack: (beatSeconds: number, beats: number) => number;
  gain: number;
}

const VOICES: Record<NoteEvent["voice"], VoiceShape> = {
  pad: {
    type: (spec) => spec.padWave,
    attack: (_beat, beats) => Math.min(1.2, beats * 0.25),
    gain: 0.5,
  },
  bass: { type: () => "sine", attack: () => 0.03, gain: 0.9 },
  lead: { type: (spec) => spec.leadWave, attack: () => 0.03, gain: 0.55 },
  pluck: { type: () => "triangle", attack: () => 0.006, gain: 0.6 },
};

export interface DuckState {
  /** 0 (none) to 1 (silent): the deepest dip still in force. */
  depth: number;
  /** Audio time the dip starts to release. */
  until: number;
}

export const NO_DUCK: DuckState = { depth: 0, until: Number.NEGATIVE_INFINITY };

/**
 * Folds a new duck into the one in force. A shallow or short duck can never
 * cancel a deeper or longer one: depth and release time only grow until the
 * old duck has released.
 */
export function mergeDuck(
  current: DuckState,
  now: number,
  amount: number,
  seconds: number
): DuckState {
  const depth = Math.min(1, Math.max(0, amount));
  const until = now + Math.max(0, seconds);
  if (now >= current.until) return { depth, until };
  return {
    depth: Math.max(current.depth, depth),
    until: Math.max(current.until, until),
  };
}

export function createMusicPlayer(
  ctx: AudioContext,
  destination: AudioNode
): MusicPlayer {
  const duckGain = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = TONE_CUTOFF_HZ;
  const levelGain = ctx.createGain();
  levelGain.gain.value = 0;
  duckGain.connect(tone).connect(levelGain).connect(destination);

  let spec: MusicSpec | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  let barIndex = 0;
  let nextBarAt = 0;
  let userLevel = 1;
  let duckState: DuckState = NO_DUCK;
  // Notes scheduled but not yet ended, so a pause can flush them.
  const live = new Set<{ osc: OscillatorNode; gain: GainNode }>();
  let isRunning = false;

  function targetLevel(): number {
    return (spec?.level ?? 0) * userLevel * MAX_BED_LEVEL;
  }

  function scheduleNote(
    current: MusicSpec,
    event: NoteEvent,
    barStart: number
  ) {
    const shape = VOICES[event.voice];
    const beatSeconds = 60 / current.tempo;
    const start = barStart + event.beat * beatSeconds;
    const length = Math.max(0.12, event.beats * beatSeconds);
    const end = start + length;
    const osc = ctx.createOscillator();
    osc.type = shape.type(current);
    osc.frequency.value = midiToHz(event.midi);
    const gain = ctx.createGain();
    const peak = Math.max(0.0002, event.gain * shape.gain * 0.5);
    const attack = Math.min(
      length * 0.6,
      shape.attack(beatSeconds, event.beats)
    );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(duckGain);
    osc.start(start);
    osc.stop(end + 0.05);
    const entry = { osc, gain };
    live.add(entry);
    osc.onended = () => {
      live.delete(entry);
      osc.disconnect();
      gain.disconnect();
    };
  }

  /** Stops and disconnects every scheduled note at once. */
  function flushNotes() {
    for (const { osc, gain } of live) {
      osc.onended = null;
      try {
        osc.stop();
      } catch {
        // Already stopped.
      }
      osc.disconnect();
      gain.disconnect();
    }
    live.clear();
  }

  function clearDuck() {
    duckState = NO_DUCK;
    const now = ctx.currentTime;
    duckGain.gain.cancelScheduledValues(now);
    duckGain.gain.setValueAtTime(1, now);
  }

  function tick() {
    if (!spec) return;
    const current = spec;
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    if (nextBarAt < ctx.currentTime) nextBarAt = ctx.currentTime + 0.05;
    while (nextBarAt < horizon) {
      for (const event of planBar(current, barIndex)) {
        scheduleNote(current, event, nextBarAt);
      }
      nextBarAt += barSeconds(current);
      barIndex += 1;
    }
  }

  function startTimer() {
    if (timer !== null) return;
    timer = setInterval(tick, TICK_MS);
  }

  function clearTimers() {
    if (timer !== null) clearInterval(timer);
    if (stopTimer !== null) clearTimeout(stopTimer);
    timer = null;
    stopTimer = null;
  }

  function start(next: MusicSpec) {
    if (stopTimer !== null) {
      // Restarting mid-fade: drop what the fade was still carrying so the
      // new bars do not sound on top of it.
      clearTimeout(stopTimer);
      stopTimer = null;
      flushNotes();
      clearDuck();
      nextBarAt = ctx.currentTime + 0.1;
    }
    // A spec change only matters at a bar line; the loop keeps its place
    // unless it is a different piece altogether.
    if (!spec || spec.id !== next.id) {
      barIndex = 0;
      nextBarAt = ctx.currentTime + 0.1;
    }
    spec = next;
    isRunning = true;
    const now = ctx.currentTime;
    levelGain.gain.cancelScheduledValues(now);
    levelGain.gain.setTargetAtTime(targetLevel(), now, 0.6);
    tick();
    startTimer();
  }

  function stop() {
    if (!isRunning) return;
    isRunning = false;
    const now = ctx.currentTime;
    levelGain.gain.cancelScheduledValues(now);
    levelGain.gain.setTargetAtTime(0, now, FADE_OUT_S / 4);
    if (timer !== null) clearInterval(timer);
    timer = null;
    // Notes already scheduled ring out under the fade; then forget the bed.
    stopTimer = setTimeout(() => {
      stopTimer = null;
      spec = null;
      flushNotes();
      clearDuck();
    }, FADE_OUT_S * 1000);
  }

  function pause() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    // Anything already scheduled would sound again on resume, doubling the
    // bar the next tick schedules.
    flushNotes();
    clearDuck();
    const now = ctx.currentTime;
    levelGain.gain.cancelScheduledValues(now);
    levelGain.gain.setValueAtTime(0, now);
  }

  function resume() {
    if (!isRunning || !spec) return;
    nextBarAt = ctx.currentTime + 0.1;
    const now = ctx.currentTime;
    levelGain.gain.cancelScheduledValues(now);
    levelGain.gain.setTargetAtTime(targetLevel(), now, 0.8);
    tick();
    startTimer();
  }

  function setLevel(next: number) {
    userLevel = Math.min(1, Math.max(0, next));
    if (!isRunning) return;
    levelGain.gain.setTargetAtTime(targetLevel(), ctx.currentTime, 0.4);
  }

  function duck(amount: number, seconds: number) {
    if (!isRunning) return;
    const now = ctx.currentTime;
    duckState = mergeDuck(duckState, now, amount, seconds);
    duckGain.gain.cancelScheduledValues(now);
    duckGain.gain.setTargetAtTime(1 - duckState.depth, now, 0.03);
    duckGain.gain.setTargetAtTime(1, duckState.until, 0.35);
  }

  function dispose() {
    clearTimers();
    flushNotes();
    isRunning = false;
    spec = null;
    duckGain.disconnect();
    tone.disconnect();
    levelGain.disconnect();
  }

  return {
    start,
    stop,
    pause,
    resume,
    setLevel,
    duck,
    isPlaying: () => isRunning,
    dispose,
  };
}
