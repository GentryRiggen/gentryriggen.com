import { SAVE_KEY, SAVE_VERSION, loadSave } from "../save";

describe("a save from a newer version", () => {
  beforeEach(() => window.localStorage.clear());

  it("is backed up and left in place, not replaced", () => {
    const raw = JSON.stringify({
      version: SAVE_VERSION + 1,
      universes: {},
      seenIntro: true,
    });
    window.localStorage.setItem(SAVE_KEY, raw);
    const result = loadSave();
    expect(result.isFromNewerVersion).toBe(true);
    expect(result.recovered).toBe(false);
    expect(window.localStorage.getItem(SAVE_KEY)).toBe(raw);
    const backups = Object.keys(window.localStorage).filter((k) =>
      k.startsWith(`${SAVE_KEY}:backup:`)
    );
    expect(backups).toHaveLength(1);
    expect(window.localStorage.getItem(backups[0])).toBe(raw);
  });
});
