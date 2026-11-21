import type { SimEvent, SimEventKind } from "@/lib/shipwreck/sim/events";
import type { SimFrame } from "@/lib/shipwreck/sim/track";
import {
  CUE_GAP_S,
  EVENT_CUES,
  createCueScheduler,
  frameNear,
  type Cue,
  type CueInput,
} from "../cues";

function ev(t: number, kind: SimEventKind): SimEvent {
  return { t, realT: t, kind };
}
function frame(t: number, trimDeg: number, power = 1): SimFrame {
  return { t, trimDeg, power } as SimFrame;
}
function input(over: Partial<CueInput>): CueInput {
  return {
    t: 0,
    playing: true,
    speed: 1,
    snapId: 0,
    underwater: false,
    now: 100,
    ...over,
  };
}

function setup(events: SimEvent[], frames: SimFrame[] = [frame(0, 0)]) {
  const played: Cue[] = [];
  const s = createCueScheduler((cue) => played.push(cue));
  const run = (over: Partial<CueInput>) =>
    s.update(events, frames, input(over));
  return { s, played, run };
}

describe("event to cue", () => {
  it("maps the story's events to cues and ignores the rest", () => {
    expect(EVENT_CUES.collision).toBe("scrape");
    expect(EVENT_CUES.breakup).toBe("breakup");
    expect(EVENT_CUES["funnel-falls"]).toBe("funnel");
    expect(EVENT_CUES["bow-lands"]).toBe("thud");
    expect(EVENT_CUES["steam-start"]).toBeUndefined();
    expect(EVENT_CUES["floating-steady"]).toBeUndefined();
  });

  it("fires the cue as the shown time passes the event", () => {
    const { played, run } = setup([ev(5, "collision"), ev(20, "breakup")]);
    run({ t: 0 });
    run({ t: 4, now: 101 });
    expect(played).toEqual([]);
    run({ t: 6, now: 102 });
    expect(played).toEqual(["scrape"]);
    run({ t: 25, now: 110 });
    expect(played).toEqual(["scrape", "breakup"]);
  });

  it("sounds the scrape for a collision at t = 0 when a run starts", () => {
    // The sim puts the collision at the very start of the night.
    const { played, run } = setup([ev(0, "collision"), ev(20, "breakup")]);
    run({ t: 0 });
    expect(played).toEqual([]);
    run({ t: 0.5, now: 100.1 });
    expect(played).toEqual(["scrape"]);
    // Watch again: a new run's collision at 0 sounds again.
    const second = [ev(0, "collision")];
    const s2 = createCueScheduler((c) => played.push(c));
    s2.update(second, [frame(0, 0)], input({ t: 0, now: 200 }));
    s2.update(second, [frame(0, 0)], input({ t: 0.03, now: 200.1 }));
    expect(played).toEqual(["scrape", "scrape"]);
  });

  it("does not replay the collision on a scrub back to the start", () => {
    const { played, run } = setup([ev(0, "collision")]);
    run({ t: 0 });
    run({ t: 30, now: 101 });
    expect(played).toEqual(["scrape"]);
    run({ t: 0, now: 120 });
    run({ t: 0.5, now: 120.1 });
    expect(played).toEqual(["scrape"]);
  });

  it("makes no cue while paused, and no replay of old events on resume", () => {
    const { played, run } = setup([ev(5, "collision")]);
    run({ t: 0 });
    run({ t: 6, playing: false, now: 101 });
    expect(played).toEqual([]);
  });
});

describe("seeks", () => {
  it("never sounds the events a seek skipped", () => {
    const { played, run } = setup([
      ev(5, "collision"),
      ev(300, "breakup"),
      ev(900, "bow-lands"),
    ]);
    run({ t: 0 });
    run({ t: 400, snapId: 1, now: 101 });
    expect(played).toEqual([]);
    run({ t: 1000, snapId: 1, now: 110 });
    expect(played).toEqual(["thud"]);
  });

  it("treats going backwards as a seek and lets the events sound again", () => {
    const { played, run } = setup([ev(5, "collision")]);
    run({ t: 0 });
    run({ t: 6, now: 101 });
    run({ t: 2, snapId: 1, now: 120 });
    run({ t: 6, snapId: 1, now: 130 });
    expect(played).toEqual(["scrape", "scrape"]);
  });

  it("restores the held steam state at the new position", () => {
    const events = [ev(10, "steam-start"), ev(50, "steam-stop")];
    const { s, run } = setup(events);
    run({ t: 0 });
    run({ t: 30, snapId: 1, now: 101 });
    expect(s.bed.steam).toBe(true);
    run({ t: 80, snapId: 2, now: 102 });
    expect(s.bed.steam).toBe(false);
  });

  it("starts over for a new run", () => {
    const first = [ev(5, "collision")];
    const second = [ev(5, "collision")];
    const played: Cue[] = [];
    const s = createCueScheduler((c) => played.push(c));
    const frames = [frame(0, 0)];
    s.update(first, frames, input({ t: 0 }));
    s.update(first, frames, input({ t: 6, now: 101 }));
    s.update(second, frames, input({ t: 0, snapId: 1, now: 120 }));
    s.update(second, frames, input({ t: 6, snapId: 1, now: 130 }));
    expect(played).toEqual(["scrape", "scrape"]);
  });
});

describe("rate limiting", () => {
  it("spaces repeats of a cue by its gap on the wall clock", () => {
    const { played, run } = setup([
      ev(1, "rocket"),
      ev(2, "rocket"),
      ev(3, "rocket"),
    ]);
    run({ t: 0, now: 100 });
    run({ t: 1.5, now: 100.1 });
    run({ t: 2.5, now: 100.2 });
    expect(played).toEqual(["rocket"]);
    run({ t: 3.5, now: 100 + CUE_GAP_S.rocket + 0.5 });
    expect(played).toEqual(["rocket", "rocket"]);
  });
});

describe("speed thinning", () => {
  const events = [ev(1, "rocket"), ev(2, "boat-lowered"), ev(3, "breakup")];

  it("plays the short cues at x10", () => {
    const { played, run } = setup(events);
    run({ t: 0, speed: 10 });
    run({ t: 3.5, speed: 10, now: 101 });
    expect(played).toEqual(["rocket", "davit", "breakup"]);
  });

  it("drops the short cues at x30 and x100 but keeps the long ones", () => {
    for (const speed of [30, 100]) {
      const { played, run } = setup(events);
      run({ t: 0, speed });
      run({ t: 3.5, speed, now: 101 });
      expect(played).toEqual(["breakup"]);
    }
  });
});

describe("hull groans", () => {
  // Trim 0 until t=50, then 3 degrees at t=100, 25 at t=200.
  const frames = Array.from({ length: 201 }, (_, k) =>
    frame(k, k < 50 ? 0 : k <= 100 ? 3 : 3 + ((k - 100) * 22) / 100)
  );

  it("is silent while she is level", () => {
    const { s, played, run } = setup([], frames);
    run({ t: 10, now: 100 });
    run({ t: 11, now: 110 });
    expect(played).toEqual([]);
    expect(s.bed.strain).toBe(0);
  });

  it("creaks faster and louder as the trim grows", () => {
    const gaps = (t: number) => {
      const times: number[] = [];
      const none: SimEvent[] = [];
      const s = createCueScheduler(() => times.push(now));
      let now = 100;
      for (; now < 160; now += 0.5) {
        s.update(none, frames, input({ t, now }));
      }
      return times.length;
    };
    expect(gaps(200)).toBeGreaterThan(gaps(105));
    expect(gaps(105)).toBeGreaterThan(0);
  });

  it("makes far-off creaks under water, none at x30", () => {
    const { played, run } = setup([], frames);
    run({ t: 200, underwater: true, now: 100 });
    expect(played).toEqual(["creakFar"]);
    const fast = setup([], frames);
    fast.run({ t: 200, underwater: true, speed: 30, now: 100 });
    expect(fast.played).toEqual([]);
  });

  it("follows the power for the machinery hum", () => {
    const { s, run } = setup([], [frame(0, 0, 1), frame(50, 0, 0)]);
    run({ t: 0 });
    expect(s.bed.power).toBe(1);
    run({ t: 60, now: 101 });
    expect(s.bed.power).toBe(0);
  });
});

describe("frameNear", () => {
  it("finds the nearest later frame without allocating", () => {
    const frames = [frame(0, 0), frame(10, 1), frame(20, 2)];
    expect(frameNear(frames, 12)?.t).toBe(20);
    expect(frameNear(frames, -5)?.t).toBe(0);
    expect(frameNear([], 1)).toBeNull();
  });
});
