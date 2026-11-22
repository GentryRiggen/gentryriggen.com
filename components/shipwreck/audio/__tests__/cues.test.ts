import type { SimEvent, SimEventKind } from "@/lib/shipwreck/sim/events";
import type { StormSpec } from "@/lib/shipwreck/ships/types";
import type { SimFrame } from "@/lib/shipwreck/sim/track";
import {
  CUE_GAP_S,
  EVENT_CUES,
  LUSITANIA_EVENT_CUES,
  FITZGERALD_EVENT_CUES,
  windAt,
  eventCuesFor,
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

describe("the afternoon (Lusitania)", () => {
  it("leaves the Titanic's mapping exactly as it was", () => {
    expect(eventCuesFor("titanic")).toBe(EVENT_CUES);
    expect(EVENT_CUES).toEqual({
      collision: "scrape",
      rocket: "rocket",
      "boat-lowered": "davit",
      "last-boat": "davit",
      "forecastle-under": "rush",
      "bridge-under": "rush",
      "funnel-falls": "funnel",
      "lights-out": "powerDown",
      breakup: "breakup",
      "bow-under": "plunge",
      "stern-under": "plunge",
      "bow-lands": "thud",
      "stern-lands": "thud",
    });
  });

  it("gives her a muffled torpedo thud, a deeper second explosion, no rocket", () => {
    const m = eventCuesFor("lusitania");
    expect(m).toBe(LUSITANIA_EVENT_CUES);
    expect(m.collision).toBe("torpedo");
    expect(m.explosion).toBe("boom");
    expect(m.rocket).toBeUndefined();
    expect(Object.values(m)).not.toContain("scrape");
    expect(m["funnel-falls"]).toBe("funnel");
    expect(m["boat-lowered"]).toBe("davit");
    expect(m["stern-under"]).toBe("plunge");
    expect(m["lights-out"]).toBe("powerDown");
  });

  it("sounds the torpedo, then the second explosion, for her", () => {
    const played: Cue[] = [];
    const s = createCueScheduler((c) => played.push(c));
    const evs = [ev(0, "collision"), ev(8, "explosion"), ev(9, "rocket")];
    const fr = [frame(0, 0)];
    const at = (t: number, now: number) =>
      s.update(evs, fr, input({ t, now, ship: "lusitania" }));
    at(0, 100);
    at(0.5, 100.5);
    at(8.5, 110);
    at(9.5, 111);
    expect(played.filter((c) => c !== "gull")).toEqual(["torpedo", "boom"]);
  });

  it("has distant gulls above water, sparse, never under water", () => {
    const count = (underwater: boolean, ship: "titanic" | "lusitania") => {
      const played: Cue[] = [];
      const s = createCueScheduler((c) => played.push(c));
      const none: SimEvent[] = [];
      for (let now = 100; now < 200; now += 0.5)
        s.update(none, [frame(0, 0)], input({ now, underwater, ship }));
      return played.filter((c) => c === "gull").length;
    };
    const n = count(false, "lusitania");
    expect(n).toBeGreaterThan(3);
    expect(n).toBeLessThan(15);
    expect(count(true, "lusitania")).toBe(0);
    expect(count(false, "titanic")).toBe(0);
  });

  it("exposes the ship on the held state", () => {
    const s = createCueScheduler(() => {});
    s.update([], [frame(0, 0)], input({ ship: "lusitania" }));
    expect(s.bed.ship).toBe("lusitania");
    s.update([], [frame(0, 0)], input({}));
    expect(s.bed.ship).toBe("titanic");
  });
});

describe("walking cues", () => {
  const walkCues = (played: Cue[]) =>
    played.filter((c) => c === "splash" || c === "scrape");
  type Walk = NonNullable<CueInput["walk"]>;
  const walk = (over: Partial<Walk>): Walk => ({
    phase: "deck",
    slide: 0,
    splash: 0,
    ...over,
  });

  it("has a splash cue with a 2 s gap", () => {
    expect(CUE_GAP_S.splash).toBe(2);
  });

  it("going in fires splash once", () => {
    const { played, run } = setup([]);
    run({ playing: false, now: 100, walk: walk({ splash: 3 }) });
    run({ playing: false, now: 100.2, walk: walk({ splash: 3 }) });
    expect(walkCues(played)).toEqual([]);
    run({
      playing: false,
      now: 100.4,
      walk: walk({ phase: "water", splash: 4 }),
    });
    for (let now = 100.6; now < 110; now += 0.2)
      run({ playing: false, now, walk: walk({ phase: "water", splash: 4 }) });
    expect(walkCues(played)).toEqual(["splash"]);
  });

  it("sliding fires scrape no more than once per 1.5 s, at the slide's level", () => {
    const played: { cue: Cue; level: number; now: number }[] = [];
    let now = 100;
    const s = createCueScheduler((cue, level) =>
      played.push({ cue, level, now })
    );
    for (; now < 112; now += 0.1)
      s.update(
        [],
        [frame(0, 0)],
        input({ playing: false, now, walk: walk({ slide: 0.6 }) })
      );
    const scrapes = played.filter((p) => p.cue === "scrape");
    expect(scrapes.length).toBeGreaterThan(1);
    for (let k = 1; k < scrapes.length; k += 1)
      expect(scrapes[k].now - scrapes[k - 1].now).toBeGreaterThanOrEqual(1.5);
    expect(scrapes[0].level).toBeCloseTo(0.6);
  });

  it("no scrape on a level deck or in the water", () => {
    const { played, run } = setup([]);
    for (let now = 100; now < 110; now += 0.2) {
      run({ playing: false, now, walk: walk({ slide: 0 }) });
      run({
        playing: false,
        now: now + 0.1,
        walk: walk({ phase: "water", slide: 0.8 }),
      });
    }
    expect(walkCues(played)).toEqual([]);
  });

  it("no walk cues when walk is off", () => {
    const { played, run } = setup([]);
    for (let now = 100; now < 110; now += 0.2)
      run({
        playing: false,
        now,
        walk: walk({ phase: "off", slide: 1, splash: Math.floor(now) }),
      });
    run({ playing: false, now: 111 });
    expect(walkCues(played)).toEqual([]);
  });
});

describe("the Edmund Fitzgerald's sounds", () => {
  const storm = {
    components: [],
    hsM: 7,
    windKn: 50,
    ramp: [
      [0, 0.5],
      [1000, 1],
    ],
    groups: [{ t: 100, heightM: 5, count: 3, periodS: 10, dirDeg: 0 }],
  } as unknown as StormSpec;

  it("maps her events: a quiet swell for the collision, no scrape, rocket or whistle", () => {
    const m = eventCuesFor("fitzgerald");
    expect(m).toBe(FITZGERALD_EVENT_CUES);
    expect(m.collision).toBe("swell");
    expect(m["hatch-fails"]).toBe("hatch");
    expect(m.breakup).toBe("breakup");
    expect(m["bow-under"]).toBe("plunge");
    expect(m["stern-lands"]).toBe("thud");
    expect(m.rocket).toBeUndefined();
    expect(m["funnel-falls"]).toBeUndefined();
    expect(Object.values(m)).not.toContain("scrape");
    expect(Object.values(m)).not.toContain("funnel");
    expect(Object.values(m)).not.toContain("rocket");
  });

  it("leaves the Titanic's and the Lusitania's maps alone", () => {
    expect(eventCuesFor("titanic")).toBe(EVENT_CUES);
    expect(eventCuesFor("lusitania")).toBe(LUSITANIA_EVENT_CUES);
  });

  it("sounds a hatch at most once per gap, not 21 in a burst", () => {
    const evs = Array.from({ length: 21 }, (_, k) => ({
      ...ev(10 + k * 0.1, "hatch-fails"),
      index: k + 1,
    }));
    const { played, run } = setup(evs);
    run({ t: 0, ship: "fitzgerald" });
    run({ t: 20, now: 101, ship: "fitzgerald" });
    expect(played.filter((c) => c === "hatch")).toHaveLength(1);
  });

  it("breaks a wave group's crash once per big sea", () => {
    const { played, run } = setup([]);
    const at = (t: number, now: number) =>
      run({ t, now, ship: "fitzgerald", storm, stormScale: 1 });
    at(0, 100);
    at(99, 101);
    at(101, 110);
    at(111, 120);
    at(125, 130);
    expect(played.filter((c) => c === "waveCrash")).toHaveLength(3);
  });

  it("does not replay crashes skipped by a seek", () => {
    const { played, run } = setup([]);
    run({ t: 0, ship: "fitzgerald", storm, stormScale: 1 });
    run({ t: 200, now: 101, snapId: 1, ship: "fitzgerald", storm });
    expect(played).toEqual([]);
  });

  it("raises the wind with the sea's ramp and the storm scale", () => {
    expect(windAt(undefined, 1, 0)).toBe(0);
    const early = windAt(storm, 1, 0);
    const late = windAt(storm, 1, 1000);
    expect(late).toBeGreaterThan(early);
    expect(windAt(storm, 0.6, 1000)).toBeLessThan(late);
    expect(late).toBeLessThanOrEqual(1);
    const { s, run } = setup([]);
    run({ t: 1000, ship: "fitzgerald", storm, stormScale: 1 });
    expect(s.bed.wind).toBeCloseTo(late, 6);
  });

  it("plays the torpedo cue once per staggered hit, and once for one hit", () => {
    const count = (hits: number) => {
      const played: Cue[] = [];
      const s = createCueScheduler((c) => played.push(c));
      const evs = [ev(0, "collision")];
      const fr = [frame(0, 0)];
      let now = 100;
      for (const t of [0, 0.5, 3.2, 3.5, 6.2, 7, 12]) {
        now += t === 0 ? 0 : 3;
        s.update(evs, fr, input({ t, now, ship: "lusitania", hits }));
      }
      return played.filter((c) => c === "torpedo").length;
    };
    expect(count(1)).toBe(1);
    expect(count(3)).toBe(3);
  });

  it("plays every staggered hit at x10, inside the torpedo's wall-clock gap", () => {
    const played: { cue: Cue; t: number }[] = [];
    let t = 0;
    const s = createCueScheduler((cue) => played.push({ cue, t }));
    const evs = [ev(0, "collision")];
    const fr = [frame(0, 0)];
    // 20 updates a second of wall clock at x10: 0.5 s of sim each.
    for (let k = 0; k <= 30; k += 1) {
      t = k * 0.5;
      s.update(
        evs,
        fr,
        input({ t, now: 100 + k * 0.05, speed: 10, ship: "lusitania", hits: 3 })
      );
    }
    // The first with the collision as playback moves, the rest at their times.
    const hits = played.filter((p) => p.cue === "torpedo").map((p) => p.t);
    expect(hits).toEqual([0.5, 3, 6]);
  });

  it("centres a wave group's crashes on its biggest crest", () => {
    const at: number[] = [];
    let t = 0;
    const s = createCueScheduler((cue) => {
      if (cue === "waveCrash") at.push(t);
    });
    const none: SimEvent[] = [];
    const fr = [frame(0, 0)];
    for (let k = 0; k <= 140; k += 1) {
      t = k;
      s.update(
        none,
        fr,
        input({ t, now: 100 + k, ship: "fitzgerald", storm, stormScale: 1 })
      );
    }
    // Group at t = 100, three seas 10 s apart: 90, 100, 110.
    expect(at).toEqual([90, 100, 110]);
  });
});
