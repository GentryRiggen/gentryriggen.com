/** Read-aloud for Jim's replies: plain text out of markdown, a good voice, chunks. */

const AUTO_READ_KEY = "jim:read-aloud";

/** Engines cut off long utterances (~200-300 words): keep each chunk short. */
export const MAX_CHUNK_CHARS = 250;

/**
 * Markdown to what a person would say. Drops the markup characters, keeps
 * link labels (never URLs), reads table cells separated by commas and skips
 * fenced code silently.
 */
export function speakableText(markdown: string): string {
  const lines: string[] = [];
  let inFence = false;
  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*(```|~~~)/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    // A table's divider row (|---|:---:|) says nothing.
    if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(raw)) continue;
    let line = raw;
    if (/^\s*\|.*\|\s*$/.test(line)) {
      line = line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(", ");
    }
    line = line
      .replace(/^\s{0,3}#{1,6}\s+/, "")
      .replace(/^\s*>\s?/, "")
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, "")
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<https?:\/\/[^>]*>/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/`+/g, "")
      .replace(/(\*\*|__|~~)/g, "")
      .replace(/\*/g, "")
      // Emphasis underscores only: snake_case keeps its own.
      .replace(/(^|[^\w])_+|_+(?=$|[^\w])/g, "$1");
    lines.push(line.trim());
  }
  return lines
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits at sentence ends (then spaces, if a sentence is huge) into short chunks. */
export function chunkForSpeech(
  text: string,
  max: number = MAX_CHUNK_CHARS
): string[] {
  const chunks: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const paragraph of text.split(/\n+/)) {
    const sentences = paragraph.match(/[^.!?]+(?:[.!?]+["')\]]*|$)\s*/g) ?? [];
    for (let sentence of sentences) {
      while (sentence.length > max) {
        const cut = sentence.lastIndexOf(" ", max);
        const at = cut > 0 ? cut : max;
        if (current.length + at > max) push();
        current += sentence.slice(0, at);
        push();
        sentence = sentence.slice(at).trimStart();
      }
      if (current.length + sentence.length > max) push();
      current += sentence;
    }
    // A paragraph break is a natural place to breathe.
    push();
  }
  return chunks;
}

/** Premium, then Enhanced, then the en-US default, then any English voice. */
export function pickVoice(
  voices: readonly SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  return (
    english.find((v) => v.name.includes("(Premium)")) ??
    english.find((v) => v.name.includes("(Enhanced)")) ??
    english.find((v) => /^en[-_]US$/i.test(v.lang) && v.default) ??
    english.find((v) => /^en[-_]US$/i.test(v.lang)) ??
    english[0] ??
    null
  );
}

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

/** Whether replies are read automatically on this device (default Off). */
export function loadAutoRead(): boolean {
  try {
    return window.localStorage.getItem(AUTO_READ_KEY) === "on";
  } catch {
    return false;
  }
}

export function saveAutoRead(on: boolean): void {
  try {
    window.localStorage.setItem(AUTO_READ_KEY, on ? "on" : "off");
  } catch {
    // Not remembered; the toggle still works for this visit.
  }
}

/** iOS drops a speak() that comes right after cancel(): wait this long. */
const AFTER_CANCEL_MS = 100;
/** Voices that never load: go with the default after this long. */
const VOICES_WAIT_MS = 1000;
/** Nothing started this long after speak(): the engine swallowed it. */
const START_WATCHDOG_MS = 2000;

let currentRun = 0;
let cachedVoice: SpeechSynthesisVoice | null = null;

/** Calls `ready` with the best voice, waiting briefly for voices to load. */
function withVoice(
  synth: SpeechSynthesis,
  ready: (voice: SpeechSynthesisVoice | null) => void
): void {
  if (cachedVoice) {
    ready(cachedVoice);
    return;
  }
  const choose = () => {
    const voices = synth.getVoices();
    if (voices.length > 0) cachedVoice = pickVoice(voices);
    return cachedVoice;
  };
  if (synth.getVoices().length > 0) {
    ready(choose());
    return;
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    synth.removeEventListener("voiceschanged", finish);
    ready(choose());
  };
  const timer = setTimeout(finish, VOICES_WAIT_MS);
  synth.addEventListener("voiceschanged", finish);
}

/**
 * Speaks `markdown` as a queue of chunks; `onEnd` fires once when the last
 * one finishes, any chunk fails, or the engine never starts. Replaces
 * whatever is speaking. Returns false when there is nothing to say.
 */
export function speak(markdown: string, onEnd: () => void): boolean {
  const chunks = chunkForSpeech(speakableText(markdown));
  if (chunks.length === 0) return false;
  const synth = window.speechSynthesis;
  const run = ++currentRun;
  const isCurrent = () => run === currentRun;
  const wasBusy = synth.speaking || synth.pending;
  synth.cancel();

  let ended = false;
  let started = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (ended) return;
    ended = true;
    clearTimeout(watchdog);
    onEnd();
  };
  // A failed chunk ends the whole run, but never cancels a newer one.
  const fail = () => {
    if (isCurrent()) synth.cancel();
    finish();
  };

  const begin = () => {
    if (!isCurrent()) return;
    withVoice(synth, (voice) => {
      if (!isCurrent()) return;
      // iOS can leave the engine paused after the app was in the background.
      synth.resume();
      chunks.forEach((chunk, i) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = voice?.lang ?? "en-US";
        if (voice) utterance.voice = voice;
        utterance.rate = 1;
        utterance.onstart = () => {
          started = true;
        };
        if (i === chunks.length - 1) utterance.onend = finish;
        utterance.onerror = fail;
        synth.speak(utterance);
      });
      watchdog = setTimeout(() => {
        if (!started && !synth.speaking && !synth.pending) fail();
      }, START_WATCHDOG_MS);
    });
  };

  if (wasBusy) setTimeout(begin, AFTER_CANCEL_MS);
  else begin();
  return true;
}

export function stopSpeaking(): void {
  currentRun += 1;
  if (speechSupported()) window.speechSynthesis.cancel();
}

/**
 * iOS only lets speech start inside a tap: a silent utterance spoken there
 * unlocks the later automatic read.
 */
export function unlockSpeech(): void {
  if (!speechSupported()) return;
  const utterance = new SpeechSynthesisUtterance(" ");
  utterance.volume = 0;
  window.speechSynthesis.speak(utterance);
}
