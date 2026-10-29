import { parseStudioParams } from "../studioParams";

describe("parseStudioParams", () => {
  it("parses a full query", () => {
    expect(
      parseStudioParams("?part=funnel&variant=funnel-large&build=new&view=side")
    ).toEqual({
      part: "funnel",
      kit: false,
      type: "funnel-large",
      variant: "funnel-large",
      build: "new",
      view: "side",
      time: "Day",
    });
  });

  it("reads the time of day", () => {
    expect(
      parseStudioParams(
        "?part=funnel&variant=funnel&build=old&view=front&time=Night"
      )
    ).toMatchObject({ time: "Night" });
  });

  it("takes a part id as the variant of its spec", () => {
    expect(
      parseStudioParams("?part=funnel-large&build=new&view=side")
    ).toMatchObject({ type: "funnel-large", variant: "funnel-large" });
    expect(parseStudioParams("?part=funnel&build=old&view=side")).toMatchObject(
      { type: "funnel", variant: "funnel" }
    );
  });

  it("accepts any game part, in the default view", () => {
    expect(parseStudioParams("?part=rudder&build=old")).toEqual({
      part: "rudder",
      kit: false,
      type: "rudder",
      variant: "rudder",
      build: "old",
      view: "three-quarter",
      time: "Day",
    });
    expect(parseStudioParams("?part=rudder&build=old&view=top")).toHaveProperty(
      "error"
    );
  });

  it("rejects an unknown part", () => {
    expect(
      parseStudioParams("?part=nope&variant=funnel&build=old&view=side")
    ).toEqual({ error: expect.stringContaining("nope") });
  });

  it("rejects an unknown variant, view, build and time", () => {
    const query = (patch: Record<string, string>) =>
      "?" +
      new URLSearchParams({
        part: "funnel",
        variant: "funnel",
        build: "old",
        view: "side",
        ...patch,
      });
    expect(parseStudioParams(query({ variant: "x" }))).toHaveProperty("error");
    expect(parseStudioParams(query({ view: "top" }))).toEqual({
      error: expect.stringContaining("top"),
    });
    expect(parseStudioParams(query({ build: "mid" }))).toHaveProperty("error");
    expect(parseStudioParams(query({ time: "Noon" }))).toHaveProperty("error");
  });
});
