import {
  ambientFor,
  cuesFor,
  muffleFor,
  stingFor,
  type PlaybackSnapshot,
} from "../cues";

function snap(over: Partial<PlaybackSnapshot> = {}): PlaybackSnapshot {
  return {
    time: 0,
    phase: "sailing",
    strain: 0,
    power: "on",
    events: [],
    speed: 1,
    scrubbing: false,
    ...over,
  };
}

const kinds = (cues: ReturnType<typeof cuesFor>) => cues.map((c) => c.kind);

describe("cuesFor", () => {
  it("makes no sound when nothing changed", () => {
    expect(cuesFor(snap({ time: 1 }), snap({ time: 1.01 }))).toEqual([]);
  });

  it("cues the impact once, on the first flooding event", () => {
    const flooding = [{ kind: "flooding" as const }];
    expect(
      kinds(cuesFor(snap({ time: 1 }), snap({ time: 1.02, events: flooding })))
    ).toContain("impact");
    expect(
      kinds(
        cuesFor(
          snap({ time: 1.02, events: flooding }),
          snap({ time: 1.04, events: [...flooding, { kind: "flooding" }] })
        )
      )
    ).not.toContain("impact");
  });

  it("cues the break, power out and each touchdown", () => {
    const next = snap({
      time: 5,
      events: [
        { kind: "broke" },
        { kind: "power-out" },
        { kind: "touched-bottom" },
        { kind: "touched-bottom" },
      ],
    });
    const cues = kinds(cuesFor(snap({ time: 4.98 }), next));
    expect(cues).toContain("break");
    expect(cues).toContain("power-out");
    expect(cues.filter((k) => k === "touchdown")).toHaveLength(2);
  });

  it("creaks more often as strain rises, and louder", () => {
    const count = (strain: number) => {
      let total = 0;
      let intensity = 0;
      for (let t = 0; t < 20; t += 0.1) {
        const cues = cuesFor(
          snap({ time: t, strain }),
          snap({ time: t + 0.1, strain })
        );
        for (const cue of cues) {
          if (cue.kind === "creak") {
            total += 1;
            intensity = cue.intensity;
          }
        }
      }
      return { total, intensity };
    };
    const low = count(0.08);
    const high = count(0.28);
    expect(low.total).toBeGreaterThan(0);
    expect(high.total).toBeGreaterThan(low.total);
    expect(high.intensity).toBeGreaterThan(low.intensity);
    expect(count(0).total).toBe(0);
  });

  it("stops creaking once she has broken", () => {
    const events = [{ kind: "broke" as const }];
    const cues = cuesFor(
      snap({ time: 9.9, strain: 0.3, events }),
      snap({ time: 10.1, strain: 0.3, events })
    );
    expect(kinds(cues)).not.toContain("creak");
  });

  it("flickers at a capped rate while the lights flicker", () => {
    let total = 0;
    for (let t = 0; t < 2; t += 1 / 60) {
      total += kinds(
        cuesFor(
          snap({ time: t, power: "flickering" }),
          snap({ time: t + 1 / 60, power: "flickering" })
        )
      ).filter((k) => k === "flicker").length;
    }
    expect(total).toBeGreaterThan(5);
    expect(total).toBeLessThan(12);
  });

  it("gurgles while sinking, but not once the trial is done", () => {
    const sinking = (time: number) => snap({ time, phase: "sinking" });
    expect(kinds(cuesFor(sinking(1.6), sinking(1.8)))).toContain("gurgle");
    expect(
      kinds(cuesFor(snap({ time: 1.6, phase: "done" }), snap({ time: 1.8 })))
    ).not.toContain("gurgle");
  });

  it("is silent while scrubbing and when time runs backwards", () => {
    const events = [{ kind: "broke" as const }];
    expect(
      cuesFor(snap({ time: 1 }), snap({ time: 5, events, scrubbing: true }))
    ).toEqual([]);
    expect(cuesFor(snap({ time: 5, events }), snap({ time: 0.5 }))).toEqual([]);
  });
});

describe("ambientFor", () => {
  it("hums only while the lights are on and the trial runs", () => {
    expect(ambientFor(snap())).toEqual({ sea: true, hum: true });
    expect(ambientFor(snap({ power: "out" }))).toEqual({
      sea: true,
      hum: false,
    });
    expect(ambientFor(snap({ phase: "done" }))).toEqual({
      sea: false,
      hum: false,
    });
  });
});

describe("muffleFor", () => {
  it("is clear above water at normal speed", () => {
    expect(muffleFor(3, 1)).toBe(0);
  });

  it("muffles underwater and in slow motion", () => {
    expect(muffleFor(-2, 1)).toBeGreaterThan(0.5);
    expect(muffleFor(3, 0.25)).toBeGreaterThan(0);
    expect(muffleFor(3, 0.25)).toBeLessThan(muffleFor(-2, 1));
  });
});

describe("the sound-pass cues", () => {
  it("cues a funnel crash for each funnel that snaps", () => {
    const one = [{ kind: "funnel-broke" as const }];
    const both = [...one, { kind: "funnel-broke" as const }];
    expect(
      kinds(cuesFor(snap({ time: 5 }), snap({ time: 5.02, events: one })))
    ).toContain("funnel-crash");
    expect(
      kinds(
        cuesFor(
          snap({ time: 5, events: one }),
          snap({ time: 5.02, events: one })
        )
      )
    ).not.toContain("funnel-crash");
    expect(
      cuesFor(
        snap({ time: 5, events: one }),
        snap({ time: 5.02, events: both })
      ).filter((c) => c.kind === "funnel-crash")
    ).toHaveLength(1);
  });

  it("groans now and then while she settles, before she breaks", () => {
    let groans = 0;
    for (let t = 0; t < 10; t += 0.05) {
      groans += kinds(
        cuesFor(
          snap({ time: t, phase: "sinking" }),
          snap({ time: t + 0.05, phase: "sinking" })
        )
      ).filter((kind) => kind === "groan").length;
    }
    expect(groans).toBeGreaterThanOrEqual(2);
    expect(groans).toBeLessThanOrEqual(4);
  });

  it("does not groan when she is sailing, or once she has broken", () => {
    expect(
      kinds(cuesFor(snap({ time: 3.0 }), snap({ time: 3.2 })))
    ).not.toContain("groan");
    const broke = [{ kind: "broke" as const }];
    expect(
      kinds(
        cuesFor(
          snap({ time: 3.0, phase: "sinking", events: broke }),
          snap({ time: 3.2, phase: "sinking", events: broke })
        )
      )
    ).not.toContain("groan");
  });
});

describe("stingFor", () => {
  it("is cheerful when she lives and sombre when she is lost", () => {
    const survived = { kind: "sting", outcome: "survived" };
    expect(stingFor("afloat")).toEqual(survived);
    expect(stingFor("steady")).toEqual(survived);
    expect(stingFor("recovered")).toEqual(survived);
    const sank = { kind: "sting", outcome: "sank" };
    expect(stingFor("sank")).toEqual(sank);
    expect(stingFor("capsized")).toEqual(sank);
  });

  it("has none before the outcome is known", () => {
    expect(stingFor(null)).toBeNull();
  });
});
