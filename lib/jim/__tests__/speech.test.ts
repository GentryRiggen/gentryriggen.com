import {
  chunkForSpeech,
  loadAutoRead,
  pickVoice,
  saveAutoRead,
  speakableText,
} from "../speech";

describe("speakableText", () => {
  it("drops emphasis, code ticks and heading marks", () => {
    expect(
      speakableText("## Plan\nDo **this** and *that*, _then_ `run` it.")
    ).toBe("Plan\nDo this and that, then run it.");
  });

  it("keeps snake_case words intact", () => {
    expect(speakableText("Use my_var_name here")).toBe("Use my_var_name here");
  });

  it("drops list markup", () => {
    expect(speakableText("- one\n* two\n1. three\n2) four\n- [x] five")).toBe(
      "one\ntwo\nthree\nfour\nfive"
    );
  });

  it("reads only a link's label, never its URL", () => {
    expect(
      speakableText("See [the docs](https://example.com/a) or https://x.dev/b")
    ).toBe("See the docs or");
  });

  it("reads table cells separated by commas and skips the divider", () => {
    expect(
      speakableText("| Lift | Weight |\n|---|:---:|\n| Squat | 225 |")
    ).toBe("Lift, Weight\nSquat, 225");
  });

  it("skips fenced code blocks", () => {
    expect(speakableText("Before\n```ts\nconst a = 1;\n```\nAfter")).toBe(
      "Before\nAfter"
    );
  });

  it("returns an empty string for nothing speakable", () => {
    expect(speakableText("```\ncode\n```")).toBe("");
  });
});

describe("chunkForSpeech", () => {
  it("keeps short text in one chunk", () => {
    expect(chunkForSpeech("One. Two.")).toEqual(["One. Two."]);
  });

  it("splits long text at sentence ends, each within the limit", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Sentence ${i}.`).join(
      " "
    );
    const chunks = chunkForSpeech(text, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(100);
    expect(chunks.join(" ")).toBe(text);
  });

  it("splits one huge sentence at spaces", () => {
    const text = "word ".repeat(200).trim();
    const chunks = chunkForSpeech(text, 50);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(50);
    expect(chunks.join(" ")).toBe(text);
  });

  it("starts a new chunk at a paragraph break", () => {
    expect(chunkForSpeech("First.\nSecond.")).toEqual(["First.", "Second."]);
  });
});

describe("pickVoice", () => {
  const v = (name: string, lang: string, def = false) =>
    ({ name, lang, default: def }) as SpeechSynthesisVoice;

  it("prefers Premium, then Enhanced, then the en-US default", () => {
    const voices = [
      v("Fred", "en-US", true),
      v("Samantha (Enhanced)", "en-US"),
      v("Zoe (Premium)", "en-US"),
    ];
    expect(pickVoice(voices)?.name).toBe("Zoe (Premium)");
    expect(pickVoice(voices.slice(0, 2))?.name).toBe("Samantha (Enhanced)");
    expect(pickVoice(voices.slice(0, 1))?.name).toBe("Fred");
  });

  it("falls back to any English voice, ignoring other languages", () => {
    expect(pickVoice([v("Amelie", "fr-FR"), v("Daniel", "en-GB")])?.name).toBe(
      "Daniel"
    );
    expect(pickVoice([v("Amelie", "fr-FR")])).toBeNull();
    expect(pickVoice([])).toBeNull();
  });

  it("ignores a Premium voice in another language", () => {
    expect(
      pickVoice([v("Amelie (Premium)", "fr-FR"), v("Fred", "en-US")])?.name
    ).toBe("Fred");
  });
});

describe("auto-read setting", () => {
  beforeEach(() => window.localStorage.clear());

  it("defaults to Off and remembers On", () => {
    expect(loadAutoRead()).toBe(false);
    saveAutoRead(true);
    expect(loadAutoRead()).toBe(true);
    saveAutoRead(false);
    expect(loadAutoRead()).toBe(false);
  });

  it("survives storage that throws", () => {
    const get = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const set = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(loadAutoRead()).toBe(false);
    expect(() => saveAutoRead(true)).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});
