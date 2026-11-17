import { playSound, setSoundSink, soundsForEvents } from "../sound";

describe("soundsForEvents", () => {
  it("maps care and milestones to sounds, once each", () => {
    expect(soundsForEvents([{ type: "care", action: "feed" }])).toEqual([
      "chomp",
    ]);
    expect(soundsForEvents([{ type: "care", action: "pet" }])).toEqual([
      "chirp",
    ]);
    expect(
      soundsForEvents([
        { type: "levelUp", level: 2, stage: "spark", unlocked: "hat:party" },
        { type: "unlock", key: "hat:party", via: "level" },
      ])
    ).toEqual(["sparkle"]);
    expect(
      soundsForEvents([
        { type: "care", action: "gift" },
        { type: "unlock", key: "hat:party", via: "gift" },
      ])
    ).toEqual(["unwrap"]);
    expect(soundsForEvents([{ type: "state", to: "relit" }])).toContain(
      "relight"
    );
    expect(soundsForEvents([{ type: "state", to: "ember" }])).toEqual([
      "fwoop",
    ]);
    expect(soundsForEvents([{ type: "overfed" }])).toEqual([]);
    expect(
      soundsForEvents([{ type: "buy", key: "hat:pirate", price: 90 }])
    ).toEqual(["sparkle"]);
    // The coin sound is played as sparks land, not when they are earned.
    expect(
      soundsForEvents([{ type: "sparks", amount: 3, source: "feed" }])
    ).toEqual([]);
  });
});

describe("playSound", () => {
  it("does nothing without a sink and calls it with one", () => {
    expect(() => playSound("pip")).not.toThrow();
    const sink = jest.fn();
    setSoundSink(sink);
    playSound("pip");
    expect(sink).toHaveBeenCalledWith("pip");
    setSoundSink(null);
    playSound("pip");
    expect(sink).toHaveBeenCalledTimes(1);
  });
});
