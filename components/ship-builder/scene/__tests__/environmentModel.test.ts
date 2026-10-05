import { environmentFor, mixHex, reflectionFor } from "../environmentModel";
import { PALETTE } from "../palette";
import { SEA_STATES } from "../seaState";
import { TIMES_OF_DAY } from "../timeOfDay";

function channels(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(hex: string): number {
  const [r, g, b] = channels(hex);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

describe("environmentFor", () => {
  it("keeps the original look for a calm day", () => {
    const env = environmentFor("day", "calm");
    expect(env.colors.skyHorizon).toBe(PALETTE.sky);
    expect(env.colors.underwater).toBe(PALETTE.underwater);
    expect(env.numbers).toMatchObject({
      ambientIntensity: 0.1,
      hemiIntensity: 0.75,
      lightIntensity: 1.4,
      fogNear: 80,
      fogFar: 260,
    });
    expect(env.vectors.lightPosition).toEqual([30, 40, 20]);
  });

  it("puts the sun low at sunset for long shadows", () => {
    const day = environmentFor("day", "calm");
    const sunset = environmentFor("sunset", "calm");
    expect(sunset.vectors.lightPosition[1]).toBeLessThan(
      day.vectors.lightPosition[1] / 2
    );
    expect(sunset.vectors.lightPosition[1]).toBeGreaterThan(0);
    expect(sunset.numbers.lightIntensity).toBeLessThan(
      day.numbers.lightIntensity
    );
  });

  it("is warmer at sunset: more red than blue in the light", () => {
    const [r, , b] = channels(environmentFor("sunset", "calm").colors.light);
    expect(r).toBeGreaterThan(b);
  });

  it("shows stars and the moon only at night", () => {
    const night = environmentFor("night", "calm");
    expect(night.numbers.starAmount).toBeGreaterThan(0.7);
    expect(night.numbers.moonAmount).toBe(1);
    expect(environmentFor("day", "calm").numbers.starAmount).toBe(0);
    expect(environmentFor("day", "calm").numbers.moonAmount).toBe(0);
  });

  it("keeps the ship readable at night but the sky darker than at sunset", () => {
    const night = environmentFor("night", "calm");
    const sunset = environmentFor("sunset", "calm");
    expect(night.numbers.ambientIntensity).toBeGreaterThan(0.2);
    expect(night.numbers.lightIntensity).toBeGreaterThan(0.5);
    expect(luminance(night.colors.skyHorizon)).toBeLessThan(
      luminance(sunset.colors.skyHorizon)
    );
    expect(luminance(night.colors.underwater)).toBeLessThan(
      luminance(environmentFor("day", "calm").colors.underwater)
    );
  });

  it.each(TIMES_OF_DAY)(
    "gets cloudier, dimmer and foggier from calm to stormy at %s",
    (time) => {
      const [calm, choppy, stormy] = SEA_STATES.map((sea) =>
        environmentFor(time, sea)
      );
      expect(calm.numbers.cloudCover).toBeLessThan(choppy.numbers.cloudCover);
      expect(choppy.numbers.cloudCover).toBeLessThan(stormy.numbers.cloudCover);
      expect(stormy.numbers.cloudCover).toBe(1);
      expect(stormy.numbers.fogFar).toBeLessThan(choppy.numbers.fogFar);
      expect(choppy.numbers.fogFar).toBeLessThan(calm.numbers.fogFar);
      expect(stormy.numbers.lightIntensity).toBeLessThan(
        calm.numbers.lightIntensity
      );
    }
  );

  it("greys the day sky when stormy", () => {
    expect(
      saturation(environmentFor("day", "stormy").colors.skyHorizon)
    ).toBeLessThan(saturation(environmentFor("day", "calm").colors.skyHorizon));
  });

  it("hides the stars behind a stormy night's clouds", () => {
    const { starAmount } = environmentFor("night", "stormy").numbers;
    expect(starAmount).toBeGreaterThanOrEqual(0);
    expect(starAmount).toBeLessThan(0.15);
  });

  it("never leaves the key light below the horizon", () => {
    for (const time of TIMES_OF_DAY) {
      expect(
        environmentFor(time, "calm").vectors.lightPosition[1]
      ).toBeGreaterThan(0);
    }
  });
});

describe("day fill", () => {
  it("replaces the white ambient with a blue sky over a sea-blue ground", () => {
    const { colors, numbers } = environmentFor("day", "calm");
    const [, , skyBlue] = channels(colors.hemiSky);
    const [groundRed, , groundBlue] = channels(colors.hemiGround);
    expect(skyBlue).toBeGreaterThan(240);
    expect(groundBlue).toBeGreaterThan(groundRed);
    expect(luminance(colors.hemiSky)).toBeGreaterThan(
      luminance(colors.hemiGround)
    );
    expect(numbers.hemiIntensity).toBeGreaterThan(numbers.ambientIntensity);
  });

  it("keeps the total fill close to the old flat white ambient", () => {
    const { numbers } = environmentFor("day", "calm");
    const total = numbers.ambientIntensity + numbers.hemiIntensity;
    expect(total).toBeGreaterThan(0.55 * 0.9);
    expect(total).toBeLessThan(0.55 * 1.7);
  });

  it("greys the fill when stormy", () => {
    const calm = environmentFor("day", "calm").colors.hemiSky;
    const stormy = environmentFor("day", "stormy").colors.hemiSky;
    expect(saturation(stormy)).toBeLessThan(saturation(calm));
  });

  it("leaves sunset and night moods alone in a storm", () => {
    for (const time of ["sunset", "night"] as const) {
      expect(environmentFor(time, "stormy").colors.hemiSky).toBe(
        environmentFor(time, "calm").colors.hemiSky
      );
    }
  });
});

describe("occlusion tint", () => {
  it("is darkest at night and always darker than the sky", () => {
    const [day, sunset, night] = TIMES_OF_DAY.map((time) =>
      environmentFor(time, "calm")
    );
    expect(luminance(night.colors.aoColor)).toBeLessThan(
      luminance(sunset.colors.aoColor)
    );
    expect(luminance(day.colors.aoColor)).toBeLessThan(
      luminance(day.colors.skyHorizon)
    );
  });
});

describe("reflectionFor", () => {
  it("keeps the reflections gentle so colours do not wash out", () => {
    for (const time of TIMES_OF_DAY) {
      expect(reflectionFor(time).intensity).toBeLessThanOrEqual(0.4);
      expect(reflectionFor(time).intensity).toBeGreaterThan(0);
    }
  });

  it("is dimmer at night than by day", () => {
    expect(luminance(reflectionFor("night").side)).toBeLessThan(
      luminance(reflectionFor("day").side)
    );
  });
});

describe("mixHex", () => {
  it("returns the ends and a hex colour in between", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixHex("#ff0000", "#0000ff", 0.5)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
