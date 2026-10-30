import {
  ADJECTIVES,
  ANIMALS,
  cryptoRandom,
  isValidNickname,
  randomNickname,
} from "../nickname";

describe("word lists", () => {
  it.each([
    ["ADJECTIVES", ADJECTIVES],
    ["ANIMALS", ANIMALS],
  ])("%s has 40 unique capitalized single words", (_name, list) => {
    expect(list).toHaveLength(40);
    expect(new Set(list).size).toBe(40);
    for (const word of list) expect(word).toMatch(/^[A-Z][a-z]+$/);
  });
});

describe("randomNickname", () => {
  it("builds <Adjective> <Animal> <n> from the lists", () => {
    expect(randomNickname(() => 0)).toBe(`${ADJECTIVES[0]} ${ANIMALS[0]} 1`);
    expect(randomNickname(() => 0.999999)).toBe(
      `${ADJECTIVES[39]} ${ANIMALS[39]} 99`
    );
  });

  it("always produces a valid nickname", () => {
    for (let i = 0; i < 200; i++) {
      expect(isValidNickname(randomNickname())).toBe(true);
    }
  });

  it("never generates 69 or 88, but still accepts them", () => {
    const numbers = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      numbers.add(Number(randomNickname(() => i / 1000).split(" ")[2]));
    }
    expect(numbers.has(69)).toBe(false);
    expect(numbers.has(88)).toBe(false);
    expect(numbers.size).toBe(97);
    expect(isValidNickname("Happy Otter 69")).toBe(true);
    expect(isValidNickname("Happy Otter 88")).toBe(true);
  });

  it("clamps a misbehaving rng of exactly 1", () => {
    expect(isValidNickname(randomNickname(() => 1))).toBe(true);
  });

  it("cryptoRandom stays in [0, 1)", () => {
    for (let i = 0; i < 50; i++) {
      const n = cryptoRandom();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe("isValidNickname", () => {
  it.each(["Happy Otter 1", "Witty Swan 99", "Brave Fox 42"])(
    "accepts %s",
    (s) => expect(isValidNickname(s)).toBe(true)
  );

  it.each([
    "",
    "Happy Otter",
    "Happy Otter 0",
    "Happy Otter 100",
    "Happy Otter 05",
    "Happy Otter x",
    "happy otter 5",
    "Happy  Otter 5",
    "Happy Otter 5 ",
    "Rude Otter 5",
    "Happy Dragon 5",
    "Happy Otter 5 extra",
  ])("rejects %j", (s) => expect(isValidNickname(s)).toBe(false));

  it("rejects non-strings", () => {
    expect(isValidNickname(null)).toBe(false);
    expect(isValidNickname(42)).toBe(false);
  });
});
