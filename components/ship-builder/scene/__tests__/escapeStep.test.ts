import {
  JUMP_S,
  LOWER_S,
  type BoatLaunch,
  type BodyPose,
} from "@/lib/ship-builder/crowd/evacuation";
import { DECK_Y } from "@/lib/ship-builder/model/worldFrame";
import { SIM_STEP_S } from "@/lib/ship-builder/sim/types";
import type { WalkState } from "@/lib/ship-builder/walk";
import {
  COLD_WARNING,
  SWIM_MARGIN,
  SWIM_SPEED,
  startSwimming,
  type EscapePhase,
} from "@/lib/ship-builder/walk/escape";
import {
  advanceEscape,
  escapeLedger,
  escapeVoiceMoment,
  hullBoxOf,
  type EscapeFrame,
} from "../escapeStep";
import { walkerBody } from "../playbackBody";
import { trialPlayback, type TrialPlayback } from "../trialPlayback";

const LENGTH = 24;
const BEAM = 4;

/** A walker in the middle of the deck, facing the bow. */
const walk: WalkState = { x: 12, z: 2, yaw: 0, level: 0, time: 0 };

const davit: BoatLaunch = {
  boatId: "davit",
  kind: "davit",
  at: 20,
  ready: 20,
  departs: 20,
  origin: { x: 0, y: 1, z: 3 },
  roll: 0,
  pitch: 0,
  outward: 1,
  riders: [],
  // Right where the walker stands (walkerRestPoint of `walk`).
  spot: { x: 0, y: DECK_Y, z: 0 },
  half: null,
};

const raft: BoatLaunch = {
  ...davit,
  boatId: "raft",
  kind: "raft",
  at: 0,
  ready: 2,
  departs: 30,
  outward: -1,
};

const plan: NonNullable<EscapeFrame["plan"]> = {
  launches: [davit],
  boatPoseAt: () => ({
    position: { x: 30, y: 0, z: 30 },
    rotation: { x: 0, y: 0, z: 0 },
  }),
};

const dry: BodyPose = { roll: 0, pitch: 0, sink: 0 };
const flooded: BodyPose = { roll: 0, pitch: 0, sink: DECK_Y + 0.5 };

function frame(over: Partial<EscapeFrame> = {}): EscapeFrame {
  return {
    plan,
    t: 10,
    walk,
    half: null,
    body: dry,
    length: LENGTH,
    beam: BEAM,
    hullGone: false,
    request: null,
    input: { forward: 0, strafe: 0, turn: 0 },
    delta: 0,
    leftover: 0,
    warmthSeconds: 60,
    ...over,
  };
}

const aboard: EscapePhase = { kind: "aboard" };

/** A swimmer well clear of the hull. */
const swimming = (warmth = 1) => {
  const phase = startSwimming({ x: 0, z: 8 }, 0, 5);
  if (phase.kind !== "swimming") throw new Error("expected swimming");
  return { ...phase, swimmer: { ...phase.swimmer, warmth } };
};

describe("advanceEscape", () => {
  it("does nothing at all with no evacuation plan", () => {
    const swim = swimming();
    for (const phase of [aboard, swim]) {
      const next = advanceEscape(
        phase,
        frame({ plan: null, body: flooded, request: "board", delta: 1 })
      );
      expect(next.phase).toBe(phase);
      expect(next.boardable).toBeNull();
      expect(next.pickup).toBeNull();
      expect(next.yaw).toBeNull();
    }
  });

  it("goes back aboard when the clock is scrubbed before the escape began", () => {
    const next = advanceEscape(swimming(), frame({ t: 4, leftover: 0.01 }));
    expect(next.phase).toEqual({ kind: "aboard" });
    expect(next.leftover).toBe(0);
  });

  it("stays aboard while the deck is dry, offering the boat beside them", () => {
    const next = advanceEscape(aboard, frame());
    expect(next.phase).toBe(aboard);
    expect(next.boardable?.boatId).toBe("davit");
  });

  it("does not offer a boat on the other half", () => {
    const stern = { ...plan, launches: [{ ...davit, half: "stern" as const }] };
    expect(
      advanceEscape(aboard, frame({ plan: stern, half: "bow" })).boardable
    ).toBeNull();
    expect(
      advanceEscape(aboard, frame({ plan: stern, half: "stern" })).boardable
    ).not.toBeNull();
  });

  it("goes into the water where it reached them, facing the same way", () => {
    const next = advanceEscape(
      aboard,
      frame({ body: flooded, walk: { ...walk, yaw: 1 } })
    );
    expect(next.phase).toMatchObject({
      kind: "swimming",
      since: 10,
      swimmer: { x: 0, z: 0, yaw: 1, warmth: 1 },
    });
  });

  it("boards a davit boat straight away, facing back at the ship", () => {
    const next = advanceEscape(aboard, frame({ request: "board" }));
    expect(next.phase).toEqual({
      kind: "in-boat",
      boatId: "davit",
      since: 10,
      fromWater: false,
    });
    // The davit boat lowers to +z (outward 1): the ship is at -z.
    expect(next.yaw).toBeCloseTo(-Math.PI / 2);
  });

  it("jumps into a raft, then sits in it once the jump is over", () => {
    const rafts = { ...plan, launches: [raft] };
    const jumping = advanceEscape(
      aboard,
      frame({ plan: rafts, request: "board" })
    );
    expect(jumping.phase).toMatchObject({
      kind: "jumping",
      boatId: "raft",
      since: 10,
      from: { x: 0, y: DECK_Y, z: 0 },
    });
    const midway = advanceEscape(
      jumping.phase,
      frame({ plan: rafts, t: 10 + JUMP_S / 2 })
    );
    expect(midway.phase).toBe(jumping.phase);
    const landed = advanceEscape(
      jumping.phase,
      frame({ plan: rafts, t: 10 + JUMP_S })
    );
    expect(landed.phase).toEqual({
      kind: "in-boat",
      boatId: "raft",
      since: 10 + JUMP_S,
      fromWater: false,
    });
    // The raft is out to -z (outward -1): the ship is at +z.
    expect(landed.yaw).toBeCloseTo(Math.PI / 2);
  });

  it("ignores a board request with no boat in reach", () => {
    const far = { ...walk, x: 2 };
    expect(
      advanceEscape(aboard, frame({ walk: far, request: "board" })).phase
    ).toBe(aboard);
  });

  it("swims on the frame clock in fixed steps, keeping the rest", () => {
    const next = advanceEscape(
      swimming(),
      frame({
        input: { forward: 1, strafe: 0, turn: 0 },
        delta: SIM_STEP_S * 3.5,
      })
    );
    if (next.phase.kind !== "swimming") throw new Error("expected swimming");
    expect(next.phase.swimmer.x).toBeCloseTo(SWIM_SPEED * SIM_STEP_S * 3);
    expect(next.leftover).toBeCloseTo(SIM_STEP_S * 0.5);
    expect(next.stepped).toBe(true);
    expect(next.yaw).toBe(0);
  });

  it("caps a long frame", () => {
    const next = advanceEscape(
      swimming(),
      frame({ input: { forward: 1, strafe: 0, turn: 0 }, delta: 5 })
    );
    if (next.phase.kind !== "swimming") throw new Error("expected swimming");
    expect(next.phase.swimmer.x).toBeLessThan(SWIM_SPEED * 0.11);
  });

  it("drains warmth over the given seconds, warns, then freezes", () => {
    const warm = advanceEscape(
      swimming(COLD_WARNING + 0.005),
      frame({ delta: SIM_STEP_S * 6.5, warmthSeconds: 10 })
    );
    if (warm.phase.kind !== "swimming") throw new Error("expected swimming");
    // Six steps of 1/60 s on a 10 s clock.
    expect(warm.phase.swimmer.warmth).toBeCloseTo(COLD_WARNING - 0.005);
    expect(warm.phase.warned).toBe(true);

    const cold = advanceEscape(
      swimming(0.005),
      frame({ delta: 0.1, warmthSeconds: 10, t: 12 })
    );
    expect(cold.phase).toEqual({ kind: "frozen", since: 12, x: 0, z: 8 });
  });

  it("is picked up by a boat in reach when they climb in", () => {
    const near = {
      ...plan,
      launches: [{ ...davit, at: 0 }],
      boatPoseAt: () => ({
        position: { x: 0.5, y: 0, z: 8 },
        rotation: { x: 0, y: 0, z: 0 },
      }),
    };
    const offered = advanceEscape(
      swimming(),
      frame({ plan: near, t: LOWER_S + 1 })
    );
    expect(offered.pickup?.boatId).toBe("davit");
    const climbed = advanceEscape(
      swimming(),
      frame({ plan: near, t: LOWER_S + 1, request: "climb-in" })
    );
    expect(climbed.phase).toEqual({
      kind: "in-boat",
      boatId: "davit",
      since: LOWER_S + 1,
      fromWater: true,
    });
    // Seated facing back at the ship.
    expect(climbed.yaw).toBeCloseTo(-Math.PI / 2);
  });

  it("keeps a swimmer out of the hull until she has gone under", () => {
    const inside = startSwimming({ x: 0, z: 0.5 }, 0, 5);
    const blocked = advanceEscape(inside, frame({ delta: SIM_STEP_S }));
    if (blocked.phase.kind !== "swimming") throw new Error("expected swimming");
    expect(Math.abs(blocked.phase.swimmer.z)).toBeGreaterThan(BEAM / 2);
    const gone = advanceEscape(
      inside,
      frame({ delta: SIM_STEP_S, hullGone: true })
    );
    if (gone.phase.kind !== "swimming") throw new Error("expected swimming");
    expect(gone.phase.swimmer.z).toBeCloseTo(0.5);
  });

  it("leaves a frozen player and a seated one where they are", () => {
    const frozen: EscapePhase = { kind: "frozen", since: 5, x: 1, z: 2 };
    expect(advanceEscape(frozen, frame({ delta: 1 })).phase).toBe(frozen);
    const seated: EscapePhase = {
      kind: "in-boat",
      boatId: "davit",
      since: 5,
      fromWater: false,
    };
    expect(advanceEscape(seated, frame({ delta: 1 })).phase).toBe(seated);
  });
});

describe("hullBoxOf", () => {
  it("is the resting footprint, shifted by the drift", () => {
    expect(hullBoxOf(LENGTH, BEAM, { ...dry, driftX: 2 }, false)).toEqual({
      cx: 2,
      halfLength: LENGTH / 2,
      halfBeam: BEAM / 2,
      radius: LENGTH / 2 + SWIM_MARGIN,
    });
  });
});

describe("walkerBody", () => {
  const playback = (): TrialPlayback => ({
    ...trialPlayback,
    roll: 0,
    pitch: 0,
    sink: 1,
    breakup: { at: 5, atX: 10, angle: -0.3 },
    halves: {
      bow: { roll: 0, pitch: 0, sink: 9, pivotX: 10, driftX: -1 },
      stern: { roll: 0, pitch: 0, sink: 0, pivotX: 10, driftX: 1 },
    },
  });

  it("is the whole ship while she holds together", () => {
    const whole = { ...playback(), breakup: null, halves: null };
    expect(walkerBody(whole, null, 3).sink).toBe(1);
  });

  it("is the half the walker rides once she breaks", () => {
    expect(walkerBody(playback(), "stern", 3).sink).toBe(0);
    expect(walkerBody(playback(), "bow", 15).sink).toBe(9);
  });

  it("goes by where they stand when no half is known", () => {
    expect(walkerBody(playback(), null, 3).sink).toBe(9);
    expect(walkerBody(playback(), null, 15).sink).toBe(0);
  });
});

describe("escapeLedger", () => {
  const inBoat: EscapePhase = {
    kind: "in-boat",
    boatId: "b",
    since: 5,
    fromWater: false,
  };
  const aboard: EscapePhase = { kind: "aboard" };

  it("records a new ending", () => {
    expect(escapeLedger(aboard, inBoat)).toBe("record");
  });

  it("clears when the clock is scrubbed back past the ending", () => {
    expect(escapeLedger(inBoat, aboard)).toBe("clear");
  });

  it("does nothing while the ending just holds", () => {
    expect(escapeLedger(inBoat, inBoat)).toBeNull();
    expect(escapeLedger(aboard, aboard)).toBeNull();
  });
});

describe("escapeVoiceMoment", () => {
  const aboard: EscapePhase = { kind: "aboard" };
  const swimmer = { x: 0, z: 0, yaw: 0, warmth: 0.2, kick: 0 };
  const swimming: EscapePhase = {
    kind: "swimming",
    since: 1,
    swimmer,
    warned: false,
  };
  const inBoat = (fromWater: boolean): EscapePhase => ({
    kind: "in-boat",
    boatId: "b",
    since: 5,
    fromWater,
  });

  it("speaks on boarding a lifeboat from the deck", () => {
    expect(escapeVoiceMoment(aboard, inBoat(false))).toBe("boarded");
  });

  it("speaks on jumping for a raft, not on landing in it", () => {
    const jumping: EscapePhase = {
      kind: "jumping",
      boatId: "r",
      since: 2,
      from: { x: 0, y: 3, z: 0 },
    };
    expect(escapeVoiceMoment(aboard, jumping)).toBe("jumped");
    expect(escapeVoiceMoment(jumping, inBoat(false))).toBeNull();
  });

  it("speaks once when the swimmer gets cold", () => {
    const warned = { ...swimming, warned: true };
    expect(escapeVoiceMoment(swimming, warned)).toBe("cold");
    expect(escapeVoiceMoment(warned, warned)).toBeNull();
  });

  it("leaves the card moments to the popups", () => {
    expect(escapeVoiceMoment(aboard, swimming)).toBeNull();
    expect(escapeVoiceMoment(swimming, inBoat(true))).toBeNull();
    expect(
      escapeVoiceMoment(swimming, { kind: "frozen", since: 9, x: 0, z: 0 })
    ).toBeNull();
    expect(escapeVoiceMoment(inBoat(false), aboard)).toBeNull();
  });
});
