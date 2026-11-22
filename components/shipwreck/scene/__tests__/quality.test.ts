import { createPlaybackStore } from "@/lib/shipwreck/playback";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import type { SimRunner } from "@/lib/shipwreck/sim/run";
import { stepQuality } from "../quality";

/** A runner that finishes after `n` advances. */
function runner(n: number): SimRunner {
  let k = 0;
  const empty = {
    frames: [],
    events: [],
    outcome: "sank" as const,
    sankAtT: null,
    brokeAtT: null,
    breakX: null,
    endT: 0,
  };
  return {
    advance: () => (k += 1) >= n,
    get done() {
      return k >= n;
    },
    progress: () => Math.min(1, k / n),
    track: () => empty,
  };
}

describe("quality steps", () => {
  it("ignores a frame-rate dip while the sim is still computing her run", () => {
    const store = createPlaybackStore({ createRunner: () => runner(3) });
    store.getState().start(fitzgerald, fitzgerald.realNight);
    expect(store.getState().quality).toBe("medium");
    stepQuality(store, 1);
    expect(store.getState().quality).toBe("medium");
    store.getState().pump();
    store.getState().pump();
    store.getState().pump();
    expect(store.getState().done).toBe(true);
    stepQuality(store, 1);
    expect(store.getState().quality).toBe("low");
    stepQuality(store, -1);
    expect(store.getState().quality).toBe("medium");
    stepQuality(store, -1);
    stepQuality(store, -1);
    expect(store.getState().quality).toBe("high");
  });
});
