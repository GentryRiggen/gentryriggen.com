import { existsSync } from "node:fs";
import { join } from "node:path";
import { narrationHash } from "../hash";
import { narrationLines } from "../lines";
import { allClips } from "../manifest";

const FIX =
  "Run `npm run narration:ever-onward` (needs gcloud signed in) and commit the new clips and manifest.json.";

describe("narration manifest", () => {
  const lines = narrationLines();

  it("has lines to narrate", () => {
    expect(lines.length).toBeGreaterThan(20);
  });

  it.each(lines.map((l) => [l.id, l.text]))(
    "%s has a current clip",
    (id, text) => {
      const clip = allClips()[id];
      if (!clip) throw new Error(`No clip for ${id}. ${FIX}`);
      if (clip.hash !== narrationHash(text)) {
        throw new Error(
          `The text of ${id} changed since it was recorded. ${FIX}`
        );
      }
      expect(existsSync(join(process.cwd(), "public", clip.file))).toBe(true);
    }
  );

  it("has no clips for lines that are gone", () => {
    const ids = new Set(lines.map((l) => l.id));
    const orphans = Object.keys(allClips()).filter((id) => !ids.has(id));
    if (orphans.length > 0) {
      throw new Error(`Clips without a line: ${orphans.join(", ")}. ${FIX}`);
    }
  });
});
