import { parseScoreArgs } from "../scored";

describe("parseScoreArgs", () => {
  it("defaults to light", () =>
    expect(parseScoreArgs([])).toEqual({ universeId: "light", isJson: false }));
  it("reads an id and --json in any order", () =>
    expect(parseScoreArgs(["--json", "light"])).toEqual({
      universeId: "light",
      isJson: true,
    }));
  it("names the known ids for an unknown one", () =>
    expect(() => parseScoreArgs(["nope"])).toThrow(/Known: light/));
});
