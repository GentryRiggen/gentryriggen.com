import {
  convertWeightsInText,
  fmtWeight,
  fmtWeightValue,
  lbToKg,
  loadWeightUnit,
  saveWeightUnit,
} from "../weightUnit";

describe("lbToKg", () => {
  it("rounds to the nearest half kilogram", () => {
    expect(lbToKg(225)).toBe(102); // 102.06
    expect(lbToKg(255)).toBe(115.5); // 115.67
    expect(lbToKg(135)).toBe(61); // 61.23
    expect(lbToKg(45)).toBe(20.5); // 20.41
    expect(lbToKg(0)).toBe(0);
  });
});

describe("formatting", () => {
  it("keeps pounds as before", () => {
    expect(fmtWeight(225, "lb")).toBe("225 lb");
    expect(fmtWeight(52.5, "lb")).toBe("52.5 lb");
    expect(fmtWeightValue(1005, "lb")).toBe("1,005");
  });

  it("shows kilograms with a half only when there is one", () => {
    expect(fmtWeight(225, "kg")).toBe("102 kg");
    expect(fmtWeight(255, "kg")).toBe("115.5 kg");
    expect(fmtWeightValue(2500, "kg")).toBe("1,134");
  });
});

describe("the saved unit", () => {
  beforeEach(() => window.localStorage.clear());

  it("defaults to lb and remembers kg", () => {
    expect(loadWeightUnit()).toBe("lb");
    saveWeightUnit("kg");
    expect(loadWeightUnit()).toBe("kg");
    saveWeightUnit("lb");
    expect(loadWeightUnit()).toBe("lb");
  });

  it("ignores junk and survives storage that throws", () => {
    window.localStorage.setItem("jim:weight-unit", "stone");
    expect(loadWeightUnit()).toBe("lb");
    const get = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const set = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(loadWeightUnit()).toBe("lb");
    expect(() => saveWeightUnit("kg")).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});

describe("convertWeightsInText", () => {
  it("converts weights written with a unit, and only those", () => {
    expect(convertWeightsInText("3 @ 255 lb, 95# thrusters, 2 lbs", "kg")).toBe(
      "3 @ 115.5 kg, 43 kg thrusters, 1 kg"
    );
    expect(convertWeightsInText("21-15-9, 222 reps, 30 cal", "kg")).toBe(
      "21-15-9, 222 reps, 30 cal"
    );
    expect(convertWeightsInText("255 lbsomething", "kg")).toBe(
      "255 lbsomething"
    );
  });

  it("leaves text alone in lb", () => {
    expect(convertWeightsInText("3 @ 255 lb", "lb")).toBe("3 @ 255 lb");
  });
});
