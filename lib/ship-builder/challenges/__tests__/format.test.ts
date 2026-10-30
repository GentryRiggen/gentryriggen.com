import { beatItHint, describeGoal, describeValue } from "../format";

describe("format", () => {
  it("describes values in plain words", () => {
    expect(describeValue("outlast", 100)).toBe(
      "Stayed afloat 1 hour 40 minutes"
    );
    expect(describeValue("outlast", 1440)).toBe("She never sank");
    expect(describeValue("evacuation", 50)).toBe("50% of people saved");
    expect(describeValue("shipshape", 2)).toBe("Rode out a choppy sea");
  });

  it("names the next goal, or none at three stars", () => {
    expect(describeGoal("outlast", 61)).toBe("Stay afloat 2 hours 40 minutes");
    expect(describeGoal("outlast", 200)).toBe("Never sink");
    expect(describeGoal("evacuation", 80)).toBe("Get everyone off safely");
    expect(describeGoal("shipshape", 3)).toBeNull();
  });

  it("gives a beat-it hint with a tip, or a cheer at three stars", () => {
    expect(beatItHint("outlast", 100)).toContain("bulkheads");
    expect(beatItHint("shipshape", 3)).toMatch(/Three stars/);
  });
});
