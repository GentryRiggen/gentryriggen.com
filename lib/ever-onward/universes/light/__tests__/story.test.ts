import { def } from "./fixtures";

describe("Keep the Light On story", () => {
  it("has a healthy amount of text", () => {
    expect(def.story.length).toBeGreaterThanOrEqual(30);
    expect(def.story.length).toBeLessThanOrEqual(75);
  });

  it("has non-empty messages with unique ids", () => {
    const ids = def.story.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const message of def.story) {
      expect(message.text.trim().length).toBeGreaterThan(0);
      expect(message.text.length).toBeLessThanOrEqual(300);
    }
  });

  it("never mentions another game", () => {
    const everything = [
      ...def.story.map((m) => m.text),
      ...def.phases.map((p) => p.intro ?? ""),
      ...def.upgrades.map((u) => `${u.name} ${u.description}`),
    ].join(" ");
    expect(everything.toLowerCase()).not.toContain("paperclip");
  });

  it("gives every phase an intro and every message a real phase", () => {
    const phaseIds = def.phases.map((p) => p.id);
    for (const phase of def.phases)
      expect(phase.intro?.length).toBeGreaterThan(0);
    for (const message of def.story) {
      if (message.phase) expect(phaseIds).toContain(message.phase);
    }
  });
});
