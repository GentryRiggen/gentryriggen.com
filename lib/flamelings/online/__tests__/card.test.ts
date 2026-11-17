import { createPet } from "../../actions";
import {
  CODE_ALPHABET,
  cardOf,
  generateCode,
  isCode,
  parseCard,
  parseFriend,
} from "../card";
import { ONLINE_NAMES, onlineNameIdFor } from "../names";

const look = { colour: "sky", shape: "drop", eyes: "wide" } as const;
const pet = (name = "Pip") => ({
  ...createPet({ id: "pet-1", name, look, now: 0 }),
});

describe("friend codes", () => {
  it("has 31 characters without 0 O 1 I L", () => {
    expect(CODE_ALPHABET).toHaveLength(31);
    for (const bad of "01OIL") expect(CODE_ALPHABET).not.toContain(bad);
  });

  it("generates 6 characters from the alphabet", () => {
    for (let i = 0; i < 200; i++) expect(isCode(generateCode())).toBe(true);
  });

  it("never picks from a biased byte", () => {
    const bytes = [255, 248, 250, 0, 1, 2, 3, 4, 5];
    let i = 0;
    const code = generateCode(() => bytes[i++]);
    expect(code).toBe("ABCDEF");
  });

  it("varies from one call to the next", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateCode()));
    expect(codes.size).toBe(50);
  });

  it.each(["abcdef", "ABCDE", "ABCDEFG", "ABCDE0", "ABCDEI", "", null, 5])(
    "rejects %s",
    (v) => {
      expect(isCode(v)).toBe(false);
    }
  );
});

describe("cardOf", () => {
  it("holds look, level, stage, form and an online name index, never the typed name", () => {
    const card = cardOf({
      ...pet("Hunter2"),
      level: 12,
      form: "wild",
      worn: { hat: "crown", face: null, neck: "scarf" },
    });
    expect(card).toEqual({
      look: { ...look, hat: "crown", face: "none", neck: "scarf" },
      level: 12,
      stage: "blaze",
      form: "wild",
      nameId: expect.any(Number),
    });
    expect(JSON.stringify(card)).not.toContain("Hunter2");
  });

  it("uses a typed name that is on the list, ignoring case", () => {
    const id = ONLINE_NAMES.indexOf("Toasty");
    expect(onlineNameIdFor(" toasty ", "x")).toBe(id);
    expect(cardOf(pet("TOASTY")).nameId).toBe(id);
  });

  it("picks a stable seeded name for any other name", () => {
    const a = cardOf(pet("Zxqvv")).nameId;
    expect(cardOf(pet("Something else")).nameId).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(ONLINE_NAMES.length);
  });

  it("uses the chosen online name when there is one", () => {
    const chosen = { ...pet(), online: { ...pet().online, nameId: 7 } };
    expect(cardOf(chosen).nameId).toBe(7);
  });
});

describe("parseCard and parseFriend", () => {
  const good = cardOf(pet());

  it("accepts a card the catalog knows", () => {
    expect(parseCard(good)).toEqual(good);
  });

  it.each([
    ["an unknown colour", { look: { ...good.look, colour: "pink" } }],
    ["an unknown hat", { look: { ...good.look, hat: "tinfoil" } }],
    ["a level of 0", { level: 0 }],
    ["a fractional level", { level: 2.5 }],
    ["an unknown stage", { stage: "huge" }],
    ["an unknown form", { form: "evil" }],
    ["an out-of-range name", { nameId: 9999 }],
  ])("rejects %s", (_l, patch) => {
    expect(parseCard({ ...good, ...patch })).toBeNull();
  });

  it("rejects non-objects", () => {
    expect(parseCard(null)).toBeNull();
    expect(parseCard("x")).toBeNull();
    expect(parseCard({ look: null })).toBeNull();
  });

  it("drops a friend with a bad code or card", () => {
    expect(parseFriend({ code: "ABCDEF", card: good })).toEqual({
      code: "ABCDEF",
      card: good,
    });
    expect(parseFriend({ code: "abcdef", card: good })).toBeNull();
    expect(
      parseFriend({ code: "ABCDEF", card: { ...good, level: 0 } })
    ).toBeNull();
    expect(parseFriend(null)).toBeNull();
  });
});
