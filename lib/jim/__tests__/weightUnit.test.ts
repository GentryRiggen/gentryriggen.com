import {
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
