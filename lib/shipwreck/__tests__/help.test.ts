import { bowDownText, helpFor, leanText, powerText, waterText } from "../help";
import { lusitania } from "../ships/lusitania";
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
