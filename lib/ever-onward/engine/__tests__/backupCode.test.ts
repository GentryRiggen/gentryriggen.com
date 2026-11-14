import { decodeBackup, encodeBackup } from "../backupCode";
import { newUniverseSave } from "../prestige";
import { SAVE_VERSION, newSave } from "../save";
import { fixture as def } from "./fixtures";

const sample = () => ({
  ...newSave(),
  seenIntro: true,
  universes: { fixture: { ...newUniverseSave(def), embers: 3 } },
});

describe("backup code", () => {
  it("round-trips a save", () => {
    const save = sample();
    const code = encodeBackup(save);
    expect(code.startsWith("EO1-")).toBe(true);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeBackup(code)).toEqual(save);
  });

  it("ignores spaces and line breaks from pasting", () => {
    const code = encodeBackup(sample());
    const messy = `  ${code.slice(0, 20)}\n${code.slice(20, 40)} \r\n${code.slice(40)}\n`;
    expect(decodeBackup(messy)).toEqual(sample());
  });

  it("rejects a code that was changed", () => {
    const code = encodeBackup(sample());
    const at = 10;
    const swapped = code[at] === "A" ? "B" : "A";
    expect(decodeBackup(code.slice(0, at) + swapped + code.slice(at + 1))).toBe(
      null
    );
    expect(decodeBackup(code.slice(0, -1))).toBeNull();
  });

  it("rejects garbage, the wrong prefix and empty text", () => {
    expect(decodeBackup("")).toBeNull();
    expect(decodeBackup("hello there")).toBeNull();
    expect(decodeBackup("EO1-")).toBeNull();
    expect(decodeBackup("EO1-!!!-00000000")).toBeNull();
    expect(decodeBackup(encodeBackup(sample()).replace("EO1-", "EO2-"))).toBe(
      null
    );
  });

  it("rejects a well-formed code whose save is unreadable", () => {
    const bad = { ...sample(), version: SAVE_VERSION + 1 };
    expect(decodeBackup(encodeBackup(bad))).toBeNull();
    const broken = sample();
    broken.universes.fixture.embers = -1;
    expect(decodeBackup(encodeBackup(broken))).toBeNull();
  });

  it("loads a code from the current version without extra fields", () => {
    const withExtra = { ...sample(), future: "ignored" };
    expect(decodeBackup(encodeBackup(withExtra))).toEqual(sample());
  });
});
