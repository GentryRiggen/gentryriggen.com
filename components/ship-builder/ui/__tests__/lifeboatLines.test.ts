import { lifeboatLines } from "../seaTrialText";

describe("lifeboatLines", () => {
  it("says she had no lifeboats when there are no seats, in any mode", () => {
    for (const mode of ["fill", "titanic"] as const) {
      expect(lifeboatLines({ seats: 0, people: 12 }, mode)).toEqual([
        "Lifeboat seats: 0. People aboard: 12.",
        "She had no lifeboats.",
      ]);
    }
  });

  it("says some boats left half-empty in Titanic mode", () => {
    expect(lifeboatLines({ seats: 40, people: 12 }, "titanic")[1]).toBe(
      "Some boats left half-empty, like the Titanic."
    );
  });

  it("says everyone fit when the seats were enough", () => {
    expect(lifeboatLines({ seats: 40, people: 12 }, "fill")[1]).toBe(
      "Everyone fit in the lifeboats!"
    );
  });

  it("counts who was left when the seats ran short", () => {
    expect(lifeboatLines({ seats: 10, people: 11 }, "fill")[1]).toBe(
      "Not enough lifeboats: 1 person was left on board."
    );
  });
});
