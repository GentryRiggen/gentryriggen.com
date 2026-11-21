import {
  createPlaybackStore,
  effectiveSpeed,
  eventsSeen,
  inSlowMoWindow,
  phaseAt,
  realTimeAt,
} from "../playback";
import { lusitania } from "../ships/lusitania";
import { titanic } from "../ships/titanic";
import type { SimRunner } from "../sim/run";
import type { SimFrame, SimTrack } from "../sim/track";

function frame(t: number, realT = t): SimFrame {
  return {
    t,
    realT,
    bodies: [{ part: "whole", x: 0, y: 0, z: 0, pitch: 0, roll: 0, yaw: 0 }],
    water: [],
    waterAboardT: 0,
    trimDeg: 0,
    listDeg: 0,
    power: 1,
    groundedParts: [],
  };
}

function fakeTrack(endT: number, extra: Partial<SimTrack> = {}): SimTrack {
  const frames: SimFrame[] = [];
  for (let t = 0; t <= endT; t += 10) frames.push(frame(t));
  return {
    frames,
    events: [],
    outcome: "sank",
    sankAtT: null,
    brokeAtT: null,
    breakX: null,
    endT,
    ...extra,
  };
}

/** A runner that grows its track by `stepT` seconds per advance. */
function fakeRunner(endT: number, stepT: number): SimRunner {
  const full = fakeTrack(endT);
  let upTo = 0;
  const track = { ...full, frames: [] as SimFrame[] };
  return {
    advance() {
      upTo = Math.min(endT, upTo + stepT);
      track.frames = full.frames.filter((f) => f.t <= upTo);
      return upTo >= endT;
    },
    get done() {
      return upTo >= endT;
    },
    progress: () => upTo / endT,
    track: () => track,
  };
}

describe("playback store", () => {
  function started(endT = 1000, stepT = 1000) {
    const store = createPlaybackStore({
      createRunner: () => fakeRunner(endT, stepT),
    });
    store.getState().start(titanic, titanic.realNight);
    return store;
  }

  it("pumps the runner until done and tracks the computed end", () => {
    const store = started(1000, 400);
    store.getState().pump();
    expect(store.getState().computedT).toBe(400);
    expect(store.getState().done).toBe(false);
    store.getState().pump();
    store.getState().pump();
    expect(store.getState().done).toBe(true);
    expect(store.getState().computedT).toBe(1000);
    expect(store.getState().progress).toBe(1);
  });

  it("advances t by delta times speed and clamps at the computed end", () => {
    const store = started(1000, 400);
    store.getState().pump();
    store.getState().setSpeed(100, 0);
    store.getState().play();
    store.getState().tick(1, 100);
    expect(store.getState().t).toBe(100);
    store.getState().tick(10, 100);
    // Only 400 s computed so far: playback waits there.
    expect(store.getState().t).toBe(400);
    expect(store.getState().playing).toBe(true);
    store.getState().pump();
    store.getState().pump();
    store.getState().tick(10, 100);
    expect(store.getState().t).toBe(1000);
    // At the end of a finished track it stops.
    expect(store.getState().playing).toBe(false);
  });

  it("does not move while paused", () => {
    const store = started();
    store.getState().pump();
    store.getState().tick(1, 0);
    expect(store.getState().t).toBe(0);
  });

  it("seek clamps to the computed frames and asks the camera to snap", () => {
    const store = started(1000, 400);
    store.getState().pump();
    const snap = store.getState().snapId;
    store.getState().seek(900);
    expect(store.getState().t).toBe(400);
    store.getState().seek(-5);
    expect(store.getState().t).toBe(0);
    expect(store.getState().snapId).toBe(snap + 2);
  });

  it("flyToPlace turns X-ray on for interior places and takes the free camera", () => {
    const store = started();
    store.getState().setCamera("cinematic");
    store.getState().flyToPlace("boiler-room-6");
    const s = store.getState();
    expect(s.place).toBe("boiler-room-6");
    expect(s.camera).toBe("orbit");
    expect(s.xray).toBe(true);
    expect(s.flyId).toBe(1);
  });

  it("takeControl switches to the free camera without a snap", () => {
    const store = started();
    store.getState().setCamera("lifeboat");
    const snap = store.getState().snapId;
    store.getState().takeControl();
    expect(store.getState().camera).toBe("orbit");
    expect(store.getState().snapId).toBe(snap);
  });

  it("starts at medium quality on the free camera", () => {
    const store = createPlaybackStore();
    expect(store.getState().quality).toBe("medium");
    expect(store.getState().camera).toBe("orbit");
  });

  it("plays from the start again after the end", () => {
    const store = started(1000, 1000);
    store.getState().pump();
    store.getState().seek(1000);
    store.getState().play();
    expect(store.getState().t).toBe(0);
  });
});

describe("slow-mo", () => {
  const track = fakeTrack(9000, { brokeAtT: 8000, sankAtT: 8100 });
  const base = {
    track,
    speed: 100 as const,
    camera: "cinematic" as const,
    speedTouchedAt: -Infinity,
  };

  it("holds ×1 around the break and the plunge on the cinematic camera", () => {
    expect(inSlowMoWindow(track, 7980)).toBe(true);
    expect(inSlowMoWindow(track, 8110)).toBe(true);
    expect(inSlowMoWindow(track, 7000)).toBe(false);
    expect(effectiveSpeed({ ...base, t: 8010 }, 1000)).toBe(1);
    expect(effectiveSpeed({ ...base, t: 7000 }, 1000)).toBe(100);
  });

  it("holds ×1 through a torpedo's hit and the second explosion", () => {
    const hitTrack = fakeTrack(1000, {
      events: [
        { kind: "collision", t: 0, realT: 0 },
        { kind: "explosion", t: 8, realT: 8 },
      ],
    });
    const hole = {
      compartmentId: "br1",
      areaM2: 6,
      zLow: 2,
      zHigh: 6,
      x: 60,
      side: "starboard" as const,
    };
    const run = { ...base, track: hitTrack, openings: [hole] };
    expect(effectiveSpeed({ ...run, t: 0 }, 1000)).toBe(1);
    expect(effectiveSpeed({ ...run, t: 15 }, 1000)).toBe(1);
    expect(effectiveSpeed({ ...run, t: 40 }, 1000)).toBe(100);
    // No hole (the title's calm ship), and the Titanic's night: as before.
    expect(effectiveSpeed({ ...run, openings: [], t: 5 }, 1000)).toBe(100);
    expect(effectiveSpeed({ ...base, openings: [hole], t: 5 }, 1000)).toBe(100);
  });

  it("not on other cameras, nor within 10 s of a speed change", () => {
    expect(effectiveSpeed({ ...base, t: 8010, camera: "orbit" }, 1000)).toBe(
      100
    );
    expect(
      effectiveSpeed({ ...base, t: 8010, speedTouchedAt: 995 }, 1000)
    ).toBe(100);
    expect(
      effectiveSpeed({ ...base, t: 8010, speedTouchedAt: 985 }, 1000)
    ).toBe(1);
  });

  it("the store reports slow-mo and keeps the chosen speed", () => {
    const store = createPlaybackStore({
      createRunner: () => ({
        advance: () => true,
        done: true,
        progress: () => 1,
        track: () => track,
      }),
    });
    const s = store.getState();
    s.start(titanic, []);
    store.getState().pump();
    store.getState().setSpeed(100, -100);
    store.getState().setCamera("cinematic");
    store.getState().seek(7990);
    store.getState().play();
    store.getState().tick(1, 1000);
    expect(store.getState().t).toBe(7991);
    expect(store.getState().slowMo).toBe(true);
    expect(store.getState().speed).toBe(100);
  });
});

describe("story helpers", () => {
  it("phase and events seen follow the track's own events", () => {
    const track = fakeTrack(9000, {
      brokeAtT: 8000,
      sankAtT: 8100,
      events: [
        { kind: "collision", t: 0, realT: 0 },
        { kind: "boat-lowered", t: 3900, realT: 3900, index: 6 },
        { kind: "last-boat", t: 5100, realT: 5100 },
        { kind: "breakup", t: 8000, realT: 8000 },
        { kind: "stern-under", t: 8100, realT: 8100 },
        { kind: "bow-lands", t: 8150, realT: 8400 },
      ],
    });
    expect(phaseAt(track, 100)).toBe("settling");
    expect(phaseAt(track, 4000)).toBe("lifeboats");
    expect(phaseAt(track, 6000)).toBe("final-plunge");
    expect(phaseAt(track, 8050)).toBe("breakup");
    expect(phaseAt(track, 8120)).toBe("descent");
    expect(phaseAt(track, 8200)).toBe("wreck");
    expect(eventsSeen(track, 4000)).toEqual(["collision", "boat-lowered"]);
  });

  it("real time comes from the frames", () => {
    const track = fakeTrack(20);
    track.frames = [frame(0), frame(10, 10), frame(20, 70)];
    expect(realTimeAt(track, 15)).toBeCloseTo(40);
    expect(realTimeAt(null, 15)).toBe(15);
  });
});

describe("playback: the ship on the stage", () => {
  it("starts with the Titanic; a run puts its ship on the stage", () => {
    const made: { ship: string; portholesOpen?: boolean }[] = [];
    const store = createPlaybackStore({
      createRunner: (spec, _o, options) => {
        made.push({ ship: spec.id, portholesOpen: options.portholesOpen });
        return fakeRunner(100, 100);
      },
    });
    expect(store.getState().ship).toBe("titanic");
    store
      .getState()
      .start(lusitania, lusitania.realNight, { portholesOpen: false });
    expect(store.getState().ship).toBe("lusitania");
    expect(made).toEqual([{ ship: "lusitania", portholesOpen: false }]);
    store.getState().start(titanic, []);
    expect(made[1]).toEqual({ ship: "titanic", portholesOpen: undefined });
  });

  it("setShip drops the other ship's run, and keeps her own", () => {
    const store = createPlaybackStore({
      createRunner: () => fakeRunner(100, 100),
    });
    store.getState().start(titanic, titanic.realNight);
    store.getState().pump();
    store.getState().play();
    store.getState().setShip("titanic");
    expect(store.getState().track).not.toBeNull();
    store.getState().setShip("lusitania");
    const s = store.getState();
    expect(s.ship).toBe("lusitania");
    expect(s.track).toBeNull();
    expect(s.openings).toEqual([]);
    expect(s.playing).toBe(false);
    expect(s.t).toBe(0);
    // Nothing to pump until she is started.
    s.pump();
    expect(store.getState().track).toBeNull();
  });

  it("flies to her own places", () => {
    const store = createPlaybackStore({
      createRunner: () => fakeRunner(100, 100),
    });
    store.getState().start(lusitania, []);
    store.getState().flyToPlace("starboard-bunker");
    expect(store.getState().place).toBe("starboard-bunker");
    expect(store.getState().xray).toBe(true);
  });
});
