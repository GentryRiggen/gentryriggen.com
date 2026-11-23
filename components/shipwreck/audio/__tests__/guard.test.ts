import fs from "node:fs";
import path from "node:path";
import {
  BRITANNIC_EVENT_CUES,
  CARPATHIA_EVENT_CUES,
  CUE_GAP_S,
  EVENT_CUES,
  FITZGERALD_EVENT_CUES,
  LUSITANIA_EVENT_CUES,
} from "../cues";

/**
 * The game's sound is made in the browser (Web Audio oscillators and
 * noise): nothing is downloaded or played from a file, and nothing is a
 * voice (no people shown or heard: no screams, cries or shouts).
 */
const DIR = path.join(__dirname, "..");
const sources = fs
  .readdirSync(DIR)
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({ f, text: fs.readFileSync(path.join(DIR, f), "utf8") }));

describe("the sound stays synthesised and has no voices", () => {
  it("finds the audio sources", () => {
    expect(sources.map((s) => s.f)).toEqual(
      expect.arrayContaining(["beds.ts", "cues.ts", "voices.ts"])
    );
  });

  it.each([
    ["fetch(", /\bfetch\s*\(/],
    ["decodeAudioData", /decodeAudioData/],
    ["new Audio", /new\s+Audio\s*\(/],
    ["createMediaElementSource", /createMediaElementSource/],
    [
      "an audio file",
      /["'`][^"'`]*\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm|mp4)["'`?#]/i,
    ],
  ])("no source uses %s", (_name, pattern) => {
    for (const { f, text } of sources)
      expect({ file: f, found: pattern.test(text) }).toEqual({
        file: f,
        found: false,
      });
  });

  it("no cue is named for a voice", () => {
    const voice =
      /scream|shout|cry|cries|yell|voice|vocal|call|wail|sob|moan|groan|gasp|laugh|speech|speak|word|sing|choir|human|people|person|child|baby|man|woman|crowd/i;
    const cues = new Set<string>([
      ...Object.keys(CUE_GAP_S),
      ...Object.values(EVENT_CUES),
      ...Object.values(LUSITANIA_EVENT_CUES),
      ...Object.values(FITZGERALD_EVENT_CUES),
      ...Object.values(BRITANNIC_EVENT_CUES),
      ...Object.values(CARPATHIA_EVENT_CUES),
    ]);
    expect(cues.size).toBeGreaterThan(5);
    for (const cue of cues)
      expect({ cue, voice: voice.test(cue) }).toEqual({
        cue,
        voice: false,
      });
  });
});
