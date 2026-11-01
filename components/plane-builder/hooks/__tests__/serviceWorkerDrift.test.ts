import { readFileSync } from "node:fs";
import path from "node:path";

function read(name: string): string {
  return readFileSync(path.join(process.cwd(), "public", name), "utf8");
}

/** Swaps the game's name for a placeholder so the two workers compare. */
function normalise(source: string, game: "plane" | "ship"): string {
  const title = game === "plane" ? "Plane Builder" : "Ship Builder";
  return source
    .replaceAll(`${game}-builder`, "GAME-builder")
    .replaceAll(title, "GAME Builder");
}

/** Top-level blocks keyed by their first code line (after any comment). */
function blocks(source: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const block of source.split(/\n\n(?=\S)/)) {
    if (block.startsWith("/*")) continue; // the file header comment
    const first = block
      .split("\n")
      .find((line) => !/^\s*(\/\*|\*|\/\/)/.test(line));
    if (first) result.set(first, block);
  }
  return result;
}

// Plane Builder's worker adds a lie-fi timeout and pruning of old build files
// to page navigations. Port those to ship-builder-sw.js, then empty this list.
// Ship Builder also caches its spoken lines (voice/) like its models.
const INTENTIONALLY_DIVERGED = [
  "const VOICE_PREFIX = `${PAGE_PATH}/voice/`;",
  "function isModelAsset(pathname) {",
  "async function handleNavigation(event, request, url) {",
  "async function handleNavigation(request, url) {",
  'self.addEventListener("fetch", (event) => {',
];

describe("plane and ship service workers", () => {
  const plane = blocks(normalise(read("plane-builder-sw.js"), "plane"));
  const ship = blocks(normalise(read("ship-builder-sw.js"), "ship"));

  it("compares real content", () => {
    expect(ship.size).toBeGreaterThanOrEqual(10);
    expect(plane.size).toBeGreaterThanOrEqual(10);
  });

  it("share every block that is not intentionally diverged", () => {
    for (const [first, block] of ship) {
      if (INTENTIONALLY_DIVERGED.includes(first)) continue;
      expect({ first, block: plane.get(first) }).toEqual({ first, block });
    }
  });

  it("only add plane blocks that are listed or new helpers", () => {
    const unexpected = [...plane.keys()].filter(
      (first) =>
        !ship.has(first) &&
        !INTENTIONALLY_DIVERGED.includes(first) &&
        !/^(async function |function |const )(pruneStaleStatic|staticRefs|sameSet|NAVIGATION_NETWORK_TIMEOUT_MS|STATIC_REF_PATTERN)\b/.test(
          first
        )
    );
    expect(unexpected).toEqual([]);
  });
});
