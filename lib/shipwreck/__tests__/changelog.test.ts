import { CHANGELOG } from "../changelog";
import { SHIPWRECK_VERSION } from "../version";

const parse = (version: string) => version.split(".").map(Number);

function isNewer(a: string, b: string): boolean {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] > y[i];
  }
  return false;
}

describe("changelog", () => {
  it("has an entry for the current version at the top", () => {
    // Bumped the version? Add its release notes to lib/shipwreck/changelog.ts.
    expect(CHANGELOG[0].version).toBe(SHIPWRECK_VERSION);
  });

  it("gives every release a version, date, title and highlights", () => {
    for (const release of CHANGELOG) {
      expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(release.date))).toBe(false);
      expect(release.title.trim()).not.toBe("");
      expect(release.highlights.length).toBeGreaterThan(0);
    }
  });

  it("lists releases newest first", () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      const [newer, older] = [CHANGELOG[i - 1], CHANGELOG[i]];
      expect(isNewer(newer.version, older.version)).toBe(true);
      expect(newer.date >= older.date).toBe(true);
    }
  });
});
