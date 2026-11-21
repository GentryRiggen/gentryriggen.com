import fs from "fs";
import path from "path";

/**
 * Every game runs edge to edge (viewport-fit cover) on iPhones and iPads, so
 * anything pinned to the top or bottom edge, or covering the screen, must pad
 * by the safe area or its buttons sit under the clock, the battery or the
 * home bar. This scans each game's components for such elements.
 *
 * Opt a game in by adding its component folder to GAME_DIRS. Not yet opted
 * in (their pinned UI has not been audited): components/ship-builder,
 * components/plane-builder, components/planet-smasher.
 *
 * A line is flagged when it pins a `fixed` element (or an `absolute` bar with
 * `inset-x-0`) to `inset-0` or `top-0` (needs a top inset) or `bottom-0` (needs
 * a bottom inset) and is not `pointer-events-none`. Fix it with SAFE_INSETS / SAFE_TOP / SAFE_BOTTOM
 * from lib/game-kit/safeArea (or your own `env(safe-area-inset-*)`). A layer
 * that holds nothing touchable (a backdrop, a scene) puts `safe-area-ok:
 * <why>` in a comment on its line or the line above.
 */
export const GAME_DIRS = [
  "components/ever-onward",
  "components/flamelings",
  "components/shipwreck",
];

const ROOT = path.join(__dirname, "../../..");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(full);
    }
    return /\.tsx$/.test(entry.name) ? [full] : [];
  });
}

const TOP = /safe-area-inset-top|SAFE_INSETS|SAFE_TOP/;
const BOTTOM = /safe-area-inset-bottom|SAFE_INSETS|SAFE_BOTTOM/;

interface Hit {
  where: string;
  text: string;
  problem: string | null;
}

export function scan(file: string): Hit[] {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const hits: Hit[] = [];
  lines.forEach((text, i) => {
    // Cannot be touched, so nothing on it can hide under a notch.
    if (/\bpointer-events-none\b/.test(text)) return;
    const isFixed = /\bfixed\b/.test(text);
    // A bar pinned to an edge of its frame (the game's own full-screen root).
    const isBar =
      /\babsolute\b/.test(text) &&
      /\binset-x-0\b/.test(text) &&
      /\b(top-0|bottom-0)\b/.test(text);
    if (!isFixed && !isBar) return;
    const needsTop = /\b(inset-0|top-0)\b/.test(text);
    const needsBottom = /\bbottom-0\b/.test(text);
    if (!needsTop && !needsBottom) return;
    const marked = `${lines[i - 1] ?? ""}\n${text}`.includes("safe-area-ok");
    const missing = [
      needsTop && !TOP.test(text) ? "top" : "",
      needsBottom && !BOTTOM.test(text) ? "bottom" : "",
    ].filter(Boolean);
    hits.push({
      where: `${path.relative(ROOT, file)}:${i + 1}`,
      text: text.trim(),
      problem:
        marked || missing.length === 0
          ? null
          : `${missing.join(" ")} inset missing`,
    });
  });
  return hits;
}

describe("the iPhone and iPad safe area", () => {
  it.each(GAME_DIRS)("%s exists", (dir) => {
    expect(fs.existsSync(path.join(ROOT, dir))).toBe(true);
  });

  const hits = GAME_DIRS.flatMap((dir) =>
    sourceFiles(path.join(ROOT, dir)).flatMap(scan)
  );

  it("finds the overlays and bars it guards", () => {
    expect(hits.length).toBeGreaterThanOrEqual(8);
  });

  it.each(hits.map((h) => [h.where, h.text, h.problem]))(
    "%s pads by the safe area: %s",
    (_where, _text, problem) => {
      expect(problem).toBeNull();
    }
  );

  it("would flag an unpadded overlay", () => {
    const file = path.join(ROOT, "lib/game-kit/__tests__/.safeAreaProbe.tsx");
    fs.writeFileSync(
      file,
      `<div className="fixed inset-0 z-50 bg-black" />\n<div className="absolute inset-x-0 bottom-0 pb-4" />\n<div className="fixed inset-0 SAFE_INSETS" />\n`
    );
    try {
      const probe = scan(file);
      expect(probe.map((h) => h.problem)).toEqual([
        "top inset missing",
        "bottom inset missing",
        null,
      ]);
    } finally {
      fs.unlinkSync(file);
    }
  });
});
