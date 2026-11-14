/**
 * Speeds speech up (or slows it down) without changing its pitch, so a voice
 * at 2x still sounds like the same person, not a balloon of helium.
 *
 * It is WSOLA (waveform-similarity overlap-add): the output is built from
 * short overlapping windows of the input, taken `rate` times further apart
 * than they are laid down, and each window is nudged a little to line up
 * with the waveform it continues so the joins do not click or warble.
 */

/** Window length (seconds): a few pitch periods of a speaking voice. */
const FRAME_S = 0.04;
/** How far a window may be nudged (seconds) to line up with the last one. */
const SEEK_S = 0.012;
/** Compare every few samples when lining up; plenty for speech. */
const STRIDE = 4;

/**
 * Time-stretches channel data. Returns new channels about `1 / rate` as long.
 * `rate` 1 hands back copies of the input.
 */
export function stretchChannels(
  channels: readonly Float32Array[],
  sampleRate: number,
  rate: number
): Float32Array[] {
  const input = channels[0];
  if (!input || rate === 1 || !Number.isFinite(rate) || rate <= 0) {
    return channels.map((c) => c.slice());
  }
  const frame = Math.max(64, Math.round(FRAME_S * sampleRate));
  const hopOut = Math.floor(frame / 2);
  const hopIn = hopOut * rate;
  const seek = Math.round(SEEK_S * sampleRate);
  const length = input.length;
  const outLength = Math.ceil(length / rate) + frame;

  const window = new Float32Array(frame);
  for (let i = 0; i < frame; i += 1) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frame - 1));
  }

  const outs = channels.map(() => new Float32Array(outLength));
  const weight = new Float32Array(outLength);
  let previous = 0;

  for (let k = 0; ; k += 1) {
    const outAt = k * hopOut;
    const ideal = Math.round(k * hopIn);
    if (ideal + frame >= length || outAt + frame >= outLength) break;

    // Pick the window near `ideal` that best continues the last one.
    let best = ideal;
    if (k > 0) {
      const natural = previous + hopOut;
      if (natural + frame < length) {
        let bestScore = -Infinity;
        const from = Math.max(0, ideal - seek);
        const to = Math.min(length - frame - 1, ideal + seek);
        for (let at = from; at <= to; at += 2) {
          let score = 0;
          for (let i = 0; i < frame; i += STRIDE) {
            score += input[natural + i] * input[at + i];
          }
          if (score > bestScore) {
            bestScore = score;
            best = at;
          }
        }
      }
    }

    for (let c = 0; c < channels.length; c += 1) {
      const source = channels[c];
      const out = outs[c];
      for (let i = 0; i < frame; i += 1) {
        out[outAt + i] += source[best + i] * window[i];
      }
    }
    for (let i = 0; i < frame; i += 1) weight[outAt + i] += window[i];
    previous = best;
  }

  // Undo the windows' overlap so the level stays even.
  let end = 0;
  for (let i = 0; i < outLength; i += 1) {
    if (weight[i] > 1e-3) {
      for (const out of outs) out[i] /= weight[i];
      end = i + 1;
    }
  }
  return outs.map((out) => out.slice(0, end));
}

/** An AudioBuffer stretched to play `rate` times as fast at its own pitch. */
export function stretchBuffer(
  context: BaseAudioContext,
  buffer: AudioBuffer,
  rate: number
): AudioBuffer {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
    buffer.getChannelData(c)
  );
  const stretched = stretchChannels(channels, buffer.sampleRate, rate);
  const out = context.createBuffer(
    stretched.length,
    Math.max(1, stretched[0]?.length ?? 1),
    buffer.sampleRate
  );
  stretched.forEach((data, c) => out.getChannelData(c).set(data));
  return out;
}
