import {
  heatFromTemperature,
  parseCurrentWeather,
  roundCoordinate,
  skyPhase,
  weatherKindFromCode,
} from "../sky";

const at = (month: number, hour: number, minute = 0) =>
  new Date(2026, month - 1, 15, hour, minute);

describe("skyPhase", () => {
  it.each([
    [3, 3, "night"],
    [3, 5, "dawn"],
    [3, 6, "dawn"],
    [3, 7, "day"],
    [3, 12, "day"],
    [3, 17, "day"],
    [3, 18, "dusk"],
    [3, 19, "dusk"],
    [3, 20, "night"],
    [3, 23, "night"],
    [3, 0, "night"],
  ])("month %i at %i:00 is %s", (month, hour, phase) => {
    expect(skyPhase(at(month, hour))).toBe(phase);
  });

  it("gets light earlier and stays light later in summer", () => {
    expect(skyPhase(at(7, 4, 45))).toBe("dawn");
    expect(skyPhase(at(7, 19, 45))).toBe("dusk");
    expect(skyPhase(at(7, 22))).toBe("night");
  });

  it("gets dark earlier in winter", () => {
    expect(skyPhase(at(12, 5, 30))).toBe("night");
    expect(skyPhase(at(12, 17))).toBe("dusk");
    expect(skyPhase(at(12, 18, 45))).toBe("night");
  });
});

describe("weatherKindFromCode", () => {
  it.each([
    [0, "clear"],
    [1, "clear"],
    [2, "clear"],
    [3, "cloudy"],
    [45, "fog"],
    [48, "fog"],
    [51, "rain"],
    [57, "rain"],
    [61, "rain"],
    [67, "rain"],
    [71, "snow"],
    [77, "snow"],
    [80, "rain"],
    [82, "rain"],
    [85, "snow"],
    [86, "snow"],
    [95, "thunder"],
    [99, "thunder"],
    [1234, "clear"],
  ])("code %i is %s", (code, kind) => {
    expect(weatherKindFromCode(code)).toBe(kind);
  });

  it("calls a mostly covered sky cloudy", () => {
    expect(weatherKindFromCode(1, 90)).toBe("cloudy");
    expect(weatherKindFromCode(2, 65)).toBe("cloudy");
  });
});

describe("heatFromTemperature", () => {
  it.each([
    [30, "hot"],
    [38, "hot"],
    [29.9, "mild"],
    [10, "mild"],
    [0.1, "mild"],
    [0, "cold"],
    [-12, "cold"],
  ])("%d C is %s", (celsius, heat) => {
    expect(heatFromTemperature(celsius)).toBe(heat);
  });
});

describe("parseCurrentWeather", () => {
  it("reads kind and heat", () => {
    expect(
      parseCurrentWeather({
        current: { weather_code: 63, temperature_2m: 31 },
      })
    ).toEqual({ kind: "rain", heat: "hot" });
  });

  it("turns rain with snowfall into snow", () => {
    expect(
      parseCurrentWeather({
        current: { weather_code: 61, temperature_2m: -1, snowfall: 0.4 },
      })
    ).toEqual({ kind: "snow", heat: "cold" });
  });

  it.each([null, "x", {}, { current: {} }, { current: { weather_code: "1" } }])(
    "rejects %j",
    (body) => {
      expect(parseCurrentWeather(body)).toBeNull();
    }
  );
});

describe("roundCoordinate", () => {
  it("keeps one decimal", () => {
    expect(roundCoordinate(40.76078)).toBe(40.8);
    expect(roundCoordinate(-111.89105)).toBe(-111.9);
  });
});
