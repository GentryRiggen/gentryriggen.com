import { createRateLimiter } from "../rateLimiter";

describe("rate limiter", () => {
  it("lets a cue through once per gap, per key", () => {
    const limiter = createRateLimiter(1000);
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("a", 500)).toBe(false);
    expect(limiter.allow("b", 500)).toBe(true);
    expect(limiter.allow("a", 1000)).toBe(true);
  });

  it("forgets on reset", () => {
    const limiter = createRateLimiter(1000);
    limiter.allow("a", 0);
    limiter.reset();
    expect(limiter.allow("a", 1)).toBe(true);
  });
});
