import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  GENERATED_GAME_WORKERS,
  renderGameServiceWorker,
  workerFileName,
} from "../generate";

describe("generated game service workers", () => {
  it.each(GENERATED_GAME_WORKERS)(
    "public/$slug-sw.js matches the template (run: npx tsx scripts/generate-game-sw.ts)",
    (config) => {
      const file = path.join(
        process.cwd(),
        "public",
        workerFileName(config.slug)
      );
      expect(existsSync(file)).toBe(true);
      // Prettier only re-flows whitespace, so compare with it ignored.
      const squash = (source: string) => source.replace(/\s+/g, "");
      expect(squash(readFileSync(file, "utf8"))).toBe(
        squash(renderGameServiceWorker(config))
      );
    }
  );

  it("leaves no template token unfilled", () => {
    for (const config of GENERATED_GAME_WORKERS) {
      expect(renderGameServiceWorker(config)).not.toMatch(/\{\{|\}\}/);
    }
  });

  it("keeps a game's constants and nothing else game-specific", () => {
    const flamelings = renderGameServiceWorker(GENERATED_GAME_WORKERS[0]);
    const other = renderGameServiceWorker({
      slug: "pip",
      title: "Pip",
      assetPrefixes: ["/pip/art/"],
      assetPaths: [],
    });
    expect(other).not.toContain("flamelings");
    expect(other).toContain('const CACHE_PREFIX = "pip-";');
    expect(other).toContain('const ASSET_PREFIXES = ["/pip/art/"];');
    // Same code once the constants are swapped.
    expect(
      flamelings
        .replaceAll("flamelings", "pip")
        .replaceAll("Flamelings", "Pip")
        .split("\n")
        .filter((line) => !/ASSET_(PREFIXES|PATHS) =/.test(line))
    ).toEqual(
      other.split("\n").filter((line) => !/ASSET_(PREFIXES|PATHS) =/.test(line))
    );
  });

  it("refuses assets outside the game's own paths", () => {
    expect(() =>
      renderGameServiceWorker({
        slug: "pip",
        title: "Pip",
        assetPrefixes: ["/other/"],
        assetPaths: [],
      })
    ).toThrow();
    expect(() =>
      renderGameServiceWorker({
        slug: "Pip Game",
        title: "Pip",
        assetPrefixes: [],
        assetPaths: [],
      })
    ).toThrow();
  });
});
