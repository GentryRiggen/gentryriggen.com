import { mixWithOtherAudio } from "@/components/game-audio/audioSession";
import { softnessGain, watchReducedMotion } from "../../game-audio/channels";
import { midiToHz } from "../../game-audio/music";
import {
  createMusicPlayer,
  type MusicPlayer,
} from "../../game-audio/musicPlayer";
import {
  buildNoise,
  loopingNoise,
  tone,
  type VoiceEngine,
} from "../../game-audio/primitives";
import { comboSemitones, nextCombo, type ComboState } from "./combo";
import { createRateLimiter } from "./rateLimiter";
import { TITLE_SCORE, scoreForPhase, uneaseForPhase } from "./scores";
import {
  playAffordable,
  playBuyChord,
  playEndingMotif,
  playPhaseSwell,
  playReveal,
  playTapVoice,
  playThunder,
} from "./voices";

/**
 * Ever Onward's sound, all synthesized (no audio files). Nothing touches the
 * AudioContext until `enable()`, which must run inside a user gesture. Every
 * method is a safe no-op when audio is missing (jsdom, old browsers) or off.
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

export type CueName = "affordable" | "reveal" | "phase" | "ending";

const MASTER_LEVEL = 0.8;
/** User-facing loudness of the music bed: low, so it stays in the back. */
const MUSIC_LEVEL = 0.55;
const MAX_TAP_VOICES = 6;
const AFFORDABLE_GAP_MS = 1500;
const REVEAL_GAP_MS = 250;
const MUSIC_DISPOSE_MS = 2500;
const STORM_FADE_S = 1.2;
const STORM_LEVEL = 0.1;
const THUNDER_GAP_MS: readonly [number, number] = [7000, 15000];

interface Engine extends VoiceEngine {
  /** Sound effects connect to `bus`; music has its own gain. */
  musicBus: GainNode;
}

interface StormBed {
  gain: GainNode;
  sources: AudioBufferSourceNode[];
  thunder: ReturnType<typeof setTimeout> | null;
}

function createSynth() {
  let engine: Engine | null = null;
  let isEnabled = false;
  let isPaused = false;
  let isMusicOn = true;
  let isEffectsOn = true;
  let phase: number | null = null;
  let isStorm = false;
  let isTitle = false;
  let combo: ComboState | null = null;
  let tapEnds: number[] = [];
  let music: { player: MusicPlayer; specId: string } | null = null;
  let storm: StormBed | null = null;
  let uneaseTimer: ReturnType<typeof setTimeout> | null = null;
  let stopWatchingMotion: (() => void) | null = null;
  let holders = 0;
  const limiters = {
    affordable: createRateLimiter(AFFORDABLE_GAP_MS),
    reveal: createRateLimiter(REVEAL_GAP_MS),
  };

  const canPlay = () => isEnabled && isEffectsOn && !isPaused && !!engine;

  function build(): Engine | null {
    const Ctor = audioContextConstructor();
    if (!Ctor) return null;
    mixWithOtherAudio();
    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = MASTER_LEVEL * softnessGain();
      const limiterNode = ctx.createDynamicsCompressor();
      master.connect(limiterNode).connect(ctx.destination);
      const bus = ctx.createGain();
      bus.connect(master);
      const musicBus = ctx.createGain();
      musicBus.connect(master);
      stopWatchingMotion = watchReducedMotion(() => {
        master.gain.value = MASTER_LEVEL * softnessGain();
      });
      return {
        ctx,
        bus,
        musicBus,
        white: buildNoise(ctx, false),
        brown: buildNoise(ctx, true),
      };
    } catch {
      return null;
    }
  }

  function dropMusic(fadeMs = MUSIC_DISPOSE_MS) {
    if (!music) return;
    const { player } = music;
    music = null;
    player.stop();
    setTimeout(() => player.dispose(), fadeMs);
  }

  function clearUnease() {
    if (uneaseTimer !== null) clearTimeout(uneaseTimer);
    uneaseTimer = null;
  }

  /** Schedules the next rare dissonant swell for the current phase. */
  function scheduleUnease() {
    clearUnease();
    if (isTitle || phase === null || !engine || !music) return;
    const spec = uneaseForPhase(phase);
    if (!spec) return;
    const gapMs = spec.meanGapS * 1000 * (0.6 + Math.random() * 0.8);
    uneaseTimer = setTimeout(() => {
      uneaseTimer = null;
      if (engine && music && !isPaused && phase !== null) {
        const score = scoreForPhase(phase);
        const base = score.rootMidi + 12 + (Math.random() < 0.5 ? 0 : 7);
        for (const midi of [base, base + spec.interval]) {
          tone(
            { ...engine, bus: engine.musicBus },
            {
              type: "sine",
              start: engine.ctx.currentTime,
              duration: 5,
              freq: midiToHz(midi),
              gain: spec.gain,
              attack: 2.2,
            }
          );
        }
      }
      scheduleUnease();
    }, gapMs);
  }

  /** Brings the music in line with the switches, the phase and the tab. */
  function reconcileMusic() {
    const hasScore = isTitle || phase !== null;
    const shouldPlay =
      isEnabled && isMusicOn && !isPaused && hasScore && !!engine;
    if (!shouldPlay || !engine) {
      dropMusic();
      clearUnease();
      return;
    }
    const spec = isTitle ? TITLE_SCORE : scoreForPhase(phase ?? 0);
    if (music?.specId === spec.id) return;
    // A new phase crossfades: the old bed fades out as a fresh one fades in.
    dropMusic();
    const player = createMusicPlayer(engine.ctx, engine.musicBus);
    player.setLevel(MUSIC_LEVEL);
    player.start(spec);
    music = { player, specId: spec.id };
    scheduleUnease();
  }

  /** Rebases the music clock (flushing stale notes) and re-checks the beds. */
  function restartMusic() {
    music?.player.pause();
    music?.player.resume();
    reconcile();
  }

  function stopStorm() {
    if (!storm || !engine) return;
    const bed = storm;
    storm = null;
    if (bed.thunder !== null) clearTimeout(bed.thunder);
    const now = engine.ctx.currentTime;
    bed.gain.gain.cancelScheduledValues(now);
    bed.gain.gain.setTargetAtTime(0, now, STORM_FADE_S / 3);
    setTimeout(() => {
      for (const source of bed.sources) {
        try {
          source.stop();
        } catch {
          // Already stopped.
        }
        source.disconnect();
      }
      bed.gain.disconnect();
    }, STORM_FADE_S * 1000);
  }

  function scheduleThunder(bed: StormBed) {
    const [min, max] = THUNDER_GAP_MS;
    bed.thunder = setTimeout(
      () => {
        bed.thunder = null;
        if (storm !== bed) return;
        if (engine && canPlay()) playThunder(engine);
        scheduleThunder(bed);
      },
      min + Math.random() * (max - min)
    );
  }

  function reconcileStorm() {
    const shouldPlay = canPlay() && isStorm && phase === 0;
    if (!shouldPlay || !engine) {
      stopStorm();
      return;
    }
    if (storm) return;
    const { ctx } = engine;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(
      STORM_LEVEL * softnessGain(),
      ctx.currentTime,
      0.5
    );
    gain.connect(engine.bus);
    const sources: AudioBufferSourceNode[] = [];
    // Rain: filtered white noise. Wind: low brown noise.
    const rain = loopingNoise(ctx, engine.white);
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = "bandpass";
    rainFilter.frequency.value = 5500;
    rainFilter.Q.value = 0.5;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.35;
    rain.connect(rainFilter).connect(rainGain).connect(gain);
    const wind = loopingNoise(ctx, engine.brown);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 420;
    wind.connect(windFilter).connect(gain);
    sources.push(rain, wind);
    storm = { gain, sources, thunder: null };
    scheduleThunder(storm);
  }

  function reconcile() {
    reconcileMusic();
    reconcileStorm();
  }

  return {
    canPlay,
    isEnabled: () => isEnabled,

    /** Creates (first call) and resumes the context. Call from a gesture. */
    enable(): boolean {
      if (isEnabled) return true;
      // With music and sound both off, never open an audio session at all,
      // so the game stays silent and can't touch the player's podcast.
      if (!isMusicOn && !isEffectsOn) return false;
      engine ??= build();
      if (!engine) return false;
      void engine.ctx.resume?.();
      isEnabled = true;
      reconcile();
      return true;
    },

    /** A sound component holds the synth while mounted. */
    acquire(): () => void {
      holders += 1;
      return () => {
        holders -= 1;
        if (holders > 0) return;
        phase = null;
        isStorm = false;
        reconcile();
        clearUnease();
      };
    },

    /** The tab is hidden: silence everything and suspend the context. */
    pause() {
      if (isPaused) return;
      isPaused = true;
      music?.player.pause();
      reconcile();
      void engine?.ctx.suspend?.();
    },

    /**
     * Brings sound back after the tab returns or a gesture lands. iOS can
     * leave the context "suspended" or "interrupted" even while the tab is
     * visible (calls, lock, the app switcher), so this checks the context's
     * state rather than trusting `pause`. Safe to call on every gesture.
     */
    resume() {
      if (!isEnabled || !engine) return;
      const { ctx } = engine;
      const wasPaused = isPaused;
      isPaused = false;
      if (ctx.state === "running") {
        if (wasPaused) restartMusic();
        return;
      }
      // Resume must be asked inside a gesture on iOS; the music restarts once
      // the clock runs again so no bar is scheduled in the stale past.
      const restart = () => {
        if (engine?.ctx === ctx && !isPaused) restartMusic();
      };
      const resumed = ctx.resume?.();
      if (resumed) resumed.then(restart, () => undefined);
      else restart();
    },

    setMusicEnabled(on: boolean) {
      isMusicOn = on;
      reconcile();
    },

    setEffectsEnabled(on: boolean) {
      isEffectsOn = on;
      reconcile();
    },

    /** The phase whose score plays, or null for silence. */
    setPhase(next: number | null) {
      phase = next;
      reconcile();
    },

    /**
     * The title and hub theme. It outranks the phase score while on, so the
     * game screen can set its phase first and the theme hands over when the
     * title is switched off.
     */
    setTitle(on: boolean) {
      isTitle = on;
      reconcile();
    },

    setStorm(on: boolean) {
      isStorm = on;
      reconcileStorm();
    },

    /** One coin tap; rapid taps climb the pentatonic scale. */
    tap(tapPhase: number, now: number = Date.now()) {
      combo = nextCombo(combo, now);
      if (!canPlay() || !engine) return;
      const audioNow = engine.ctx.currentTime;
      tapEnds = tapEnds.filter((end) => end > audioNow);
      if (tapEnds.length >= MAX_TAP_VOICES) return;
      tapEnds.push(audioNow + 0.3);
      playTapVoice(engine, tapPhase, comboSemitones(combo.step), 1);
    },

    buy(phaseNow: number, isOneOff: boolean) {
      if (!canPlay() || !engine) return;
      playBuyChord(engine, phaseNow, isOneOff);
      music?.player.duck(isOneOff ? 0.5 : 0.3, isOneOff ? 1.1 : 0.6);
    },

    /** Other cues; the quiet ones are rate-limited. */
    cue(name: CueName, now: number = Date.now()) {
      if (!canPlay() || !engine) return;
      if (name === "affordable") {
        if (!limiters.affordable.allow(name, now)) return;
        playAffordable(engine);
      } else if (name === "reveal") {
        if (!limiters.reveal.allow(name, now)) return;
        playReveal(engine);
      } else if (name === "phase") {
        playPhaseSwell(engine, phase ?? 0);
        music?.player.duck(0.4, 2.5);
      } else {
        playEndingMotif(engine);
      }
    },

    /** Test hook: forget everything. */
    dispose() {
      clearUnease();
      stopStorm();
      dropMusic(0);
      stopWatchingMotion?.();
      stopWatchingMotion = null;
      void engine?.ctx.close?.();
      engine = null;
      isEnabled = false;
      isPaused = false;
      phase = null;
      isTitle = false;
      combo = null;
      tapEnds = [];
      holders = 0;
      limiters.affordable.reset();
      limiters.reveal.reset();
    },
  };
}

export type EverOnwardSynth = ReturnType<typeof createSynth>;

export const everOnwardSynth: EverOnwardSynth = createSynth();
export { createSynth as createEverOnwardSynth };
