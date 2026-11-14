import { existsSync } from "node:fs";
import { join } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SIMS: string[] = require("../../jest.sims.js");

describe("jest.sims.js", () => {
  it("lists only test files that exist", () => {
    for (const path of SIMS) {
      expect(existsSync(join(__dirname, "../..", path))).toBe(true);
      expect(path).toMatch(/\.test\.tsx?$/);
    }
  });

  it("lists each file once", () => {
    expect(new Set(SIMS).size).toBe(SIMS.length);
  });
});
