import { TOOL_ORDER } from "@/lib/planet-smasher/tools";
import {
  END_BEATS,
  MAX_VOICES,
  TOOL_CUES,
  closeSfx,
  enableSfx,
  playCue,
  startGoo,
  stopMothershipCharge,
  stopGoo,
  type Cue,
} from "../sfx";
import { soundSetting } from "../soundSetting";

let made = { contexts: 0, sources: 0 };
let clock = 0;

/** Any property is a node; any call returns a node. Counts what is built. */
function node(): unknown {
  const target = function () {};
  return new Proxy(target, {
    get(_t, key) {
      if (key === "then") return undefined;
      if (key === "currentTime") return clock;
      if (key === "sampleRate") return 8000;
      if (key === "getChannelData")
        return (): Float32Array => new Float32Array(24000);
      if (key === "createOscillator" || key === "createBufferSource") {
        return () => {
          made.sources++;
          return node();
        };
      }
      return node();
    },
    set: () => true,
    apply: () => node(),
  });
}

class FakeAudioContext {
  constructor() {
    made.contexts++;
    return node() as FakeAudioContext;
  }
}

beforeEach(() => {
  made = { contexts: 0, sources: 0 };
  clock = 0;
  window.localStorage.clear();
  soundSetting.resetMemory();
  (window as unknown as { AudioContext: unknown }).AudioContext =
    FakeAudioContext;
});

afterEach(() => {
  closeSfx();
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
});

describe("TOOL_CUES", () => {
  it("has an entry for every tool", () => {
    for (const id of TOOL_ORDER) {
      expect(TOOL_CUES[id]).toBeDefined();
      expect(TOOL_CUES[id].impact).toBeTruthy();
    }
  });
});

describe("playCue", () => {
  it("does not touch AudioContext while sound is off", () => {
    window.localStorage.setItem("planet-smasher:ui:sound", "off");
    playCue("impactBig");
    expect(made.contexts).toBe(0);
    expect(made.sources).toBe(0);
  });

  it("does not create the audio before it is unlocked", () => {
    playCue("impactBig");
    expect(made.contexts).toBe(0);
  });

  it("makes nothing when the setting is off even once unlocked", () => {
    expect(enableSfx()).toBe(true);
    window.localStorage.setItem("planet-smasher:ui:sound", "off");
    playCue("impactBig");
    expect(made.sources).toBe(0);
  });

  it("plays once unlocked and caps simultaneous voices", () => {
    expect(enableSfx()).toBe(true);
    expect(made.contexts).toBe(1);
    playCue("impactBig");
    expect(made.sources).toBeGreaterThan(0);

    // Long cues, 50 ms apart: well over the cap are alive at once.
    const long: Cue[] = ["freeze", "moonWhoosh", "rumble", "blackHoleHum"];
    for (let i = 0; i < MAX_VOICES + 4; i++) {
      clock += 0.05;
      playCue(long[i % 4]);
    }
    const full = made.sources;
    clock += 0.05;
    playCue("launch");
    expect(made.sources).toBe(full);
    // Once they have died away a new cue plays again.
    clock += 10;
    playCue("launch");
    expect(made.sources).toBeGreaterThan(full);
  });

  it("still lets the big cues through when the voices are full", () => {
    enableSfx();
    const long: Cue[] = ["freeze", "moonWhoosh", "rumble", "blackHoleHum"];
    for (let i = 0; i < MAX_VOICES + 4; i++) {
      clock += 0.05;
      playCue(long[i % 4]);
    }
    const full = made.sources;
    clock += 0.05;
    playCue("endShatter");
    expect(made.sources).toBeGreaterThan(full);
  });

  it("starts and stops the laser loop without throwing", () => {
    enableSfx();
    playCue("zapStart");
    playCue("zapStart");
    playCue("zapStop");
    // One loop (a saw and its vibrato), however often it is started.
    expect(made.sources).toBe(2);
  });

  it("keeps one goo loop for overlapping nanobot swarms", () => {
    enableSfx();
    const a = startGoo();
    const one = made.sources;
    const b = startGoo();
    // The second swarm shares the loop.
    expect(made.sources).toBe(one);
    stopGoo(a);
    stopGoo(a); // releasing twice is a no-op
    stopGoo(b);
    stopGoo(b);
    // Everyone let go: the next swarm starts a fresh loop.
    startGoo();
    expect(made.sources).toBeGreaterThan(one);
  });

  it("gives each goo hold its own safety timer", () => {
    jest.useFakeTimers();
    try {
      enableSfx();
      const a = startGoo();
      const one = made.sources;
      jest.advanceTimersByTime(6000);
      const b = startGoo();
      // A's timer fires at 12 s; B (started at 6 s) still holds the loop.
      jest.advanceTimersByTime(6000);
      const c = startGoo();
      expect(made.sources).toBe(one);
      stopGoo(a); // already released by its timer
      stopGoo(b);
      stopGoo(c);
      startGoo();
      expect(made.sources).toBeGreaterThan(one);
    } finally {
      jest.useRealTimers();
    }
  });

  it("hands out no goo token while sound is off", () => {
    expect(startGoo()).toBeNull();
    stopGoo(null);
  });

  it("cuts the mothership whine without throwing, however often", () => {
    enableSfx();
    stopMothershipCharge(); // nothing playing yet
    playCue("mothershipCharge");
    stopMothershipCharge();
    stopMothershipCharge();
  });

  it("plays the 1.1 cues", () => {
    enableSfx();
    for (const cue of ["gooPlop", "mothershipCharge", "endConsumed"] as const) {
      const before = made.sources;
      playCue(cue);
      expect(made.sources).toBeGreaterThan(before);
    }
  });
});

describe("ending beats follow the slow motion", () => {
  it("schedules each beat at the real time its sim time arrives", () => {
    expect(END_BEATS.shatterBoom).toBeCloseTo(1.45);
    expect(END_BEATS.frozenCrack).toBeCloseTo(2.15);
    expect(END_BEATS.consumedClang).toBeCloseTo(2.55);
    expect(END_BEATS.vaporizedGone).toBeCloseTo(3.25);
  });
});
