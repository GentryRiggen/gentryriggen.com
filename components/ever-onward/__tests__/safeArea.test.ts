import fs from "fs";
import path from "path";

/**
 * The game runs edge to edge on iPhones and iPads. Anything that covers the
 * screen or pins itself to the top must pad by the safe area, or its
 * buttons sit under the clock and the battery (the 1.27 intro films did).
 */
const ROOT = path.join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(full);
    }
    return /\.tsx$/.test(entry.name) ? [full] : [];
  });
}

/** Every className-ish string on one line that pins something to the screen. */
function pinned(file: string): { line: number; text: string }[] {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((text, i) => ({ line: i + 1, text }))
    .filter(({ text }) => /\bfixed\b/.test(text))
    .filter(
      ({ text }) =>
        // A full-screen overlay (not a decorative, untouchable layer)…
        (/\binset-0\b/.test(text) && /\bz-50\b/.test(text)) ||
        // …or a bar pinned to the top edge.
        /\btop-0\b/.test(text)
    );
}

const isSafe = (text: string) =>
  text.includes("safe-area-inset-top") || text.includes("SAFE_INSETS");

describe("the iPhone safe area", () => {
  const found = sourceFiles(ROOT).flatMap((file) =>
    pinned(file).map((hit) => ({
      where: `${path.relative(ROOT, file)}:${hit.line}`,
      text: hit.text.trim(),
    }))
  );

  it("finds the overlays and top bars it guards", () => {
    expect(found.length).toBeGreaterThanOrEqual(7);
  });

  it.each(found.map((f) => [f.where, f.text]))(
    "%s pads by the safe area",
    (_where, text) => {
      expect(isSafe(text)).toBe(true);
    }
  );
});
