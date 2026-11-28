import { deckZAt } from "../places";
import { britannic } from "../ships/britannic";
import { carpathia } from "../ships/carpathia";
import { concordia } from "../ships/concordia";
import { fitzgerald } from "../ships/fitzgerald";
import { lusitania } from "../ships/lusitania";
import { poseidon } from "../ships/poseidon";
import { titanic } from "../ships/titanic";
import type { ShipSpec } from "../ships/types";

/** The formula before `sheerRefDeck`: sheer measured from C, else Upper. */
function oldDeckZAt(
  deck: string,
  x: number,
  spec: Pick<ShipSpec, "decks" | "sheerZ">
): number {
  const z = (name: string) => spec.decks.find((d) => d.name === name)?.z ?? 0;
  const top = spec.decks.some((d) => d.name === "C") ? z("C") : z("Upper");
  return z(deck) + (spec.sheerZ(x) - top);
}

const XS = [-100, -40, 0, 40, 100];

describe("deckZAt", () => {
  it.each([
    ["titanic", titanic],
    ["britannic", britannic],
    ["lusitania", lusitania],
    ["carpathia", carpathia],
    ["fitzgerald", fitzgerald],
    ["poseidon", poseidon],
  ] as const)("%s keeps the old formula", (_id, spec) => {
    for (const d of spec.decks)
      for (const x of XS)
        expect(deckZAt(d.name, x, spec)).toBe(oldDeckZAt(d.name, x, spec));
  });

  it("concordia's decks are flat (sheer over deck 3)", () => {
    for (const d of concordia.decks)
      for (const x of XS)
        expect(deckZAt(d.name, x, concordia)).toBeCloseTo(d.z, 9);
    expect(deckZAt("4", 0, concordia)).toBeCloseTo(22.58, 2);
  });
});
