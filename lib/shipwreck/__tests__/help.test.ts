import { bowDownText, helpFor, leanText, powerText, waterText } from "../help";
import { concordia } from "../ships/concordia";
import { lusitania } from "../ships/lusitania";
import { poseidon } from "../ships/poseidon";
import { titanic } from "../ships/titanic";

describe("stat chips", () => {
  it("words each value", () => {
    expect(waterText({ waterAboardT: 12_437 })).toBe("12,400 t of water");
    expect(bowDownText({ trimDeg: 4.24 })).toBe("4.2°");
    expect(bowDownText({ trimDeg: -1 })).toBe("0.0°");
    // After the break: the bow half's pitch, not the stern's trim.
    const pose = { x: 0, y: 0, z: 0, roll: 0, yaw: 0 };
    expect(
      bowDownText({
        trimDeg: 4.3,
        bodies: [
          { ...pose, part: "bow", pitch: (10.8 * Math.PI) / 180 },
          { ...pose, part: "stern", pitch: (4.3 * Math.PI) / 180 },
        ],
      })
    ).toBe("10.8°");
    expect(leanText({ listDeg: -1.1 })).toBe("1.1° to port");
    expect(leanText({ listDeg: 2 })).toBe("2.0° to starboard");
    expect(powerText({ power: 1 })).toBe("Lights on");
    expect(powerText({ power: 0.4 })).toBe("Lights flickering");
    expect(powerText({ power: 0 })).toBe("Lights out");
  });

  it("explains bow down with the break angle", () => {
    const h = helpFor("bow", null);
    expect(h.title).toBe("Bow down");
    expect(h.lines.join(" ")).toMatch(/about 15°/);
  });
});

describe("the Lusitania's help", () => {
  it("words her cards for a torpedo, a list and a shallow sea", () => {
    const controls = helpFor("controls", null, lusitania).lines.join(" ");
    expect(controls).toMatch(/how fast the afternoon goes/);
    expect(controls).toMatch(
      /the Bridge, the Dining Saloon, Boiler Room 1, the Coal Bunker and the Turbine Room/
    );
    expect(helpFor("water", null, lusitania).lines.join(" ")).toMatch(
      /Lusitania weighed about 36,000 t/
    );
    expect(helpFor("lean", null, lusitania).lines.join(" ")).toMatch(
      /coal bunkers/
    );
    expect(helpFor("bow", null, lusitania).lines.join(" ")).toMatch(/93 m/);
    // The Titanic's cards are 1.0's.
    expect(helpFor("controls", null)).toEqual(
      helpFor("controls", null, titanic)
    );
    expect(helpFor("controls", null).lines.join(" ")).toMatch(
      /the Bridge, the Grand Staircase, Boiler Room 6 and the Engine Room/
    );
  });
});

describe("the walk line", () => {
  it("tells parents about the walking button on both ships", () => {
    for (const ship of [titanic, lusitania])
      expect(helpFor("controls", null, ship).lines.join(" ")).toMatch(
        /walking button puts you on her deck/
      );
  });

  it("mentions doors in plain words, Titanic only", () => {
    expect(helpFor("controls", null, titanic).lines.join(" ")).toMatch(
      /door button/
    );
    expect(helpFor("controls", null, lusitania).lines.join(" ")).not.toMatch(
      /door button/
    );
  });

  it("says the door button takes you back out on deck", () => {
    expect(helpFor("controls", null, titanic).lines.join(" ")).toMatch(
      /inside, the door button takes you back out on deck/
    );
  });

  it("tells of her lean and the lifeboats on the Concordia only", () => {
    expect(helpFor("controls", null, concordia).lines.join(" ")).toMatch(
      /slide downhill.*lifeboat/
    );
    expect(helpFor("controls", null, concordia).lines.join(" ")).toMatch(
      /go inside some of her rooms.*glass lift/
    );
    expect(helpFor("controls", null, titanic).lines.join(" ")).not.toMatch(
      /slide downhill/
    );
  });

  it("is left out for a ship you cannot walk on", () => {
    const noWalk = { ...titanic, id: "nope" as typeof titanic.id };
    expect(helpFor("controls", null, noWalk).lines.join(" ")).not.toMatch(
      /walking button/
    );
  });
});

describe("the wave ship's lean card", () => {
  const lean = (v?: "real" | "smaller" | "ahead") =>
    helpFor("lean", null, poseidon, v).lines.join(" ");

  it("matches the wave the run has", () => {
    expect(lean()).toMatch(/rolled her all the way over/);
    expect(lean("real")).toMatch(/rolled her all the way over/);
    expect(lean("smaller")).toMatch(/smaller wave/);
    expect(lean("smaller")).not.toMatch(/rolled her all the way over/);
    expect(lean("ahead")).toMatch(/bow/);
    expect(lean("ahead")).not.toMatch(/port side/);
    expect(lean("ahead")).not.toMatch(/rolled her/);
  });
});
