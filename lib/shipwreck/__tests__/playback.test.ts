import {
  HIT_STAGGER_S,
  createPlaybackStore,
  effectiveSpeed,
  inHitWindow,
  hitTimeS,
  eventsSeen,
  inSlowMoWindow,
  phaseAt,
  realTimeAt,
  speedOnGoingIn,
  WATCH_HER_GO_S,
  SLOWMO_HALF,
  STORM_START_SPEED,
  slowMoSpeed,
  startSpeed,
  inOwnHitWindow,
} from "../playback";
import { carpathia, CARPATHIA_HIT_T } from "../ships/carpathia";
import {
  FINISHER_SPOT,
  torpedoHits,
  whatIfOpenings,
  whatIfRealIds,
} from "../sim/run";
import type { Speed } from "../types";
import { walkInput } from "../walk";
import { britannic } from "../ships/britannic";
import { concordia } from "../ships/concordia";
import { fitzgerald } from "../ships/fitzgerald";
import { lusitania } from "../ships/lusitania";
import { poseidon } from "../ships/poseidon";
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

  it("a tail ship (the Fitzgerald) holds until done, then shows only her last 10%", () => {
    expect(fitzgerald.timelineTail).toBe(0.1);
    const store = createPlaybackStore({
      createRunner: () => fakeRunner(1000, 400),
    });
    store.getState().start(fitzgerald, fitzgerald.realNight);
    store.getState().play();
    store.getState().pump();
    expect(store.getState().done).toBe(false);
    // Holding: no time passes and no seeking yet.
    store.getState().tick(1, 100);
    store.getState().seek(300);
    expect(store.getState().t).toBe(0);
    store.getState().pump();
    store.getState().pump();
    expect(store.getState().done).toBe(true);
    expect(store.getState().minT).toBe(900);
    expect(store.getState().t).toBe(900);
    // Seeks stay in the tail; play goes on from its start.
    store.getState().seek(100);
    expect(store.getState().t).toBe(900);
    store.getState().tick(1, 100);
    expect(store.getState().t).toBeGreaterThan(900);
    // The title's stage and other ships show the whole run.
    store.getState().start(fitzgerald, [], { preview: true });
    expect(store.getState().tail).toBe(0);
    store.getState().start(titanic, titanic.realNight);
    expect(store.getState().tail).toBe(0);
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

  it("starts a torpedo ship's run before the hit (the pre-roll); the Titanic at the collision", () => {
    const store = createPlaybackStore({
      createRunner: () => fakeRunner(1000, 1000),
    });
    const pre = lusitania.preRollS ?? 0;
    expect(pre).toBeGreaterThanOrEqual(30);
    store.getState().start(lusitania, lusitania.realNight);
    expect(store.getState().t).toBe(-pre);
    expect(store.getState().minT).toBe(-pre);
    // Before the hit the real clock runs with it (no sim frames yet).
    expect(store.getState().realT).toBe(-pre);
    store.getState().pump();
    store.getState().setSpeed(10, 0);
    store.getState().play();
    store.getState().tick(1, 100);
    expect(store.getState().t).toBe(-pre + 10);
    expect(store.getState().realT).toBe(-pre + 10);
    // Seeks reach back to the pre-roll, no further.
    store.getState().seek(-1000);
    expect(store.getState().t).toBe(-pre);
    // Playing again from the end starts at the pre-roll.
    store.getState().seek(1000);
    store.getState().play();
    expect(store.getState().t).toBe(-pre);
    // The title's calm ship (no hole) and the Titanic have none.
    store.getState().start(lusitania, []);
    expect(store.getState().t).toBe(0);
    expect(store.getState().minT).toBe(0);
    store.getState().start(titanic, titanic.realNight);
    expect(store.getState().t).toBe(0);
    expect(store.getState().minT).toBe(0);
    store.getState().pump();
    store.getState().seek(-50);
    expect(store.getState().t).toBe(0);
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

  it("a storm ship: ×1 from the big seas through her bow going under, ×½ as her parts fall", () => {
    // Her real run's times (shown = real for her).
    const storm = {
      ...fitzgerald.storm!,
      groups: [{ ...fitzgerald.storm!.groups![0], t: 13314.5 }],
    };
    const ev = (kind: string, t: number) =>
      ({ kind, t, realT: t }) as SimTrack["events"][number];
    const tr = fakeTrack(13500, {
      storm,
      stormScale: 1,
      brokeAtT: 13363.7,
      sankAtT: 13365.2,
      events: [
        ev("collision", 0),
        ev("bow-under", 13323),
        ev("bow-lands", 13363.5),
        ev("breakup", 13363.7),
        ev("stern-under", 13365.2),
        ev("stern-lands", 13370),
      ],
    });
    const at = (t: number) => slowMoSpeed(tr, t);
    expect(at(13250)).toBeNull();
    // The sisters' arrival, 30 s before, through bow-under and on into
    // the break's own window (no gap at ×100 between them).
    for (const t of [13285, 13314.5, 13323, 13328, 13333])
      expect(at(t)).toBe(1);
    // The fall to the floor and the stern's roll (about 3 s) at ×½.
    for (const t of [13361, 13363.5, 13366, 13369, 13372])
      expect(at(t)).toBe(SLOWMO_HALF.speed);
    expect(at(13380)).toBe(1); // the break's window, after
    expect(at(13500)).toBeNull();
    expect(inSlowMoWindow(tr, 13300)).toBe(true);
    const run = { ...base, track: tr, speed: 10 as const };
    expect(effectiveSpeed({ ...run, t: 13300 }, 1000)).toBe(1);
    expect(effectiveSpeed({ ...run, t: 13366 }, 1000)).toBe(0.5);
    expect(effectiveSpeed({ ...run, t: 9000 }, 1000)).toBe(10);
    // A liner's windows are as they were (no ×½).
    for (let t = 7900; t < 8200; t += 5)
      expect([null, 1]).toContain(slowMoSpeed(track, t));
  });

  it("starts her storm at ×10 at most (the liners at the player's speed)", () => {
    expect(STORM_START_SPEED).toBe(10);
    expect(startSpeed(fitzgerald, 30)).toBe(10);
    expect(startSpeed(fitzgerald, 100)).toBe(10);
    expect(startSpeed(fitzgerald, 1)).toBe(1);
    expect(startSpeed(titanic, 30)).toBe(30);
    expect(startSpeed(lusitania, 100)).toBe(100);
  });

  it("starts the Poseidon's wave at ×10 at most, and holds her roll at ×1 (1.11)", () => {
    expect(startSpeed(poseidon, 30)).toBe(10);
    expect(startSpeed(poseidon, 100)).toBe(10);
    expect(startSpeed(poseidon, 1)).toBe(1);
    // Her roll: from just before the wave to just after she is keel up; the
    // storm's long seas window (×1 up to bow-under) is not hers.
    const track = {
      ...fakeTrack(3200, {
        events: [
          { t: 0, realT: 0, kind: "collision" as const },
          { t: 25, realT: 25, kind: "capsized" as const },
          { t: 470, realT: 2700, kind: "bow-under" as const },
        ],
      }),
      storm: poseidon.storm,
    };
    expect(slowMoSpeed(track, -10)).toBeNull();
    expect(slowMoSpeed(track, -3)).toBe(1);
    expect(slowMoSpeed(track, 20)).toBe(1);
    expect(slowMoSpeed(track, 32)).toBe(1);
    expect(slowMoSpeed(track, 40)).toBeNull();
    expect(slowMoSpeed(track, 300)).toBeNull();
    // A smaller wave (no capsize) has no window at all.
    expect(slowMoSpeed(fakeTrack(300, {}), 5)).toBeNull();
  });

  it("holds ×1 through a torpedo's run-in, its hit and the second explosion", () => {
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
    expect(effectiveSpeed({ ...run, t: -35 }, 1000)).toBe(100);
    expect(effectiveSpeed({ ...run, t: -15 }, 1000)).toBe(1);
    expect(effectiveSpeed({ ...run, t: 0 }, 1000)).toBe(1);
    expect(effectiveSpeed({ ...run, t: 15 }, 1000)).toBe(1);
    expect(effectiveSpeed({ ...run, t: 40 }, 1000)).toBe(100);
    // Many hits: the ×1 window runs on to the last one's (3 s apart).
    expect(inHitWindow(hitTrack, [hole], 25)).toBe(false);
    expect(inHitWindow(hitTrack, [hole], 25, 7)).toBe(true);
    expect(inHitWindow(hitTrack, [hole], 18 + 20.5, 7)).toBe(false);
    expect(inHitWindow(hitTrack, [hole], 18 + 20, 7)).toBe(true);
    expect(inHitWindow(hitTrack, [hole], 53, 12)).toBe(true);
    expect(inHitWindow(hitTrack, [hole], 54, 12)).toBe(false);
    expect(
      effectiveSpeed({ ...run, hits: Array(7).fill(60), t: 30 }, 1000)
    ).toBe(1);
    expect(effectiveSpeed({ ...run, t: 30 }, 1000)).toBe(100);
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

describe("playback: walking", () => {
  function started(spec = titanic) {
    const store = createPlaybackStore({
      createRunner: () => fakeRunner(1000, 1000),
    });
    store.getState().start(spec, spec.realNight);
    store.getState().pump();
    return store;
  }

  it("startWalk sets the camera and the deck phase", () => {
    const store = started();
    store.getState().startWalk();
    const s = store.getState();
    expect(s.camera).toBe("walk");
    expect(s.walk.phase).toBe("deck");
    expect(s.walk.seq).toBe(1);
  });

  it("startWalk does nothing for a ship without a map", () => {
    const store = started();
    store.getState().setShip("nope" as never);
    store.getState().startWalk();
    expect(store.getState().camera).toBe("orbit");
    expect(store.getState().walk.phase).toBe("off");
  });

  it("leaveWalk returns to orbit and zeroes the walk input", () => {
    const store = started();
    store.getState().startWalk();
    walkInput.forward = 1;
    walkInput.lookDx = 40;
    store.getState().leaveWalk();
    expect(store.getState().camera).toBe("orbit");
    expect(store.getState().walk.phase).toBe("off");
    expect(walkInput.forward).toBe(0);
    expect(walkInput.lookDx).toBe(0);
  });

  it("seek re-places the walker", () => {
    const store = started();
    store.getState().startWalk();
    store.getState().wentInWater();
    const seq = store.getState().walk.seq;
    store.getState().seek(500);
    expect(store.getState().walk.seq).toBe(seq + 1);
    expect(store.getState().walk.phase).toBe("water");
    store.getState().backOnDeck();
    expect(store.getState().walk.phase).toBe("deck");
    expect(store.getState().walk.seq).toBe(seq + 2);
  });

  it("seek does not touch the walk seq when not walking", () => {
    const store = started();
    store.getState().seek(500);
    expect(store.getState().walk.seq).toBe(0);
  });

  it("restart and ship change clear walk", () => {
    const store = started();
    store.getState().startWalk();
    store.getState().setLookUnder(true);
    walkInput.strafe = 1;
    store.getState().start(titanic, titanic.realNight);
    expect(store.getState().walk.phase).toBe("off");
    expect(store.getState().camera).toBe("orbit");
    expect(walkInput.strafe).toBe(0);

    store.getState().startWalk();
    store.getState().setShip("lusitania");
    expect(store.getState().walk.phase).toBe("off");
    expect(store.getState().walk.lookUnder).toBe(false);
    expect(store.getState().camera).toBe("orbit");

    store.getState().setShip("titanic");
    store.getState().startWalk();
    store.getState().reset();
    expect(store.getState().walk.phase).toBe("off");
  });

  it("setCamera away from walk and takeControl turn walk off", () => {
    const store = started();
    store.getState().startWalk();
    store.getState().setCamera("bridge");
    expect(store.getState().camera).toBe("bridge");
    expect(store.getState().walk.phase).toBe("off");
    store.getState().startWalk();
    store.getState().takeControl();
    expect(store.getState().camera).toBe("orbit");
    expect(store.getState().walk.phase).toBe("off");
  });

  it("flying to a place or a view turns walk off", () => {
    const store = started();
    store.getState().startWalk();
    walkInput.forward = 1;
    store.getState().flyToPlace("bridge");
    expect(store.getState().camera).toBe("orbit");
    expect(store.getState().walk.phase).toBe("off");
    expect(walkInput.forward).toBe(0);
    store.getState().startWalk();
    store.getState().flyToView({ target: [0, 0, 20], cam: [40, 0, 30] });
    expect(store.getState().camera).toBe("orbit");
    expect(store.getState().walk.phase).toBe("off");
  });

  /** Walking with her last piece going under at `sankAtT` (or not known). */
  function walkingAt(t: number, sankAtT: number | null, speed: Speed) {
    const store = started();
    const track = store.getState().track!;
    store.setState({ track: { ...track, sankAtT } });
    store.getState().seek(t);
    store.getState().setSpeed(speed);
    store.getState().startWalk();
    return store;
  }

  it("going in within 5 minutes of her going under drops the speed to x1", () => {
    const store = walkingAt(400, 400 + WATCH_HER_GO_S, 100);
    store.getState().wentInWater();
    expect(store.getState().speed).toBe(1);
    // The player can speed up again; already in the water changes nothing.
    store.getState().setSpeed(30);
    store.getState().wentInWater();
    expect(store.getState().speed).toBe(30);
  });

  it("going in earlier brings a speed above x10 down to x10", () => {
    const store = walkingAt(100, 100 + WATCH_HER_GO_S + 10, 100);
    store.getState().wentInWater();
    expect(store.getState().speed).toBe(10);
    // Not known to go under yet (sankAtT null): the same.
    const unknown = walkingAt(100, null, 30);
    unknown.getState().wentInWater();
    expect(unknown.getState().speed).toBe(10);
  });

  it("going in earlier leaves x10 and slower alone", () => {
    for (const speed of [1, 10] as const) {
      const store = walkingAt(100, null, speed);
      store.getState().wentInWater();
      expect(store.getState().speed).toBe(speed);
    }
  });

  it("re-placing into the water (not stepping in) keeps the speed", () => {
    const store = walkingAt(400, 450, 100);
    store.getState().wentInWater(false);
    expect(store.getState().walk.phase).toBe("water");
    expect(store.getState().speed).toBe(100);
  });

  it("speedOnGoingIn ignores a sinking already past", () => {
    const track = fakeTrack(1000, { sankAtT: 300 });
    expect(speedOnGoingIn(track, 400, 100)).toEqual({
      speed: 10,
      slowMo: false,
    });
    expect(speedOnGoingIn(track, 250, 100)).toEqual({
      speed: 1,
      slowMo: false,
    });
    expect(speedOnGoingIn(null, 0, 10)).toEqual({});
  });

  it("setCamera('walk') starts the walk", () => {
    const store = started();
    store.getState().setCamera("walk");
    expect(store.getState().walk.phase).toBe("deck");
  });
});

describe("playback: more than one torpedo, and a storm (1.3)", () => {
  it("passes the run's options to the sim, and keeps the hits for the scene", () => {
    const made: unknown[] = [];
    const store = createPlaybackStore({
      createRunner: (_spec, _openings, options) => {
        made.push(options);
        return fakeRunner(100, 100);
      },
    });
    store.getState().start(lusitania, lusitania.realNight, {
      portholesOpen: false,
      hits: [10, 40, 67.7],
    });
    expect(made[0]).toEqual({ portholesOpen: false });
    expect(store.getState().hits).toEqual([10, 40, 67.7]);
    // Without hits: the first hole in her side, as 1.1 drew it.
    store.getState().start(lusitania, lusitania.realNight);
    const first = lusitania.realNight.find(
      (o) => o.side === "starboard" && (o.t ?? 0) === 0
    )!;
    expect(store.getState().hits).toEqual([first.x]);
    // A storm ship: her storm and the run's end go to the sim; no hits.
    store
      .getState()
      .start(fitzgerald, fitzgerald.realNight, { storm: "worse", endT: 5 });
    expect(made[2]).toEqual({ storm: "worse", endT: 5 });
    expect(store.getState().hits).toEqual([]);
    expect(store.getState().preview).toBe(false);
    // The title's stage: a flag for the scene, not the sim.
    store.getState().start(fitzgerald, [], { endT: 5, preview: true });
    expect(made[3]).toEqual({ endT: 5 });
    expect(store.getState().preview).toBe(true);
    store.getState().setShip("titanic");
    expect(store.getState().hits).toEqual([]);
    expect(store.getState().preview).toBe(false);
  });

  it("lands the first hit at the hit and the rest a few seconds after it, deterministically", () => {
    expect(hitTimeS(0, 1)).toBe(0);
    expect([0, 1, 2].map((k) => hitTimeS(k, 3))).toEqual([
      0,
      HIT_STAGGER_S,
      2 * HIT_STAGGER_S,
    ]);
    expect(HIT_STAGGER_S).toBeGreaterThanOrEqual(2);
    expect(HIT_STAGGER_S).toBeLessThanOrEqual(6);
  });
});

describe("the paint (livery) in the store", () => {
  it("changes only the livery: the run's time, playing state and frames stay", () => {
    const store = createPlaybackStore({
      createRunner: () => fakeRunner(1000, 1000),
    });
    store.getState().start(titanic, titanic.realNight);
    store.getState().pump();
    store.getState().setSpeed(10, 0);
    store.getState().play();
    store.getState().tick(5, 100);
    const before = store.getState();
    expect(before.livery).toBeNull();
    store.getState().setLivery("cunard-1912");
    const after = store.getState();
    expect(after.livery).toBe("cunard-1912");
    expect(after.t).toBe(before.t);
    expect(after.realT).toBe(before.realT);
    expect(after.playing).toBe(true);
    expect(after.track).toBe(before.track);
    expect(after.computedT).toBe(before.computedT);
    expect(after.snapId).toBe(before.snapId);
    expect(after.speed).toBe(before.speed);
    // Playing on from where it was.
    store.getState().tick(1, 100);
    expect(store.getState().t).toBe(before.t + 10);
  });

  it("goes back to the new ship's default when the ship changes", () => {
    const store = createPlaybackStore();
    store.getState().setLivery("cunard-1907");
    store.getState().setShip("carpathia");
    expect(store.getState().livery).toBeNull();
    store.getState().setLivery("cunard-1912");
    store.getState().reset();
    expect(store.getState().livery).toBeNull();
  });
});

describe("playback: a ship with her own hits (the Carpathia, Task 6)", () => {
  const real = torpedoHits(carpathia, whatIfRealIds(carpathia));

  it("keeps each torpedo's place, time and side for the scene", () => {
    const store = createPlaybackStore({
      createRunner: () => fakeRunner(100, 100),
    });
    store.getState().start(carpathia, carpathia.realNight, { torpedoes: real });
    const s = store.getState();
    expect(s.torpedoes).toEqual(real);
    expect(s.torpedoes.map((h) => [h.t, h.side])).toEqual([
      [0, "port"],
      [8, "port"],
      [CARPATHIA_HIT_T.third, "port"],
    ]);
    // The x's aft first (the HUD and captions count them), as 1.3's.
    expect(s.hits).toEqual(real.map((h) => h.x).sort((a, b) => a - b));
    expect(s.hitTimesS).toEqual([0, 8, CARPATHIA_HIT_T.third]);
    // Her two 9:15 AM wakes run in for the 40 s before the hit.
    expect(s.minT).toBe(-40);
    store.getState().setShip("titanic");
    expect(store.getState().torpedoes).toEqual([]);
    expect(store.getState().hitTimesS).toBeNull();
  });

  it("plays no run-in for the U-boat alone (its wake comes at 10:50 AM)", () => {
    const store = createPlaybackStore({
      createRunner: () => fakeRunner(100, 100),
    });
    const ids = [FINISHER_SPOT];
    store.getState().start(carpathia, whatIfOpenings(carpathia, ids), {
      torpedoes: torpedoHits(carpathia, ids),
    });
    expect(store.getState().minT).toBe(0);
    expect(store.getState().t).toBe(0);
    expect(store.getState().torpedoes.map((h) => h.t)).toEqual([
      CARPATHIA_HIT_T.third,
    ]);
  });

  it("leaves the Lusitania's 1.1 path: starboard, a few seconds apart, the old ×1 rule", () => {
    const store = createPlaybackStore({
      createRunner: () => fakeRunner(100, 100),
    });
    store
      .getState()
      .start(lusitania, lusitania.realNight, { hits: [10, 40, 67.7] });
    const s = store.getState();
    expect(s.torpedoes).toEqual(
      [10, 40, 67.7].map((x, k) => ({
        x,
        t: hitTimeS(k, 3),
        side: "starboard",
        finisher: false,
      }))
    );
    expect(s.hitTimesS).toBeNull();
    expect(s.minT).toBe(-40);
    // From the game's torpedoHits: the same hits.
    const ids = whatIfRealIds(lusitania);
    store.getState().start(lusitania, lusitania.realNight, {
      torpedoes: torpedoHits(lusitania, ids),
    });
    expect(store.getState().hits).toEqual(
      torpedoHits(lusitania, ids).map((h) => h.x)
    );
    expect(store.getState().hitTimesS).toBeNull();
  });

  it("holds ×1 around each of her hits on the cinematic camera, 10:50 AM too", () => {
    const track = fakeTrack(7000, {
      events: [
        { kind: "collision", t: 0, realT: 0 },
        { kind: "torpedo-hit", t: 8, realT: 8, index: 2 },
        { kind: "torpedo-hit", t: 5700, realT: 5700, index: 3 },
      ],
    });
    const run = {
      track,
      speed: 100 as const,
      camera: "cinematic" as const,
      speedTouchedAt: -Infinity,
      openings: carpathia.realNight,
      hits: [1, 2, 3],
      hitTimesS: [0, 8, 5700],
    };
    expect(effectiveSpeed({ ...run, t: -30 }, 1000)).toBe(100);
    expect(effectiveSpeed({ ...run, t: -15 }, 1000)).toBe(1);
    expect(effectiveSpeed({ ...run, t: 27 }, 1000)).toBe(1);
    expect(effectiveSpeed({ ...run, t: 30 }, 1000)).toBe(100);
    expect(effectiveSpeed({ ...run, t: 3000 }, 1000)).toBe(100);
    expect(effectiveSpeed({ ...run, t: 5675 }, 1000)).toBe(100);
    expect(effectiveSpeed({ ...run, t: 5685 }, 1000)).toBe(1);
    expect(effectiveSpeed({ ...run, t: 5719 }, 1000)).toBe(1);
    expect(effectiveSpeed({ ...run, t: 5721 }, 1000)).toBe(100);
    // Not on a run with no holes, nor on another camera.
    expect(inOwnHitWindow(track, [], 0, [0])).toBe(false);
    expect(effectiveSpeed({ ...run, camera: "orbit", t: 0 }, 1000)).toBe(100);
  });
});

describe("playback: a mine ship's What if (1.4)", () => {
  it("passes her doors and engines to the sim, and nothing for other ships", () => {
    const made: unknown[] = [];
    const store = createPlaybackStore({
      createRunner: (_spec, _openings, options) => {
        made.push(options);
        return fakeRunner(100, 100);
      },
    });
    store.getState().start(britannic, britannic.realNight, {
      portholesOpen: false,
      doorsClosed: true,
      enginesStopped: true,
    });
    expect(made[0]).toEqual({
      portholesOpen: false,
      doorsClosed: true,
      enginesStopped: true,
    });
    expect(store.getState().ship).toBe("britannic");
    store.getState().start(lusitania, lusitania.realNight, {
      portholesOpen: true,
    });
    expect(made[1]).toEqual({ portholesOpen: true });
  });
});

describe("playback: the Costa Concordia", () => {
  it("passes the wind out to sea to her sim, and no other option", () => {
    const made: { toSea?: boolean }[] = [];
    const store = createPlaybackStore({
      createRunner: (_s, _o, options) => {
        made.push({ toSea: options.toSea });
        return fakeRunner(100, 100);
      },
    });
    store.getState().start(concordia, concordia.realNight);
    store.getState().start(concordia, concordia.realNight, { toSea: true });
    expect(made).toEqual([{ toSea: undefined }, { toSea: true }]);
  });

  it("plays her 40 s run-in before the rock's first hole (it reaches it in under a second)", () => {
    const store = createPlaybackStore({
      createRunner: () => fakeRunner(100, 100),
    });
    store.getState().start(concordia, concordia.realNight);
    expect(store.getState().minT).toBe(-40);
    expect(store.getState().t).toBe(-40);
  });

  it("plays her run-in whichever rooms the rock opens, or none", () => {
    const store = createPlaybackStore({
      createRunner: () => fakeRunner(100, 100),
    });
    for (const ids of [["wtc4"], ["wtc8"], ["wtc7", "wtc8"], []]) {
      store.getState().start(concordia, whatIfOpenings(concordia, ids));
      expect(store.getState().minT).toBe(-40);
    }
    // Other ships keep their rule: no hole at the first moment, no run-in.
    store.getState().start(lusitania, []);
    expect(store.getState().minT).toBe(0);
  });
});

describe("playback: riding a lifeboat", () => {
  /** Boats 1, 3 and 5 leave at 800, 900 and 950. */
  const BOAT_EVENTS = [
    { t: 800, kind: "boat-lowered" as const, index: 1 },
    { t: 900, kind: "boat-lowered" as const, index: 3 },
    { t: 950, kind: "boat-lowered" as const, index: 5 },
  ];
  function started(spec = titanic) {
    const store = createPlaybackStore({
      createRunner: () => {
        const track = fakeTrack(1000, {
          events: BOAT_EVENTS as unknown as SimTrack["events"],
        });
        return {
          advance: () => true,
          done: true,
          progress: () => 1,
          track: () => track,
        };
      },
    });
    store.getState().start(spec, spec.realNight);
    store.getState().pump();
    return store;
  }

  it("boardBoat rides that boat from now, on the walk camera", () => {
    const store = started();
    store.getState().seek(300);
    store.getState().boardBoat(5);
    const s = store.getState();
    expect(s.camera).toBe("walk");
    expect(s.walk.phase).toBe("boat");
    expect(s.walk.boat).toEqual({ index: 5, at: 300 });
  });

  it("boardBoat does nothing before the night has frames", () => {
    const store = createPlaybackStore({
      createRunner: () => fakeRunner(1000, 1000),
    });
    store.getState().start(titanic, titanic.realNight);
    store.getState().boardBoat(5);
    expect(store.getState().walk.phase).toBe("off");
  });

  it("seeking back before boarding ends the ride; forward keeps it", () => {
    const store = started();
    store.getState().seek(300);
    store.getState().boardBoat(5);
    store.getState().seek(600);
    expect(store.getState().walk.phase).toBe("boat");
    expect(store.getState().walk.boat).toEqual({ index: 5, at: 300 });
    store.getState().seek(299);
    expect(store.getState().walk.phase).toBe("off");
    expect(store.getState().walk.boat ?? null).toBeNull();
    expect(store.getState().camera).toBe("orbit");
  });

  it("boardBoat starts the night playing (no hanging in the davits)", () => {
    const store = started();
    store.getState().pause();
    store.getState().boardBoat(5);
    expect(store.getState().playing).toBe(true);
  });

  it("boardBoat ignores a boat that has already left", () => {
    const store = started();
    store.getState().seek(920);
    store.getState().boardBoat(3);
    expect(store.getState().walk.phase).toBe("off");
    store.getState().boardBoat(5);
    expect(store.getState().walk.phase).toBe("boat");
  });

  it("Play from the end starts the night again out of the boat", () => {
    const store = started();
    store.getState().seek(300);
    store.getState().boardBoat(5);
    store.getState().seek(1000);
    expect(store.getState().walk.phase).toBe("boat");
    store.getState().play();
    expect(store.getState().t).toBe(store.getState().minT);
    expect(store.getState().walk.phase).toBe("off");
    expect(store.getState().camera).toBe("orbit");
  });

  it("a new run or ship ends the ride", () => {
    const store = started();
    store.getState().boardBoat(5);
    store.getState().start(titanic, titanic.realNight);
    expect(store.getState().walk.phase).toBe("off");
    store.getState().pump();
    store.getState().boardBoat(5);
    store.getState().setShip("lusitania");
    expect(store.getState().walk.phase).toBe("off");
    expect(store.getState().camera).toBe("orbit");
  });

  it("leaveBoat goes back on deck on a ship you can walk", () => {
    const store = started();
    store.getState().boardBoat(5);
    const seq = store.getState().walk.seq;
    store.getState().leaveBoat();
    const s = store.getState();
    expect(s.camera).toBe("walk");
    expect(s.walk.phase).toBe("deck");
    expect(s.walk.boat ?? null).toBeNull();
    expect(s.walk.seq).toBe(seq + 1);
  });

  it("leaveBoat goes back to the outside view on a ship you cannot walk", () => {
    const store = started(concordia);
    store.getState().boardBoat(1);
    expect(store.getState().walk.phase).toBe("boat");
    store.getState().leaveBoat();
    expect(store.getState().camera).toBe("orbit");
    expect(store.getState().walk.phase).toBe("off");
  });
});
