import { formatStars } from "../format";

describe("formatStars", () => {
  it("groups below 10,000", () => {
    expect(formatStars(0)).toBe("0");
    expect(formatStars(25)).toBe("25");
    expect(formatStars(9500)).toBe("9,500");
    expect(formatStars(9999)).toBe("9,999");
  });
  it("uses k from 10,000, one decimal only when not zero", () => {
    expect(formatStars(10000)).toBe("10k");
    expect(formatStars(12000)).toBe("12k");
    expect(formatStars(12500)).toBe("12.5k");
    expect(formatStars(109000)).toBe("109k");
    expect(formatStars(999999)).toBe("999.9k");
  });
});
