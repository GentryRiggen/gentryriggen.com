import { createPet } from "@/lib/flamelings/actions";
import { helpFor } from "@/lib/flamelings/help";
import type { Pet } from "@/lib/flamelings/types";

const NOON = new Date(2026, 10, 17, 12).getTime();
const look = { colour: "ember", shape: "flame", eyes: "round" } as const;

function petWith(patch: Partial<Pet>): Pet {
  return { ...createPet({ id: "a", name: "Pip", look, now: NOON }), ...patch };
}

describe("helpFor", () => {
  it("says when a need is low", () => {
    expect(helpFor("fuel", petWith({ fuel: 10 }), 3).now).toMatch(/hungry/);
    expect(helpFor("joy", petWith({ joy: 10 }), 3).now).toMatch(/bored/);
    expect(helpFor("fuel", petWith({ fuel: 90 }), 3).value).toBe(90);
  });

  it("counts the ash puffs on the tidy card", () => {
    const help = helpFor("tidy", petWith({ ash: 2 }), 3);
    expect(help.value).toBe(50);
    expect(help.now).toMatch(/2 ash puffs/);
    expect(helpFor("tidy", petWith({ ash: 0 }), 3).now).toMatch(/All clean/);
  });

  it("names the next stage and the grow-up level", () => {
    const help = helpFor("level", petWith({ level: 2, xp: 0 }), 3);
    expect(help.title).toBe("Level 2");
    expect(help.now).toMatch(/Spark/);
    const text = help.lines.map((l) => l.text).join(" ");
    expect(text).toMatch(/level 3 it grows into a Flicker/);
    expect(text).toMatch(/level 10/);
  });

  it("says whether games still pay sparks", () => {
    const join = (rounds: number) =>
      helpFor("sparks", petWith({ sparks: 57 }), rounds)
        .lines.map((l) => l.text)
        .join(" ");
    expect(join(2)).toMatch(/2 more games/);
    expect(join(0)).toMatch(/used up/);
  });
});
