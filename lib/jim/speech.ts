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

/**
 * Speaks `markdown` as a queue of chunks; `onEnd` fires once when the last
 * one finishes or the speech is cut off. Replaces whatever is speaking.
 * Returns false when there is nothing to say.
 */
export function speak(markdown: string, onEnd: () => void): boolean {
  const chunks = chunkForSpeech(speakableText(markdown));
  if (chunks.length === 0) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const voice = pickVoice(synth.getVoices());
  chunks.forEach((chunk, i) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "en-US";
    }
    utterance.rate = 1;
    if (i === chunks.length - 1) utterance.onend = onEnd;
    utterance.onerror = onEnd;
    synth.speak(utterance);
  });
  return true;
}

export function stopSpeaking(): void {
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
