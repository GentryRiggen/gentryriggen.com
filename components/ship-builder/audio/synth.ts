import {
  buildNoise,
  noise,
  tone,
  type VoiceEngine,
} from "../../game-audio/primitives";
import {
  createMusicPlayer,
  type MusicPlayer,
} from "../../game-audio/musicPlayer";
import type { MusicSpec } from "../../game-audio/music";
import { softnessGain, watchReducedMotion } from "../../game-audio/channels";
import type { AmbientParams, Cue } from "./cues";
import {
  buildShipBeds,
  SILENT_BEDS,
  type BedLevels,
  type ShipBeds,
} from "./shipBeds";
import {
  playBell,
  playChallengeSting,
  playFunnelCrash,
  playHorn,
  playPaint,
  playPlace,
  playRemove,
  playSting,
  playWhoosh,
} from "./shipVoices";

/**
 * Every sound here is synthesized with the Web Audio API (no audio files).
 * Each one-shot builds a small graph of oscillators, noise and filters that
 * disconnects itself when it ends. Nothing touches the AudioContext until
 * `enable()`, which must run inside a click or key press.
 */

type AudioContextConstructor = typeof AudioContext;

function audioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const legacy = window as unknown as {
    webkitAudioContext?: AudioContextConstructor;
  };
  return window.AudioContext ?? legacy.webkitAudioContext;
}

export function isAudioSupported(): boolean {
  return audioContextConstructor() !== undefined;
}

export interface TrialSynth {
  /** Creates (first call) and resumes the context. Call from a user gesture. */
  enable: () => boolean;
  /** Silences everything and suspends the context. */
  disable: () => void;
  isEnabled: () => boolean;
  /**
   * Cuts the held sounds at once and suspends the context (the tab went
   * to the background and nothing is driving the beds). Stays enabled.
   */
  pause: () => void;
  /** Wakes a paused context. The next `setAmbient` brings the beds back. */
  resume: () => void;
  play: (cue: Cue) => void;
  setAmbient: (ambient: AmbientParams) => void;
  /** 0 clear to 1 heavily muffled (underwater, slow motion). */
  setMuffle: (amount: number) => void;
  /** Playback speed, which drags the pitch of the held tones down. */
  setSpeed: (speed: number) => void;
  /** The world's held sounds: waves, wind, engine thrum, bow wave, rush. */
  setBeds: (levels: BedLevels) => void;
  /** Whether a one-shot cue would be heard right now. */
  canPlay: () => boolean;
  /**
   * A sound component calls this while it is mounted and calls the returned
   * function on unmount. When the last one lets go, the held beds and music
   * are torn down and the context is suspended; the next `acquire` rebuilds
   * them.
   */
  acquire: () => () => void;
  /** Sound effects on or off (the held beds follow). */
  setEffectsEnabled: (isOn: boolean) => void;
  /** Music on or off. It only plays while the audio is unlocked. */
  setMusicEnabled: (isOn: boolean) => void;
  /** The bed to play, or null for none. */
  setMusic: (spec: MusicSpec | null) => void;
  /** 0 to 1: a scene can turn the bed down. */
  setMusicLevel: (level: number) => void;
}

const NOISE_SECONDS = 3;
const CLEAR_CUTOFF_HZ = 14000;
const MUFFLED_CUTOFF_HZ = 260;
const MASTER_LEVEL = 0.8;
/** Smallest change in muffle or speed (0 to 1) worth sending to the audio thread. */
const MIN_PARAM_STEP = 0.01;

interface Engine extends VoiceEngine {
  /** Everything audible connects to `bus`: gain, then the muffle lowpass. */
  muffle: BiquadFilterNode;
}

function buildEngine(Ctor: AudioContextConstructor): Engine {
  const ctx = new Ctor();
  const bus = ctx.createGain();
  bus.gain.value = MASTER_LEVEL * softnessGain();
  const muffle = ctx.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = CLEAR_CUTOFF_HZ;
  muffle.Q.value = 0.7;
  const limiter = ctx.createDynamicsCompressor();
  bus.connect(muffle).connect(limiter).connect(ctx.destination);
  return {
    ctx,
    bus,
    muffle,
    white: buildNoise(ctx, false),
    brown: buildNoise(ctx, true),
  };
}

/** Disconnects every node once `last` ends, so nothing lingers. */
function disconnectOnEnd(last: AudioScheduledSourceNode, nodes: AudioNode[]) {
  last.onended = () => {
    for (const node of nodes) node.disconnect();
  };
}

/** Stressed steel: low detuned saws through a resonant, bending bandpass. */
function playCreak(engine: Engine, intensity: number) {
  const now = engine.ctx.currentTime;
  const duration = 0.9 + intensity * 1.6 + Math.random() * 0.5;
  const base = 38 + Math.random() * 40 + intensity * 25;
  // A slow pitch bend up or down, as the plate shifts and sticks.
  const bend = Math.random() < 0.5 ? 0.78 : 1.3;
  const sweepFrom = 260 + Math.random() * 200;
  const sweepTo = sweepFrom * (bend < 1 ? 0.6 : 1.9);
  for (const detune of [-18, 4, 21]) {
    tone(engine, {
      type: "sawtooth",
      start: now,
      duration,
      freq: base,
      freqEnd: base * bend,
      detune,
      gain: 0.05 + intensity * 0.09,
      attack: duration * 0.35,
      filter: {
        type: "bandpass",
        freq: sweepFrom,
        freqEnd: sweepTo,
        q: 9 + intensity * 6,
      },
    });
  }
  // Grit: the rasp of metal rubbing on metal.
  noise(engine, {
    buffer: engine.white,
    start: now,
    duration,
    filter: "bandpass",
    freq: sweepFrom * 1.6,
    freqEnd: sweepTo * 1.6,
    q: 14,
    gain: 0.02 + intensity * 0.05,
    attack: duration * 0.4,
    chop: 0.04,
  });
}

/** Ice dragging along the hull, with a rumble underneath. */
function playImpact(engine: Engine) {
  const now = engine.ctx.currentTime;
  noise(engine, {
    buffer: engine.brown,
    start: now,
    duration: 2.6,
    filter: "lowpass",
    freq: 220,
    freqEnd: 60,
    gain: 1.1,
    attack: 0.02,
  });
  noise(engine, {
    buffer: engine.white,
    start: now,
    duration: 2.1,
    filter: "bandpass",
    freq: 1300,
    freqEnd: 420,
    q: 2.5,
    gain: 0.35,
    attack: 0.15,
    chop: 0.03,
  });
  tone(engine, {
    type: "sine",
    start: now,
    duration: 0.9,
    freq: 90,
    freqEnd: 32,
    gain: 0.9,
  });
}

/** The hull gives way: a layered crack, a sub boom, a long tearing groan. */
function playBreak(engine: Engine) {
  const now = engine.ctx.currentTime;
  for (const [delay, level] of [
    [0, 1],
    [0.06, 0.7],
    [0.17, 0.45],
  ] as const) {
    noise(engine, {
      buffer: engine.white,
      start: now + delay,
      duration: 0.35,
      filter: "highpass",
      freq: 1400,
      freqEnd: 600,
      gain: 0.9 * level,
      attack: 0.002,
    });
  }
  tone(engine, {
    type: "sine",
    start: now + 0.02,
    duration: 3.2,
    freq: 62,
    freqEnd: 22,
    gain: 1.3,
    attack: 0.015,
  });
  tone(engine, {
    type: "triangle",
    start: now + 0.02,
    duration: 1.4,
    freq: 130,
    freqEnd: 40,
    gain: 0.6,
    attack: 0.01,
  });
  noise(engine, {
    buffer: engine.brown,
    start: now,
    duration: 3.6,
    filter: "lowpass",
    freq: 400,
    freqEnd: 70,
    gain: 1.4,
    attack: 0.01,
  });
  // The groan: noise sliding down through a narrow band, torn into pieces.
  noise(engine, {
    buffer: engine.white,
    start: now + 0.1,
    duration: 5.5,
    filter: "bandpass",
    freq: 1100,
    freqEnd: 130,
    q: 7,
    gain: 0.75,
    attack: 0.25,
    chop: 0.045,
  });
  for (const detune of [-25, 0, 30]) {
    tone(engine, {
      type: "sawtooth",
      start: now + 0.15,
      duration: 5,
      freq: 52,
      freqEnd: 27,
      detune,
      gain: 0.16,
      attack: 0.6,
      filter: { type: "bandpass", freq: 420, freqEnd: 120, q: 8 },
    });
  }
}

function playFlicker(engine: Engine) {
  const now = engine.ctx.currentTime;
  tone(engine, {
    type: "square",
    start: now,
    duration: 0.07 + Math.random() * 0.05,
    freq: 100 + Math.random() * 20,
    gain: 0.12,
    attack: 0.003,
    filter: { type: "bandpass", freq: 700, q: 3 },
  });
  noise(engine, {
    buffer: engine.white,
    start: now,
    duration: 0.03,
    filter: "highpass",
    freq: 3000,
    gain: 0.3,
    attack: 0.001,
  });
}

function playPowerOut(engine: Engine) {
  const now = engine.ctx.currentTime;
  tone(engine, {
    type: "sawtooth",
    start: now,
    duration: 2.2,
    freq: 130,
    freqEnd: 24,
    gain: 0.22,
    attack: 0.03,
    filter: { type: "lowpass", freq: 900, freqEnd: 60, q: 2 },
  });
  tone(engine, {
    type: "sine",
    start: now,
    duration: 0.5,
    freq: 70,
    freqEnd: 40,
    gain: 0.5,
  });
  noise(engine, {
    buffer: engine.white,
    start: now,
    duration: 0.04,
    filter: "highpass",
    freq: 2500,
    gain: 0.4,
    attack: 0.001,
  });
}

/** Water chuckling and sucking through the decks. */
function playGurgle(engine: Engine) {
  const now = engine.ctx.currentTime;
  const duration = 0.7 + Math.random() * 0.6;
  const source = engine.ctx.createBufferSource();
  source.buffer = engine.white;
  source.loop = true;
  const filter = engine.ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 11;
  let freq = 250 + Math.random() * 200;
  for (let t = 0; t < duration; t += 0.05) {
    freq = Math.min(900, Math.max(150, freq * (0.8 + Math.random() * 0.5)));
    filter.frequency.setValueAtTime(freq, now + t);
  }
  const gain = engine.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.28, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter).connect(gain).connect(engine.bus);
  source.start(now, Math.random() * (NOISE_SECONDS - 0.1));
  source.stop(now + duration + 0.05);
  disconnectOnEnd(source, [source, filter, gain]);
}

function playTouchdown(engine: Engine) {
  const now = engine.ctx.currentTime;
  tone(engine, {
    type: "sine",
    start: now,
    duration: 0.8,
    freq: 85,
    freqEnd: 28,
    gain: 1,
  });
  noise(engine, {
    buffer: engine.brown,
    start: now,
    duration: 1.4,
    filter: "lowpass",
    freq: 260,
    freqEnd: 70,
    gain: 1,
    attack: 0.01,
  });
}

interface AmbientBeds {
  seaGain: GainNode;
  humGain: GainNode;
  humOscillators: { osc: OscillatorNode; base: number }[];
  /** Stops the sources and unplugs the graph. */
  dispose: () => void;
}

/** The two held sounds: sea bed noise and the ship's electrical hum. */
function buildAmbientBeds(engine: Engine): AmbientBeds {
  const { ctx, bus } = engine;
  const seaGain = ctx.createGain();
  seaGain.gain.value = 0;
  const sea = ctx.createBufferSource();
  sea.buffer = engine.brown;
  sea.loop = true;
  const seaFilter = ctx.createBiquadFilter();
  seaFilter.type = "lowpass";
  seaFilter.frequency.value = 520;
  // Slow swell, like waves arriving.
  const swell = ctx.createOscillator();
  swell.frequency.value = 0.11;
  const swellDepth = ctx.createGain();
  swellDepth.gain.value = 0.3;
  const swellGain = ctx.createGain();
  swellGain.gain.value = 0.7;
  swell.connect(swellDepth).connect(swellGain.gain);
  sea.connect(seaFilter).connect(swellGain).connect(seaGain).connect(bus);
  sea.start();
  swell.start();

  const humGain = ctx.createGain();
  humGain.gain.value = 0;
  humGain.connect(bus);
  const humOscillators = [
    { type: "sine" as const, base: 50, detune: 0 },
    { type: "triangle" as const, base: 100, detune: 6 },
    { type: "sine" as const, base: 150, detune: -4 },
  ].map(({ type, base, detune }) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = base;
    osc.detune.value = detune;
    const level = ctx.createGain();
    level.gain.value = base === 50 ? 1 : 0.35;
    osc.connect(level).connect(humGain);
    osc.start();
    return { osc, base };
  });
  return {
    seaGain,
    humGain,
    humOscillators,
    dispose() {
      for (const source of [sea, swell, ...humOscillators.map((h) => h.osc)]) {
        source.stop();
        source.disconnect();
      }
      for (const node of [seaGain, humGain, seaFilter, swellDepth, swellGain]) {
        node.disconnect();
      }
    },
  };
}

const SEA_LEVEL = 0.22;
const HUM_LEVEL = 0.05;

/** How much each loud cue dips the music, and for how long (seconds). */
const DUCK: Partial<Record<Cue["kind"], readonly [number, number]>> = {
  impact: [0.7, 2.2],
  break: [0.85, 4],
  "power-out": [0.5, 1.5],
  touchdown: [0.5, 1],
  "funnel-crash": [0.5, 1.8],
  horn: [0.55, 1.3],
  bell: [0.3, 0.8],
  sting: [0.45, 1.6],
  challenge: [0.5, 1.8],
  creak: [0.25, 0.8],
  groan: [0.25, 1],
};

export function createTrialSynth(): TrialSynth {
  let engine: Engine | null = null;
  let beds: AmbientBeds | null = null;
  let worldBeds: ShipBeds | null = null;
  let music: MusicPlayer | null = null;
  let stopWatchingMotion: (() => void) | null = null;
  let holders = 0;
  let lastMuffle = 0;
  let isOn = false;
  let isEffectsOn = true;
  let isMusicOn = true;
  let isPaused = false;
  let wantedMusic: MusicSpec | null = null;
  let musicLevel = 1;
  let ambient: AmbientParams = { sea: false, hum: false };
  let worldLevels: BedLevels = SILENT_BEDS;
  // What the audio thread was last told, so a steady frame sends nothing.
  let applied: AmbientParams | null = null;
  let appliedMuffle: number | null = null;
  let appliedSpeed: number | null = null;

  function applyAmbient() {
    if (!engine || !beds) return;
    const t = engine.ctx.currentTime;
    const sea = ambient.sea && isEffectsOn;
    const hum = ambient.hum && isEffectsOn;
    if (!applied || applied.sea !== sea) {
      beds.seaGain.gain.setTargetAtTime(sea ? SEA_LEVEL : 0, t, 0.4);
    }
    if (!applied || applied.hum !== hum) {
      beds.humGain.gain.setTargetAtTime(hum ? HUM_LEVEL : 0, t, 0.3);
    }
    applied = { sea, hum };
  }

  function applyWorld() {
    if (!worldBeds) return;
    worldBeds.update(isEffectsOn && !isPaused ? worldLevels : SILENT_BEDS);
  }

  function applyMusic() {
    if (!music) return;
    music.setLevel(musicLevel);
    if (isOn && isMusicOn && !isPaused && wantedMusic) music.start(wantedMusic);
    else music.stop();
  }

  /** Applies the master level, which follows reduced motion and the muffle. */
  function applyMaster() {
    if (!engine) return;
    engine.bus.gain.setTargetAtTime(
      MASTER_LEVEL * softnessGain() * (1 - 0.35 * lastMuffle),
      engine.ctx.currentTime,
      0.15
    );
  }

  /** The beds and music hang on the engine; they can be torn down and rebuilt. */
  function buildGraph(built: Engine) {
    beds = buildAmbientBeds(built);
    worldBeds = buildShipBeds(built);
    music = createMusicPlayer(built.ctx, built.bus);
    applied = null;
    stopWatchingMotion = watchReducedMotion(applyMaster);
  }

  function teardownGraph() {
    stopWatchingMotion?.();
    stopWatchingMotion = null;
    music?.dispose();
    worldBeds?.dispose();
    beds?.dispose();
    music = null;
    worldBeds = null;
    beds = null;
    applied = null;
  }

  function enable(): boolean {
    const Ctor = audioContextConstructor();
    if (!Ctor) return false;
    try {
      if (!engine) engine = buildEngine(Ctor);
      if (!beds) buildGraph(engine);
      void engine.ctx.resume();
    } catch {
      teardownGraph();
      engine = null;
      appliedMuffle = null;
      appliedSpeed = null;
      return false;
    }
    isOn = true;
    isPaused = false;
    applyAmbient();
    applyWorld();
    applyMusic();
    return true;
  }

  function acquire(): () => void {
    holders += 1;
    if (holders === 1 && isOn && engine) {
      // Back after the last sound component left: rebuild what it dropped.
      if (!beds) buildGraph(engine);
      isPaused = false;
      void engine.ctx.resume();
      applyAmbient();
      applyWorld();
      applyMusic();
    }
    let isReleased = false;
    return () => {
      if (isReleased) return;
      isReleased = true;
      holders -= 1;
      if (holders > 0) return;
      // Nothing is driving the audio any more: free the graph and go quiet.
      teardownGraph();
      if (engine) void engine.ctx.suspend();
    };
  }

  function disable() {
    isOn = false;
    music?.stop();
    worldBeds?.silence();
    if (engine) void engine.ctx.suspend();
  }

  function pause() {
    ambient = { sea: false, hum: false };
    isPaused = true;
    if (!engine || !beds) return;
    // A suspended context would not run a fade, so cut the beds first.
    const t = engine.ctx.currentTime;
    for (const { gain } of [beds.seaGain, beds.humGain]) {
      gain.cancelScheduledValues(t);
      gain.setValueAtTime(0, t);
    }
    applied = { sea: false, hum: false };
    worldBeds?.silence();
    music?.pause();
    void engine.ctx.suspend();
  }

  function resume() {
    if (!isOn || !engine) return;
    isPaused = false;
    void engine.ctx.resume();
    applyWorld();
    music?.resume();
    applyMusic();
  }

  function canPlay(): boolean {
    return isOn && !!engine && !!beds && isEffectsOn && !isPaused;
  }

  function play(cue: Cue) {
    if (!canPlay() || !engine) return;
    const ducking = DUCK[cue.kind];
    if (ducking) music?.duck(ducking[0], ducking[1]);
    switch (cue.kind) {
      case "impact":
        return playImpact(engine);
      case "creak":
        return playCreak(engine, cue.intensity);
      case "groan":
        return playCreak(engine, 0.3);
      case "flicker":
        return playFlicker(engine);
      case "power-out":
        return playPowerOut(engine);
      case "break":
        return playBreak(engine);
      case "gurgle":
        return playGurgle(engine);
      case "touchdown":
        return playTouchdown(engine);
      case "funnel-crash":
        return playFunnelCrash(engine);
      case "place":
        return playPlace(engine);
      case "remove":
        return playRemove(engine);
      case "paint":
        return playPaint(engine);
      case "undo":
        return playWhoosh(engine, false);
      case "redo":
        return playWhoosh(engine, true);
      case "horn":
        return playHorn(engine);
      case "bell":
        return playBell(engine);
      case "sting":
        return playSting(engine, cue.outcome);
      case "challenge":
        return playChallengeSting(engine, cue.stars);
    }
  }

  function setAmbient(next: AmbientParams) {
    ambient = next;
    applyAmbient();
  }

  function setBeds(levels: BedLevels) {
    worldLevels = levels;
    applyWorld();
  }

  function setEffectsEnabled(next: boolean) {
    if (isEffectsOn === next) return;
    isEffectsOn = next;
    applyAmbient();
    applyWorld();
  }

  function setMusicEnabled(next: boolean) {
    isMusicOn = next;
    applyMusic();
  }

  function setMusic(spec: MusicSpec | null) {
    wantedMusic = spec;
    applyMusic();
  }

  function setMusicLevel(level: number) {
    musicLevel = level;
    music?.setLevel(level);
  }

  function setMuffle(amount: number) {
    if (!engine) return;
    const m = Math.min(1, Math.max(0, amount));
    if (
      appliedMuffle !== null &&
      Math.abs(m - appliedMuffle) < MIN_PARAM_STEP
    ) {
      return;
    }
    appliedMuffle = m;
    lastMuffle = m;
    const cutoff = CLEAR_CUTOFF_HZ * (MUFFLED_CUTOFF_HZ / CLEAR_CUTOFF_HZ) ** m;
    const t = engine.ctx.currentTime;
    engine.muffle.frequency.setTargetAtTime(cutoff, t, 0.15);
    applyMaster();
  }

  function setSpeed(next: number) {
    if (!engine || !beds) return;
    if (
      appliedSpeed !== null &&
      Math.abs(next - appliedSpeed) < MIN_PARAM_STEP
    ) {
      return;
    }
    appliedSpeed = next;
    const t = engine.ctx.currentTime;
    // The hum sags in slow motion, like a tape slowing down.
    const pitch = 0.5 + 0.5 * next;
    for (const { osc, base } of beds.humOscillators) {
      osc.frequency.setTargetAtTime(base * pitch, t, 0.2);
    }
  }

  return {
    enable,
    disable,
    isEnabled: () => isOn,
    pause,
    resume,
    play,
    setAmbient,
    setMuffle,
    setSpeed,
    setBeds,
    canPlay,
    acquire,
    setEffectsEnabled,
    setMusicEnabled,
    setMusic,
    setMusicLevel,
  };
}

/** The one synth the toggle, the trial's sound and the scene share. */
export const trialSynth: TrialSynth = createTrialSynth();
