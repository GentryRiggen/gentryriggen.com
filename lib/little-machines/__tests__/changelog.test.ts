import { CHANGELOG } from "../changelog";
import { LITTLE_MACHINES_VERSION } from "../version";

describe("changelog", () => {
  it("has an entry for the current version at the top", () => {
    // Bumped the version? Add its release notes to lib/little-machines/changelog.ts.
    expect(CHANGELOG[0].version).toBe(LITTLE_MACHINES_VERSION);
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
});
